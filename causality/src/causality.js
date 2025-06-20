import { argumentsToArray, configSignature, mergeInto } from "./lib/utility.js";
import { objectlog } from "./lib/objectlog.js";
import { createCachingFunction } from "./lib/caching.js";
import { defaultDependencyInterfaceCreator } from "./lib/defaultDependencyInterface.js";
// import { traceWarnings } from "../flow.core/Flow.js";
// import { logMark } from "../flow.core/utility.js";
const defaultObjectlog = objectlog;


/***************************************************************
 *
 *  Default coonfiguration
 *
 ***************************************************************/


const defaultConfiguration = {
  requireRepeaterName: false,
  requireInvalidatorName: false,
  warnOnNestedRepeater: true,
  alwaysDependOnParentRepeater: false,

  priorityLevels: 4, 

  objectMetaProperty: "causality",

  useNonObservablesAsValues: false, 
  valueComparisonDepthLimit: 5, 

  sendEventsToObjects: true,
    // Reserved properties that you can override on observables IF sendEventsToObjects is set to true. 
    // onChange
    // onBuildCreate
    // onBuildRemove
  onEventGlobal: null,
  emitReBuildEvents: false,

  // allowNonObservableReferences: true, // Allow observables to refer to non referables. TODO?
  
  onWriteGlobal: null, 
  onReadGlobal: null, 
  cannotReadPropertyValue: null,

  customObjectlog: null,
  customDependencyInterfaceCreator: null, //{recordDependencyOnArray, recordDependencyOnEnumeration, recordDependencyOnProperty, recordDependency}
  customCreateInvalidator: null, 
  customCreateRepeater: null,
}


function createWorld(configuration) {
  // console.log(usedObjectlog)

  /***************************************************************
   *
   *  State
   *
   ***************************************************************/

  // Public state, shareable with other modules. 
  const state = {
    recordingPaused : 0,
    blockInvalidation : 0,
    postponeInvalidation : 0,
    postponeRefreshRepeaters: 0, 
  
    // Object creation
    nextObjectId: 1,
    nextTempObjectId: 1,
  
    // Stack
    context: null,

    // Observers
    observerId: 0,
    inActiveRecording: false,
    nextObserverToInvalidate: null,
    lastObserverToInvalidate: null,

    // Repeaters
    inRepeater: null,
    dirtyRepeaters: [...Array(configuration.priorityLevels).keys()].map(() => ({first: null, last: null})),
    refreshingAllDirtyRepeaters: false,
    workOnPriorityLevel: [...Array(configuration.priorityLevels).keys()].map(() => 0),
    revalidationLevelLock: -1,
  };


  /************************************************************************
   *
   *  Instance
   *
   ************************************************************************/

  const world = {
    name: configuration.name,
    sameAsPreviousDeep,
    
    // Main API
    observable,
    deeplyObservable,
    isObservable,
    create: observable, // observable alias
    invalidateOnChange,
    repeat,
    finalize,

    // Modifiers
    withoutRecording,
    withoutReactions: withoutReactionsDo,

    // Transaction
    doWhileInvalidationsPostponed: postponeInvalidationsAndDo,
    transaction : postponeInvalidationsAndDo,
    postponeInvalidations,
    continueInvalidations,

    // Debugging and testing
    clearRepeaterLists,
    
    // Logging (these log commands do automatic withoutRecording to avoid your logs destroying your test-setup) 
    log,
    loge : (string) => { usedObjectlog.loge(string) }, // "event"
    logs : () => { usedObjectlog.logs() }, // "separator"
    logss : () => { usedObjectlog.logss() },
    logsss : () => { usedObjectlog.logss() },
    logGroup,
    logUngroup,
    logToString,
    
    // Advanced (only if you know what you are doing, typically used by plugins to causality)
    state,
    enterContext,
    leaveContext,
    invalidateObserver, 
    proceedWithPostponedInvalidations, 
    nextObserverId: () => { return state.observerId++ },

    // Libraries
    caching: createCachingFunction(observable),

    // Priority levels 
    enterPriorityLevel,
    exitPriorityLevel,
    workOnPriorityLevel
  }; 


  /***************************************************************
   *
   *  Customize
   *
   ***************************************************************/

  // Custom observer creators
  const createRepeater = configuration.customCreateRepeater ? configuration.customCreateRepeater : defaultCreateRepeater;
  const createInvalidator = configuration.customCreateInvalidator ? configuration.customCreateInvalidator : defaultCreateInvalidator;

  // Dependency interface (plugin data structures connecting observer and observable)
  const dependencyInterface = configuration.customDependencyInterfaceCreator ? 
    configuration.customDependencyInterfaceCreator(world) 
    : 
    defaultDependencyInterfaceCreator(world);
  const recordDependencyOnArray = dependencyInterface.recordDependencyOnArray;
  const recordDependencyOnEnumeration = dependencyInterface.recordDependencyOnEnumeration;
  const recordDependencyOnProperty = dependencyInterface.recordDependencyOnProperty;
  const invalidateArrayObservers = dependencyInterface.invalidateArrayObservers;
  const invalidateEnumerateObservers = dependencyInterface.invalidateEnumerateObservers;
  const invalidatePropertyObservers = dependencyInterface.invalidatePropertyObservers;
  const removeAllSources = dependencyInterface.removeAllSources;

  // Object log
  const usedObjectlog = configuration.customObjectlog ? configuration.customObjectlog : defaultObjectlog;

  // Object.assign(world, require("./lib/causalityObject.js").bindToInstance(world));


  /***************************************************************
   *
   *  Constants
   *
   ***************************************************************/

  const staticArrayOverrides = createStaticArrayOverrides();



  /****************************************************
   *
   *          Deploy configuration
   *
   ****************************************************/

  const {
    requireRepeaterName,
    requireInvalidatorName,
    warnOnNestedRepeater,
    objectMetaProperty,
    sendEventsToObjects,
    onEventGlobal,
    emitReBuildEvents,
    onWriteGlobal, 
    onReadGlobal, 
    cannotReadPropertyValue
  } = configuration;  

  const emitEvents = !!onEventGlobal || sendEventsToObjects; 

  /**********************************
   *
   *   State ajustments
   *
   **********************************/

  function withoutRecording(action) {
    state.recordingPaused++;
    updateContextState();
    const result = action();
    state.recordingPaused--;
    updateContextState();
    return result; 
  }

  function postponeInvalidationsAndDo(callback) {
    state.postponeInvalidation++;
    callback();
    state.postponeInvalidation--;
    proceedWithPostponedInvalidations();
  }

  function postponeInvalidations() {
    state.postponeInvalidation++;
  }

  function continueInvalidations() {
    state.postponeInvalidation--;
    proceedWithPostponedInvalidations();
  }

  function withoutReactionsDo(callback) {
    state.blockInvalidation++;
    callback();
    state.blockInvalidation--;
  }
  

  /**********************************
   *
   *   Priority Levels
   *
   **********************************/

  function enterPriorityLevel(level) {
    if (typeof(level) !== "number") {
      const context = level; 
      level = (typeof(context.priority) === "function") ? context.priority() : 0;
    }
    state.workOnPriorityLevel[level]++
  } 

  function exitPriorityLevel(level) {
    if (typeof(level) !== "number") {
      const context = level; 
      level = (typeof(context.priority) === "function") ? context.priority() : 0;
    }
    state.workOnPriorityLevel[level]--

    // Handle finished priority levels. 
    let first = true;  
    while (level < state.workOnPriorityLevel.length && state.workOnPriorityLevel[level] === 0) {
      // if (!first) logMark("No work on next level, signaling early finish.");
      if (typeof(configuration.onFinishedPriorityLevel) === "function") {
        configuration.onFinishedPriorityLevel(level, first);
      }
      state.revalidationLevelLock = level;
      level++;
      first = false;  
    }
  } 

  function workOnPriorityLevel(level, action) {
    enterPriorityLevel(level);
    action();
    exitPriorityLevel(level);
  }


  /**********************************
   *
   *   Causality Global stacklets
   *
   **********************************/

  function updateContextState() {
    state.inActiveRecording = state.context !== null && state.context.isRecording && state.recordingPaused === 0;
    state.inRepeater = (state.context && state.context.type === "repeater") ? state.context: null;
  }

  // function stackDescription() {
  //   const descriptions = [];
  //   let context = state.context;
  //   while (context) {
  //     descriptions.unshift(context.description);
  //     context = context.parent;
  //   }
  //   return descriptions.join(" | ");
  // }

  function enterContext(enteredContext) {
    // console.log("stack: [" + stackDescription() + "]");
    enteredContext.parent = state.context;
    state.context = enteredContext;
    updateContextState();
    enterPriorityLevel(enteredContext);
    return enteredContext;
  }

  function leaveContext( activeContext ) {
    // console.log("stack: [" + stackDescription() + "]");
    if( state.context && activeContext === state.context ) {
      state.context = state.context.parent;
    } else {
      throw new Error("Context missmatch");
    }
    updateContextState();
    exitPriorityLevel(activeContext);
  }


  /***************************************************************
   *
   *  Array causality
   *
   ***************************************************************/

  function createStaticArrayOverrides() {
    const result = {
      pop : function() {
        let index = this.target.length - 1;
        let result = this.target.pop();

        invalidateArrayObservers(this, "pop");
        if (emitEvents) emitSpliceEvent(this, index, [result], null);

        return result;
      },

      push : function() {
        let index = this.target.length;
        let argumentsArray = argumentsToArray(arguments);
        this.target.push.apply(this.target, argumentsArray);

        invalidateArrayObservers(this, "push");
        if (emitEvents) emitSpliceEvent(this, index, null, argumentsArray);

        return this.target.length;
      },

      shift : function() {
        let result = this.target.shift();
        
        invalidateArrayObservers(this, "shift");
        if (emitEvents) emitSpliceEvent(this, 0, [result], null);

        return result;

      },

      unshift : function() {
        let argumentsArray = argumentsToArray(arguments);
        this.target.unshift.apply(this.target, argumentsArray);

        invalidateArrayObservers(this, "unshift");
        if (emitEvents) emitSpliceEvent(this, 0, null, argumentsArray);

        return this.target.length;
      },

      splice : function() {
        let argumentsArray = argumentsToArray(arguments);
        let index = argumentsArray[0];
        let removedCount = argumentsArray[1];
        if( typeof argumentsArray[1] === 'undefined' )
          removedCount = this.target.length - index;
        let added = argumentsArray.slice(2);
        let removed = this.target.slice(index, index + removedCount);
        let result = this.target.splice.apply(this.target, argumentsArray);

        invalidateArrayObservers(this, "splice");
        if (emitEvents) emitSpliceEvent(this, index, removed, added);

        return result; // equivalent to removed
      },

      copyWithin: function(target, start, end) {
        if( !start ) start = 0;
        if( !end ) end = this.target.length;
        if (target < 0) { start = this.target.length - target; }
        if (start < 0) { start = this.target.length - start; }
        if (end < 0) { start = this.target.length - end; }
        end = Math.min(end, this.target.length);
        start = Math.min(start, this.target.length);
        if (start >= end) {
          return;
        }
        let removed = this.target.slice(target, target + end - start);
        let added = this.target.slice(start, end);
        let result = this.target.copyWithin(target, start, end);

        invalidateArrayObservers(this, "copyWithin");
        if (emitEvents) emitSpliceEvent(this, target, added, removed);

        return result;
      }
    };

    ['reverse', 'sort', 'fill'].forEach(function(functionName) {
      result[functionName] = function() {
        let argumentsArray = argumentsToArray(arguments);
        let removed = this.target.slice(0);
        let result = this.target[functionName]
            .apply(this.target, argumentsArray);

        invalidateArrayObservers(this, functionName);
        if (emitEvents) emitSpliceEvent(this, 0, removed, this.target.slice(0));

        return result;
      };
    });

    return result;
  }


  /***************************************************************
   *
   *  Non observables as value types
   *
   ***************************************************************/

  function sameAsPrevious(previousValue, newValue) {
    if (configuration.useNonObservablesAsValues) return sameAsPreviousDeep(previousValue, newValue, configuration.valueComparisonDepthLimit);
    return (previousValue === newValue || Number.isNaN(previousValue) && Number.isNaN(newValue));
  }

  function sameAsPreviousDeep(previousValue, newValue, valueComparisonDepthLimit) {
    if (typeof(valueComparisonDepthLimit) === "undefined") valueComparisonDepthLimit = 8;
    if (previousValue === null && newValue === null) return true;
    if ((previousValue === newValue || Number.isNaN(previousValue) && Number.isNaN(newValue))) return true;
    if (valueComparisonDepthLimit === 0) return false; // Cannot go further, cannot guarantee that they are the same.  
    if (typeof(previousValue) !== typeof(newValue)) return false; 
    if (typeof(previousValue) !== "object") return false;
    if ((previousValue === null) || (newValue === null)) return false; 
    if (isObservable(previousValue) || isObservable(newValue)) return false;
    if (Object.keys(previousValue).length !== Object.keys(newValue).length) return false; 
    for(let property in previousValue) {
      if (!sameAsPreviousDeep(previousValue[property], newValue[property], valueComparisonDepthLimit - 1)) {
        return false;
      }
    }
    return true;
  }


  /***************************************************************
   *
   *  Array Handlers
   *
   ***************************************************************/

  function getHandlerArray(target, key) {

    if (key === objectMetaProperty) {
      return this.meta;
    } else if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.get.apply(forwardToHandler, [forwardToHandler.target, key]);
    } 

    if (onReadGlobal && !onReadGlobal(this, target, key)) { 
      return cannotReadPropertyValue;
    }

    if (staticArrayOverrides[key]) {
      return staticArrayOverrides[key].bind(this);
    } else {
      if (state.inActiveRecording) recordDependencyOnArray(state.context, this);
      return target[key];
    }
  }

  function setHandlerArray(target, key, value) {
    if (key === objectMetaProperty) throw new Error("Cannot set the dedicated meta property '" + objectMetaProperty + "'");

    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.set.apply(forwardToHandler, [forwardToHandler.target, key, value]);
    }

    if (onWriteGlobal && !onWriteGlobal(this, target, key)) {
      return;
    } 

    let previousValue = target[key];

    // If same value as already set, do nothing.
    if (key in target) {
      if (sameAsPrevious(previousValue, value)) {
        return true;
      }
    }

    if (!isNaN(key)) {
      // Number index
      if (typeof(key) === 'string') {
        key = parseInt(key);
      }
      target[key] = value;

      if( target[key] === value || (
        Number.isNaN(target[key]) && Number.isNaN(value)) ) {
        invalidateArrayObservers(this, key);
        emitSpliceReplaceEvent(this, key, value, previousValue);
      }
    } else {
      // String index
      target[key] = value;
      if( target[key] === value || (Number.isNaN(target[key]) &&
                                    Number.isNaN(value)) ) {
        invalidateArrayObservers(this, key);
        emitSetEvent(this, key, value, previousValue);
      }
    }

    if( target[key] !== value && !(Number.isNaN(target[key]) &&
                                   Number.isNaN(value)) ) {
      return false;
    }
    
    return true;
  }

  function deletePropertyHandlerArray(target, key) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.deleteProperty.apply(
        forwardToHandler, [forwardToHandler.target, key]);
    }

    if (onWriteGlobal && !onWriteGlobal(this, target, key)) {
      return;
    } 

    if (!(key in target)) {
      return true;
    }

    let previousValue = target[key];
    delete target[key];
    if(!( key in target )) { // Write protected?
      invalidateArrayObservers(this, "delete");
      emitDeleteEvent(this, key, previousValue);
    }
    if( key in target ) return false; // Write protected?
    return true;
  }

  function ownKeysHandlerArray(target) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.ownKeys.apply(
        forwardToHandler, [forwardToHandler.target]);
    }

    if (onReadGlobal && !onReadGlobal(this, target)) { 
      return cannotReadPropertyValue;
    }

    if (state.inActiveRecording) recordDependencyOnArray(state.context, this);
    let result   = Object.keys(target);
    result.push('length');
    return result;
  }

  function hasHandlerArray(target, key) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.has.apply(forwardToHandler, [target, key]);
    }

    if (onReadGlobal && !onReadGlobal(this, target, key)) { 
      return cannotReadPropertyValue;
    }

    if (state.inActiveRecording) recordDependencyOnArray(state.context, this);
    return key in target;
  }

  function definePropertyHandlerArray(target, key, oDesc) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.defineProperty.apply(
        forwardToHandler, [forwardToHandler.target, key, oDesc]);
    }

    if (onWriteGlobal && !onWriteGlobal(this, target, key)) {
      return;
    } 

    invalidateArrayObservers(this, key);
    return target;
  }

  function getOwnPropertyDescriptorHandlerArray(target, key) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.getOwnPropertyDescriptor.apply(
        forwardToHandler, [forwardToHandler.target, key]);
    }

    if (onReadGlobal && !onReadGlobal(this, target, key)) { 
      return cannotReadPropertyValue;
    }

    if (state.inActiveRecording) recordDependencyOnArray(state.context, this);
    return Object.getOwnPropertyDescriptor(target, key);
  }


  /***************************************************************
   *
   *  Object Handlers
   *
   ***************************************************************/


  function getHandlerObject(target, key) {
    key = key.toString();
    // if (key === "parentPrimitive") {
    //   console.log("READING parentPrimitive");
    //   // if (currentRepeater && currentRepeater.description === "[row:46].buildDOMRepeater") {
    //   //   debugger;
    //   // }
    // }

    if (key === objectMetaProperty) {
      return this.meta;
    } else if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      let result = forwardToHandler.get.apply(forwardToHandler, [forwardToHandler.target, key]);
      return result;
    }
       
    if (onReadGlobal && !onReadGlobal(this, target, key)) { //Used for ensureInitialized, registerActivity & canRead 
      return cannotReadPropertyValue; 
    }

    if (typeof(key) !== 'undefined') {
      if (state.inActiveRecording) recordDependencyOnProperty(state.context, this, key);
      // use? && (typeof(target[key]) === "undefined" || Object.prototype.hasOwnProperty.call(target, key))

      let scan = target;
      while ( scan !== null && typeof(scan) !== 'undefined' ) {
        let descriptor = Object.getOwnPropertyDescriptor(scan, key);
        if (typeof(descriptor) !== 'undefined' &&
            typeof(descriptor.get) !== 'undefined') {
          return descriptor.get.bind(this.meta.proxy)();
        }
        scan = Object.getPrototypeOf( scan );
      }
      return target[key];
    }
  }

  function setHandlerObject(target, key, value) {
    if (key === objectMetaProperty) throw new Error("Cannot set the dedicated meta property '" + objectMetaProperty + "'");

    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.set.apply(forwardToHandler, [forwardToHandler.target, key, value]);
    }

    if (onWriteGlobal && !onWriteGlobal(this, target, key)) {
      return;
    } 

    let previousValue = target[key];

    // If same value as already set, do nothing.
    if (key in target) {
      if (sameAsPrevious(previousValue, value)) {
        return true;
      }
    } // TODO: It would be even safer if we write protected non observable data structures that are assigned, if we are using mode: useNonObservablesAsValues

    let undefinedKey = !(key in target);
    target[key]      = value;
    let resultValue  = target[key];
    if( resultValue === value || (Number.isNaN(resultValue) &&
                                  Number.isNaN(value)) ) {
      // Write protected?
      invalidatePropertyObservers(this, key);
      if (undefinedKey) invalidateEnumerateObservers(this, key);
    }

    emitSetEvent(this, key, value, previousValue);

    if( resultValue !== value  && !(Number.isNaN(resultValue) &&
                                    Number.isNaN(value))) return false;
    // Write protected?
    return true;
  }

  function deletePropertyHandlerObject(target, key) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      forwardToHandler.deleteProperty.apply(
        forwardToHandler, [forwardToHandler.target, key]);
      return true;
    }

    if (onWriteGlobal && !onWriteGlobal(this, target, key)) {
      return;
    } 

    if (!(key in target)) {
      return true;
    } else {
      let previousValue = target[key];
      delete target[key];
      if(!( key in target )) { // Write protected?
        invalidatePropertyObservers(this, key);
        invalidateEnumerateObservers(this, key);
        emitDeleteEvent(this, key, previousValue);
      }
      if( key in target ) return false; // Write protected?
      return true;
    }
  }

  function ownKeysHandlerObject(target, key) { // Not inherited?
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.ownKeys.apply(
        forwardToHandler, [forwardToHandler.target, key]);
    }

    if (onReadGlobal && !onReadGlobal(this, target, key)) { //Used for ensureInitialized, registerActivity & canRead 
      return cannotReadPropertyValue;
    }
 
    if (state.inActiveRecording) recordDependencyOnEnumeration(state.context, this);

    let keys = Object.keys(target);
    // keys.push('id');
    return keys;
  }

  function hasHandlerObject(target, key) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.has.apply(
        forwardToHandler, [forwardToHandler.target, key]);
    }

    if (onReadGlobal && !onReadGlobal(this, target, key)) { //Used for ensureInitialized, registerActivity & canRead 
      return cannotReadPropertyValue;
    }
 
    if (state.inActiveRecording) recordDependencyOnEnumeration(state.context, this)
    return key in target;
  }

  function definePropertyHandlerObject(target, key, descriptor) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.defineProperty.apply(
        forwardToHandler, [forwardToHandler.target, key]);
    }

    if (onWriteGlobal && !onWriteGlobal(this, target, key)) {
      return;
    }
 
    invalidateEnumerateObservers(this, "define property");
    return Reflect.defineProperty(target, key, descriptor);
  }

  function getOwnPropertyDescriptorHandlerObject(target, key) {
    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.getOwnPropertyDescriptor
        .apply(forwardToHandler, [forwardToHandler.target, key]);
    }

    if (onReadGlobal && !onReadGlobal(this, target, key)) { //Used for ensureInitialized, registerActivity & canRead 
      return cannotReadPropertyValue;
    }
 
    if (state.inActiveRecording) recordDependencyOnEnumeration(state.context, this)
    return Object.getOwnPropertyDescriptor(target, key);
  }


  /***************************************************************
   *
   *  Create
   *
   ***************************************************************/

  function isObservable(entity) {
    return entity !== null && typeof(entity) === "object" && typeof(entity[objectMetaProperty]) === "object" && entity[objectMetaProperty].world === world; 
  }


  function observable(createdRenderContext, buildId) {
    if (typeof(createdRenderContext) === 'undefined') {
      createdRenderContext = {};
    }
    if (typeof(createdRenderContext) !== "object") return createdRenderContext;
    if (typeof(buildId) === 'undefined') {
      buildId = null;
    }
    if (isObservable(createdRenderContext)) {
      throw new Error("Cannot observe an already observed object!");
    }

    let handler;
    if (createdRenderContext instanceof Array) {
      handler = {
        _arrayObservers : null,
        // getPrototypeOf: function () {},
        // setPrototypeOf: function () {},
        // isExtensible: function () {},
        // preventExtensions: function () {},
        // apply: function () {},
        // construct: function () {},
        get: getHandlerArray,
        set: setHandlerArray,
        deleteProperty: deletePropertyHandlerArray,
        ownKeys: ownKeysHandlerArray,
        has: hasHandlerArray,
        defineProperty: definePropertyHandlerArray,
        getOwnPropertyDescriptor: getOwnPropertyDescriptorHandlerArray
      };
    } else {
      handler = {
        // getPrototypeOf: function () {},
        // setPrototypeOf: function () {},
        // isExtensible: function () {},
        // preventExtensions: function () {},
        // apply: function () {},
        // construct: function () {},
        get: getHandlerObject,
        set: setHandlerObject,
        deleteProperty: deletePropertyHandlerObject,
        ownKeys: ownKeysHandlerObject,
        has: hasHandlerObject,
        defineProperty: definePropertyHandlerObject,
        getOwnPropertyDescriptor: getOwnPropertyDescriptorHandlerObject
      };
    }

    let proxy = new Proxy(createdRenderContext, handler);
    
    handler.target = createdRenderContext;
    handler.proxy = proxy;

    handler.meta = {
      world: world,
      id: "not yet", // Wait for rebuild analysis
      buildId : buildId,
      forwardTo : null,
      target: createdRenderContext,
      handler : handler,
      proxy : proxy,

      // Here to avoid prevent events being sent to objects being rebuilt. 
      isBeingRebuilt: false, 
    };

    if (state.inRepeater !== null) {
      const repeater = state.inRepeater;
      if (buildId !== null) {
        if (!repeater.newBuildIdObjectMap) repeater.newBuildIdObjectMap = {};
        if (repeater.buildIdObjectMap 
          && typeof(repeater.buildIdObjectMap[buildId]) !== 'undefined'
          && (!repeater.options.rebuildShapeAnalysis // Note: reject identity reuse if objects are too different (allowMatch() returns false)
            || !repeater.options.rebuildShapeAnalysis.allowMatch 
            || withoutRecording(
              () => repeater.options.rebuildShapeAnalysis.allowMatch(repeater.buildIdObjectMap[buildId], proxy)
            ))
          ) {

          // Build identity previously created
          handler.meta.isBeingRebuilt = true;
          let establishedObject = repeater.buildIdObjectMap[buildId];
          establishedObject[objectMetaProperty].forwardTo = proxy;
          if (repeater.options.rebuildShapeAnalysis) handler.meta.copyTo = establishedObject;
          
          handler.meta.id = "temp-" + state.nextTempObjectId++;
          repeater.newBuildIdObjectMap[buildId] = establishedObject;
          proxy = establishedObject;
          handler = proxy[objectMetaProperty].handler;
          emitReCreationEvent(establishedObject[objectMetaProperty].handler);
        } else {
          // Create a new one with build identity
          handler.meta.id = state.nextObjectId++;
          handler.meta.pendingOnEstablishCall = true; 
          repeater.newBuildIdObjectMap[buildId] = proxy;

          emitCreationEvent(handler);
        }
        if (repeater.options.rebuildShapeAnalysis) {
          if (!repeater.newIdObjectShapeMap) repeater.newIdObjectShapeMap = {};
          repeater.newIdObjectShapeMap[handler.meta.id] = proxy
        }
      } else if (repeater.options.rebuildShapeAnalysis){
        // No build identity but with shape analysis turned on. Could be a creation or recreation, so we have to postpone any event! 
        handler.meta.id = state.nextObjectId++;
        handler.meta.pendingCreationEvent = true; // We will remove this if we find a match!
        handler.meta.pendingOnEstablishCall = true; // We will remove this if we find a match! 
        if (!repeater.newIdObjectShapeMap) repeater.newIdObjectShapeMap = {};
        repeater.newIdObjectShapeMap[handler.meta.id] = proxy
      } else {
        // No build identity and no shape analysis! As a normal creation! 
        handler.meta.id = state.nextObjectId++;
        emitCreationEvent(handler);  
      }
    } else {
      handler.meta.id = state.nextObjectId++;
      emitCreationEvent(handler);
    }
    return proxy;
  }

  function deeplyObservable(object, copy) {
    // console.log("deeplyObservable");
    // console.log(object);
    if (isObservable(object)) return object; 
    if (typeof(object) !== "object" || object === null) return object;
    let target; 
    if (copy) {
      const objectCopy = object instanceof Array ? [] : {};
      for (let property in object) {
        objectCopy[property] = deeplyObservable(object[property], copy);
      }
      target = objectCopy; 
    } else {
      target = object; 
      for (let property in object) {
        target[property] = deeplyObservable(target[property], copy);
      }
    }
    return observable(target);
  }
  


  /**********************************
   *
   *  Emit events & onChange
   *
   **********************************/

  function emitSpliceEvent(handler, index, removed, added) {
    if (emitEvents) {
      emitEvent(handler, {type: 'splice', index, removed, added});
    }
  }

  function emitSpliceReplaceEvent(handler, key, value, previousValue) {
    if (emitEvents) {
      emitEvent(handler, {
        type: 'splice',
        index: key,
        removed: [previousValue],
        added: [value] });
    }
  }

  function emitSetEvent(handler, key, value, previousValue) {
    if (emitEvents) {
      emitEvent(handler, {
        type: 'set',
        property: key,
        newValue: value,
        oldValue: previousValue});
    }
  }

  function emitDeleteEvent(handler, key, previousValue) {
    if (emitEvents) {
      emitEvent(handler, {
        type: 'delete',
        property: key,
        deletedValue: previousValue});
    }
  }

  function emitReCreationEvent(handler) {
    if (emitEvents) {
      emitEvent(handler, {type: 'reCreate'})
    }
  }

  function emitCreationEvent(handler) {
    if (emitEvents) {
      emitEvent(handler, {type: 'create'})
    }
  }
  
  function emitDisposeEvent(handler) {
    if (emitEvents) {
      emitEvent(handler, {type: 'dispose'})
    }
  }

  function emitEvent(handler, event) {
    event.object = handler.meta.proxy;
    event.objectId = handler.meta.id;

    if (!emitReBuildEvents && handler.meta.isBeingRebuilt) {
      return;
    }

    if (onEventGlobal) {
      onEventGlobal(event);
    }

    if (sendEventsToObjects && typeof(handler.target.onChange) === 'function') { // Consider. Put on queue and fire on end of reaction? onReactionEnd onTransactionEnd 
      handler.target.onChange(event);
    }
  }


  /**********************************
   *
   *   Reactive observers
   *
   **********************************/

  function proceedWithPostponedInvalidations() {
    if (state.postponeInvalidation == 0) {
      state.postponeRefreshRepeaters++;
      while (state.nextObserverToInvalidate !== null) {
        let observer = state.nextObserverToInvalidate; 
        state.nextObserverToInvalidate = null; 
        const nextToNotify = observer.nextToNotify; 
        if (nextToNotify) {
          observer.nextToNotify = null;
          state.nextObserverToInvalidate = nextToNotify;
        } else {
          state.lastObserverToInvalidate = null; 
        }
        // blockSideEffects(function() {
        observer.invalidateAction();
        exitPriorityLevel(observer);
        // });
      }
      state.postponeRefreshRepeaters--;
      refreshAllDirtyRepeaters();
    }
  }

  function invalidateObserver(observer, proxy, key) {
    let observerActive = false
    let scannedContext = state.context;
    while(scannedContext) {
      if (scannedContext === observer) {
        observerActive = true;
        break;
      }
      scannedContext = scannedContext.parent;
    } 

    if (!observerActive) {
      // if( trace.contextMismatch && state.context && state.context.id ){
      //   console.log("invalidateObserver mismatch " + observer.type, observer.id||'');
      //   if( !state.context ) console.log('current state.context null');
      //   else {
      //     console.log("current state.context " + state.context.type, state.context.id||'');
      //     if( state.context.parent ){
      //       console.log("parent state.context " + state.context.parent.type, state.context.parent.id||'');
      //     }
      //   }
      // }
      
      observer.invalidatedInContext = state.context;
      observer.invalidatedByKey = key;
      observer.invalidatedByObject = proxy;
      observer.dispose(); // Cannot be any more dirty than it already is!

      if (state.postponeInvalidation > 0) {
        enterPriorityLevel(observer);
        if (state.lastObserverToInvalidate !== null) {
          state.lastObserverToInvalidate.nextToNotify = observer;
        } else {
          state.nextObserverToInvalidate = observer;
        }
        state.lastObserverToInvalidate = observer;
      } else {
        // blockSideEffects(function() {
        observer.invalidateAction(key);
        // });
        // });
      }
    }
  }

    // From observed object
  // let observerSetContents = getMap(
  // observerSet, 'contents');
  // if (typeof(observerSet['contents'])) {
  ////! Should not be needed
  //     observerSet['contents'] = {};
  // }


  /**********************************
   *
   *  invalidateOnChange.
   *
   **********************************/

  function defaultCreateInvalidator(description, doAfterChange) {
    return {
      createdCount:0,
      createdTemporaryCount:0,
      removedCount:0,
      isRecording: true,  
      type: 'invalidator',
      id: state.observerId++,
      description: description,
      sources : [],
      nextToNotify: null,
      invalidateAction: doAfterChange,
      dispose : function() {
        removeAllSources(this);
      },
      record : function( action ){
        if( state.context == this || this.isRemoved ) return action();
        const activeContext = enterContext(this);
        const value = action();
        leaveContext( activeContext );
        return value;
      },
      returnValue: null,
      causalityString() {
        return "<invalidator>" + this.invalidateAction
      }
    }
  }


  function invalidateOnChange() {
    // description(optional), doFirst, doAfterChange. doAfterChange
    // cannot modify model, if needed, use a repeater instead.
    // (for guaranteed consistency)

    // Arguments
    let doFirst;
    let doAfterChange;
    let description = null;
    if (arguments.length > 2) {
      description   = arguments[0];
      doFirst       = arguments[1];
      doAfterChange = arguments[2];
    } else {
      if (requireInvalidatorName) throw new Error("Missing description for 'invalidateOnChange'")
      doFirst       = arguments[0];
      doAfterChange = arguments[1];
    }

    // Recorder context
    const invalidator = createInvalidator(description, doAfterChange)
    enterContext(invalidator);
    invalidator.returnValue = doFirst( invalidator );
    leaveContext(invalidator);

    return invalidator;
  }



  /**********************************
   *
   *   Repetition
   *
   **********************************/


  function defaultCreateRepeater(description, repeaterAction, repeaterNonRecordingAction, options, finishRebuilding) {
    return {
      createdCount:0,
      createdTemporaryCount:0,
      removedCount:0,
      isRecording: true,  
      type: "repeater", 
      id: state.observerId++,
      firstTime: true, 
      description: description,
      sources : [],
      nextToNotify: null,
      repeaterAction : modifyRepeaterAction(repeaterAction, options),
      nonRecordedAction: repeaterNonRecordingAction,
      options: options ? options : {},
      finishRebuilding() {
          finishRebuilding(this);
      },
      priority() {
        return typeof(this.options.priority) !== "undefined" ? this.options.priority : 0; 
      },
      causalityString() {
        const context = this.invalidatedInContext;
        const object = this.invalidatedByObject;
        if (!object) return "Repeater started: " + this.description 
        const key = this.invalidatedByKey; 
        // let objectClassName;
        // withoutRecording(() => {
        //   objectClassName = object.constructor.name;
        // });

        const contextString = (context ? context.description : "outside repeater/invalidator") 
        // const causeString = objectClassName + ":" + (object.causality.buildId ? object.causality.buildId : object.causality.id) + "." + key + " (modified)";
        const causeString = "  " + object.toString() + "." + key + "";
        const effectString = "" + this.description + "";

        return "(" + contextString + ")" + causeString + " --> " +  effectString;
      },
      creationString() {
        let result = "{";
        result += "created: " + this.createdCount + ", ";
        result += "createdTemporary:" + this.createdTemporaryCount + ", ";
        result += "removed:" + this.removedCount + "}";
        return result;
      },
      sourcesString() {
        let result = "";
        for (let source of this.sources) {
          while (source.parent) source = source.parent;
          result += source.handler.proxy.toString() + "." + source.key + "\n";
        }
        return result;
      },
      restart() {
        this.invalidateAction();
      },
      invalidateAction() {
        removeAllSources(this);
        repeaterDirty(this);
        this.disposeChildren();
      },
      // disposeAllCreatedWithBuildId() {
      //   // Dispose all created objects? 
      //   if(this.buildIdObjectMap) {
      //     for (let key in this.buildIdObjectMap) {
      //       const object = this.buildIdObjectMap[key]; 
      //       if (typeof(object.onDispose) === "function") object.onDispose();
      //     }
      //   }
      // },
      dispose() {
        detatchRepeater(this);
        removeAllSources(this);
        this.disposeChildren();
      },
      notifyDisposeToCreatedObjects() {
        if (this.idObjectShapeMap) {
          for(let id in this.idObjectShapeMap) {
            let object = this.idObjectShapeMap[id];
  
            // Send dispose event
            if (typeof(object[objectMetaProperty].target.onDispose) === "function") {
              object.onDispose();
            }
          }
        } else if (this.buildIdObjectMap) {
          for (let key in this.buildIdObjectMap) {
            const object = this.buildIdObjectMap[key]; 
            if (typeof(object.onDispose) === "function") object.onDispose();
          }
        }
      },
      disposeChildren() {
        if (this.children) {
          this.children.forEach(child => child.dispose());
          this.children = null; 
        }        
      },
      addChild(child) {
        if (!this.children) this.children = [];
        this.children.push(child);
      },
      nextDirty : null,
      previousDirty : null,
      lastRepeatTime: 0,
      waitOnNonRecordedAction: 0,
      children: null,
      refresh() {       
        const repeater = this; 
        const options = repeater.options;
        if (options.onRefresh) options.onRefresh(repeater);
        
        repeater.finishedRebuilding = false; 
        repeater.createdCount = 0;
        repeater.createdTemporaryCount = 0;
        repeater.removedCount = 0; 

        // Recorded action (cause and/or effect)
        repeater.isRecording = true; 
        const activeContext = enterContext(repeater);
        repeater.returnValue = repeater.repeaterAction(repeater);
        repeater.isRecording = false; 
        updateContextState()

        // Non recorded action (only effect)
        const { debounce=0, fireImmediately=true } = options; 
        if (repeater.nonRecordedAction !== null) {
          if (debounce === 0 || this.firstTime) {
            if (fireImmediately || !this.firstTime) repeater.nonRecordedAction( repeater.returnValue );
          } else {
            if (repeater.waitOnNonRecordedAction) clearTimeout(repeater.waitOnNonRecordedAction);
            repeater.waitOnNonRecordedAction = setTimeout(() => {
              repeater.nonRecordedAction( repeater.returnValue );
              repeater.waitOnNonRecordedAction = null;
            }, debounce);
          }
        } else if (debounce > 0) {
          throw new Error("Debounce has to be used together with a non-recorded action.");
        }

        // Finish rebuilding
        finishRebuilding(this);

        this.firstTime = false; 
        leaveContext( activeContext );
        return repeater;
      }
    }
  }

  function reBuildShapeAnalysis(repeater) {
    const shapeAnalysis = repeater.options.rebuildShapeAnalysis
    
    function setAsMatch(establishedObject, newObject) {
      //console.log("setAsMatch: " + establishedObject.toString() + " <---- " + newObject.toString());
      establishedObject[objectMetaProperty].forwardTo = newObject;
      newObject[objectMetaProperty].copyTo = establishedObject;
      if (newObject[objectMetaProperty].pendingCreationEvent) {
        delete newObject[objectMetaProperty].pendingCreationEvent;
        establishedObject[objectMetaProperty].pendingReCreationEvent = true;
      } 
      delete newObject[objectMetaProperty].pendingOnEstablishCall;
      delete repeater.newIdObjectShapeMap[newObject[objectMetaProperty].id];
      repeater.newIdObjectShapeMap[establishedObject[objectMetaProperty].id] = establishedObject;
    }

    function matchInEquivalentSlot(establishedObject, newObject) {
      if (establishedObject !== newObject) { // Could be the same if buildId was used
        const newObjectObservable = isObservable(newObject);
        const establishedObjectObservable = isObservable(establishedObject); 
        if (newObjectObservable !== establishedObjectObservable) return;
        if (newObjectObservable && establishedObjectObservable) {
          // Two observed objects
          if (!repeater.newIdObjectShapeMap[newObject[objectMetaProperty].id]) return; // Limit search! otherwise we could go off road!
          if (establishedObject[objectMetaProperty].forwardTo === newObject) return; // Already set as match during shape analysis! 
          if (newObject[objectMetaProperty].buildId || establishedObject[objectMetaProperty].buildId) return;
          if (shapeAnalysis.allowMatch && shapeAnalysis.allowMatch(establishedObject, newObject)) {
            setAsMatch(establishedObject, newObject);
            // console.log({...establishedObject[objectMetaProperty].target});
            // console.log({...newObject[objectMetaProperty].target});
            // console.log(establishedObject[objectMetaProperty].target === newObject[objectMetaProperty].target);
            matchChildrenInEquivalentSlot(establishedObject[objectMetaProperty].target, newObject[objectMetaProperty].target);
          }
        } else { //if (!newObjectObservable && !establishedObjectObservable) 
          // Could run off-road?
          // Two unobserved objects
          matchChildrenInEquivalentSlot(establishedObject, newObject)
        }
      }
    }

    function matchChildrenInEquivalentSlot(establishedObjectRenderContext, newObjectRenderContext) {
      for (let [establishedSlot, newSlot] of shapeAnalysis.slotsIterator(establishedObjectRenderContext, newObjectRenderContext, object => (isObservable(object) && object[objectMetaProperty].buildId))) {
        matchInEquivalentSlot(establishedSlot, newSlot);
      }
    }
    return {setAsMatch, matchChildrenInEquivalentSlot, matchInEquivalentSlot};
  }

  function finishRebuilding(repeater) {
    if (repeater.finishedRebuilding) return; 
    
    const options = repeater.options;
    if (options.onStartBuildUpdate) options.onStartBuildUpdate();

    function translateReference(reference) {
      if (reference instanceof Array) {
        return reference.map(fragment => translateReference(fragment));
      }
      if (isObservable(reference)) {
        if (reference[objectMetaProperty].copyTo) {
          return reference[objectMetaProperty].copyTo;
        }
      }
      return reference;
    }

    // Do shape analysis to find additional matches. 
    if (repeater.options.rebuildShapeAnalysis) {
      const {matchChildrenInEquivalentSlot, matchInEquivalentSlot} = reBuildShapeAnalysis(repeater);
      const shapeAnalysis = repeater.options.rebuildShapeAnalysis;
      
      // console.group("reBuildShapeAnalysis");
      if (repeater.establishedRoot instanceof Array || shapeAnalysis.shapeRoot() instanceof Array) {
        // If one shape root is array, compare as arrays.
        let establishedRootArray = repeater.establishedRoot;
        let shapeRootArray = shapeAnalysis.shapeRoot();
        if (!(establishedRootArray instanceof Array)) establishedRootArray = [establishedRootArray];
        if (!(shapeRootArray instanceof Array)) shapeRootArray = [shapeRootArray];
        matchChildrenInEquivalentSlot(establishedRootArray, shapeRootArray)
      } else {
        // Match two ordinary shape roots
        matchInEquivalentSlot(repeater.establishedShapeRoot, shapeAnalysis.shapeRoot());
      }
      for(let id in  repeater.newIdObjectShapeMap) {
        const newObject = repeater.newIdObjectShapeMap[id];
        const temporaryObject = newObject[objectMetaProperty].forwardTo;
        if (temporaryObject) {
          matchChildrenInEquivalentSlot(newObject[objectMetaProperty].target, temporaryObject[objectMetaProperty].target);
        }
      }
      // console.groupEnd();


      // Debug printout
      // console.log("Reference translatinos: ")
      // for(let id in  repeater.newIdObjectShapeMap) {
      //   const newObject = repeater.newIdObjectShapeMap[id];
      //   if (newObject[objectMetaProperty].forwardTo){
      //     // console.log(newObject[objectMetaProperty].forwardTo.toString() + "==>" + newObject.toString());
      //   }
      // }

      // Translate references
      for(let id in repeater.newIdObjectShapeMap) {
        let object = repeater.newIdObjectShapeMap[id];
        let target;
        const temporaryObject = object[objectMetaProperty].forwardTo; 
        if (temporaryObject) {
          target = temporaryObject[objectMetaProperty].target;
        } else {
          target = object[objectMetaProperty].target;
        }
        if (repeater.options.rebuildShapeAnalysis.translateReferences) {
          repeater.options.rebuildShapeAnalysis.translateReferences(target, translateReference);
        } else {
          for (let property in target) {
            target[property] = translateReference(target[property])
          }
        }
      }

      // Save translated root for next run
      repeater.establishedShapeRoot = translateReference(repeater.options.rebuildShapeAnalysis.shapeRoot())

      // Merge those set for mergeing
      for(let id in repeater.newIdObjectShapeMap) {
        let object = repeater.newIdObjectShapeMap[id];
        const temporaryObject = object[objectMetaProperty].forwardTo;
        if (temporaryObject) {
          temporaryObject[objectMetaProperty].copyTo = null;
          object[objectMetaProperty].forwardTo = null;
          mergeInto(object, temporaryObject[objectMetaProperty].target);

          // Send recreate event
          if (object[objectMetaProperty].pendingCreationEvent) {
            delete object[objectMetaProperty].pendingCreationEvent;
            emitReCreationEvent(object[objectMetaProperty].handler);
          }
        } else {
          // Send create event
          if (object[objectMetaProperty].pendingCreationEvent) {
            delete object[objectMetaProperty].pendingCreationEvent;
            emitCreationEvent(object[objectMetaProperty].handler);
          }

          // Send establish event
          sendOnEstablishedEvent(object);
        }
      }

      // Send dispose event
      if (repeater.idObjectShapeMap) {
        for (let id in repeater.idObjectShapeMap) {
          if (typeof(repeater.newIdObjectShapeMap[id]) === "undefined") {
            const object = repeater.idObjectShapeMap[id];
            const objectRenderContext = object[objectMetaProperty].target;
            // console.log("Dispose object: " + objectRenderContext.constructor.name + "." + object[objectMetaProperty].id)
            emitDisposeEvent(object[objectMetaProperty].handler);
            if (typeof(objectRenderContext.onDispose) === "function") object.onDispose();
          }
        }
      }
    } else {
      // Merge those with build ids. 
      for (let buildId in repeater.newBuildIdObjectMap) {
        let created = repeater.newBuildIdObjectMap[buildId];
        const temporaryObject = created[objectMetaProperty].forwardTo;
        if (temporaryObject !== null) {
          // Push changes to established object.
          created[objectMetaProperty].forwardTo = null;
          // created[objectMetaProperty].isBeingRebuilt = false; // Consider? Should this be done on 
          temporaryObject[objectMetaProperty].isBeingRebuilt = false; 
          mergeInto(created, temporaryObject[objectMetaProperty].target);
        } else {
          // Send establish event
          sendOnEstablishedEvent(created)
        }
      }

      // Send dispose messages
      if (repeater.buildIdObjectMap) {
        for (let buildId in repeater.buildIdObjectMap) {
          if (typeof(repeater.newBuildIdObjectMap[buildId]) === "undefined") {
            const object = repeater.buildIdObjectMap[buildId];
            const objectRenderContext = object[objectMetaProperty].target;
            // console.log("Dispose object: " + objectRenderContext.constructor.name + "." + object[objectMetaProperty].id)
            emitDisposeEvent(object[objectMetaProperty].handler);
            if (typeof(objectRenderContext.onDispose) === "function") objectRenderContext.onDispose();
          }
        }
      }
    }
    
    // Set new buildId map
    repeater.buildIdObjectMap = repeater.newBuildIdObjectMap;
    repeater.newBuildIdObjectMap = {};

    // Set new id map
    repeater.idObjectShapeMap = repeater.newIdObjectShapeMap;
    repeater.newIdObjectShapeMap = {};
    
    repeater.finishedRebuilding = true;
    if (options.onEndBuildUpdate) options.onEndBuildUpdate();
  }

  function sendOnEstablishedEvent(object) {
    const objectMeta = object[objectMetaProperty]
    if (objectMeta.pendingOnEstablishCall || !objectMeta.established) {
      delete objectMeta.pendingOnEstablishCall;
      objectMeta.established = true; 
      if (typeof(objectMeta.target.onEstablish) === "function"){
        object.onEstablish();  
      }
    } 
  }

  function finalize(object) {
    // Note: We cannot throw error if no build id, as this might be called externally with non-build id objects
    // Note: This might be inside the first run, so we cannot assume a temporary object. 
    // Note: We cannot make any sensible test if we are in a repeater, since we do not know the identity of the repeater anyway 
    const temporaryObject = object[objectMetaProperty].forwardTo;
    if (temporaryObject !== null) {
      
      if (state.inRepeater) {
        // console.group("reBuildShapeAnalysis");
        const repeater = state.context;
        if (repeater.options.rebuildShapeAnalysis) {
          const {matchChildrenInEquivalentSlot} = reBuildShapeAnalysis(repeater);
          matchChildrenInEquivalentSlot(object[objectMetaProperty].target, temporaryObject[objectMetaProperty].target);
        }
        // console.groupEnd();
      }

      // A re-build, push changes to established object.
      object[objectMetaProperty].forwardTo = null;
      temporaryObject[objectMetaProperty].isBeingRebuilt = false; 
      mergeInto(object, temporaryObject[objectMetaProperty].target);

      

    } else {
      // A new build, send create on establish message (if we were just created with key in a repeater)
      sendOnEstablishedEvent(object);
    }

    return object; 
  }

  function modifyRepeaterAction(repeaterAction, {throttle=0}) {
    if (throttle > 0) {
      return function(repeater) {
        let time = Date.now();
        const timeSinceLastRepeat = time - repeater.lastRepeatTime;
        if (throttle > timeSinceLastRepeat) {
          const waiting = throttle - timeSinceLastRepeat;
          setTimeout(() => { repeater.restart() }, waiting);
        } else {
          repeater.lastRepeatTime = time;
          return repeaterAction();
        }
      }
    } 

    return repeaterAction;
  }

  function repeat() { // description(optional), action
    // Arguments
    let description = '';
    let repeaterAction;
    let repeaterNonRecordingAction = null;
    let options;

    const args = (arguments.length === 1 ?
                  [arguments[0]] :
                  Array.apply(null, arguments));
    
    if (typeof(args[0]) === 'string') {
      description = args.shift();
    } else if (requireRepeaterName) {
      throw new Error("Every repeater has to be given a name as first argument. Note: This requirement can be removed in the configuration.");
    }

    if (typeof(args[0]) === 'function') {
      repeaterAction = args.shift();
    }

    if (typeof(args[0]) === 'function' || args[0] === null) {
      repeaterNonRecordingAction = args.shift();
    }
    
    if (typeof(args[0]) === 'object') {
      options = args.shift();
    }
    if (!options) options = {};

    if( warnOnNestedRepeater && state.inActiveRecording ){
      let parentDesc = state.context.description;
      if( !parentDesc && state.context.parent ) parentDesc = state.context.parent.description;
      if( !parentDesc ){
        parentDesc = 'unnamed';
      }
      if (configuration.traceWarnings) console.warn(Error(`repeater ${description||'unnamed'} inside active recording ${parentDesc}`));
    }
    
    // Activate!
    const repeater = createRepeater(description, repeaterAction, repeaterNonRecordingAction, options, finishRebuilding);
    if (state.context && state.context.type === "repeater" && (options.dependentOnParent || configuration.alwaysDependOnParentRepeater)) {
      state.context.addChild(repeater);
    }
    return repeater.refresh();
  }


  function repeaterDirty(repeater) { // TODO: Add update block on this stage?
    repeater.dispose();
    const priority = repeater.priority();
    enterPriorityLevel(priority);
    // disposeChildContexts(repeater);
    // disposeSingleChildContext(repeater);
    
    const priorityList = state.dirtyRepeaters;

    const list = priorityList[priority];
    if (list.last === null) {
      list.last = repeater;
      list.first = repeater;
    } else {
      list.last.nextDirty = repeater;
      repeater.previousDirty = list.last;
      list.last = repeater;
    }

    refreshAllDirtyRepeaters();
  }
  
  function clearRepeaterLists() {
    state.observerId = 0;
    state.dirtyRepeaters.map(list => {list.first = null; list.last = null;});
  }

  function detatchRepeater(repeater) {
    const priority = repeater.priority(); // repeater
    const list = state.dirtyRepeaters[priority];
    if (list.last === repeater) {
      list.last = repeater.previousDirty;
    }
    if (list.first === repeater) {
      list.first = repeater.nextDirty;
    }
    if (repeater.nextDirty) {
      repeater.nextDirty.previousDirty = repeater.previousDirty;
    }
    if (repeater.previousDirty) {
      repeater.previousDirty.nextDirty = repeater.nextDirty;
    }
    repeater.nextDirty = null;
    repeater.previousDirty = null;
  }

  function anyDirtyRepeater(start=0) {
    const priorityList = state.dirtyRepeaters; 
    let priority = start; 
    while(priority < priorityList.length) {
      if (priorityList[priority].first !== null) {
        return true; 
      }
      priority++;
    }
    return false; 
  }

  function firstDirtyRepeater() {
    const priorityList = state.dirtyRepeaters;
    
    // Find work in unlocked level
    let priority = state.revalidationLevelLock + 1;
    while (priority < priorityList.length) {
      if (priorityList[priority].first) {
        return priorityList[priority].first;
      }
      priority++;
    }

    // Nothing found, reset lock and start again! 
    state.revalidationLevelLock = -1;
    priority = state.revalidationLevelLock + 1;
    while (priority < priorityList.length) {
      if (priorityList[priority].first) {
        return priorityList[priority].first;
      }
      priority++;
    }

    return null; 
  }

  // let currentRepeater= null; 

  function refreshAllDirtyRepeaters() {
    if (state.postponeRefreshRepeaters === 0) {
      if (!state.refreshingAllDirtyRepeaters) {
        if (anyDirtyRepeater()) {
          state.refreshingAllDirtyRepeaters = true;
          while (anyDirtyRepeater()) {
            let repeater = firstDirtyRepeater();
            // currentRepeater = repeater; 
            repeater.refresh();
            detatchRepeater(repeater);
            exitPriorityLevel(repeater.priority());
          }
  
          state.refreshingAllDirtyRepeaters = false;
        }
      }  
    }
  }

  /***************************************************************
   *
   *  Debugging
   *
   ***************************************************************/
   
  function log(entity, pattern) {
    state.recordingPaused++;
    updateContextState();
    usedObjectlog.log(entity, pattern);
    // console.log(entity, pattern);
    state.recordingPaused--;  
    updateContextState();
  }
  
  function logGroup(entity, pattern) {
    state.recordingPaused++;
    updateContextState();
    usedObjectlog.group(entity, pattern);
    state.recordingPaused--;
    updateContextState();
  } 
  
  function logUngroup() {
    usedObjectlog.groupEnd(); 
  } 

  function logToString(entity, pattern) {
    state.recordingPaused++;
    updateContextState();
    let result = usedObjectlog.logToString(entity, pattern);
    state.recordingPaused--;
    updateContextState();
    return result;
  }


  /************************************************************************
   *
   *  Return world
   *
   ************************************************************************/

  return world;
}
  
let worlds = {};

export function getWorld(configuration) {
  if(!configuration) configuration = {};
  configuration = {...defaultConfiguration, ...configuration};
  const signature = configSignature(configuration);
  
  if (typeof(worlds[signature]) === 'undefined') {
    worlds[signature] = createWorld(configuration);
  }
  return worlds[signature];
}

export default getWorld;