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

  timeLevels: 4, 

  objectMetaProperty: "causality",
  objectTimelinesProperty: "timelines",

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
    dirtyRepeaters: [...Array(configuration.timeLevels).keys()].map(() => ({first: null, last: null})),
    refreshingAllDirtyRepeaters: false,
    workOnTimeLevel: [...Array(configuration.timeLevels).keys()].map(() => 0),
    revalidationTimeLock: -1,
  };

  // Reserved key for each object handler's enumeration timeline (tracks
  // "who enumerated this object's keys", invalidated when a property is
  // defined or removed). A Symbol so it can never collide with a real
  // property name inside handler.timelines.
  const enumerationTimelineKey = Symbol("timelines.enumeration");


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
    linkRepeater,
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
    getOrCreateTimelineWriting,
    getOrCreateEnumerationTimelineWriting,
    seekTimelineWriting: seekWriting,
    enumerationTimelineKey,
    proceedWithPostponedInvalidations, 
    nextObserverId: () => { return state.observerId++ },

    // Libraries
    caching: createCachingFunction(observable),

    // Time levels 
    enterTimeLevel,
    exitTimeLevel,
    workOnTimeLevel
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
  const invalidateWritingObservers = dependencyInterface.invalidateWritingObservers;
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
    objectTimelinesProperty,
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
   *   Time Levels
   *
   **********************************/

  function enterTimeLevel(level) {
    if (typeof(level) !== "number") {
      const context = level; 
      level = (typeof(context.time) === "function") ? context.time() : 0;
    }
    state.workOnTimeLevel[level]++
  } 

  function exitTimeLevel(level) {
    if (typeof(level) !== "number") {
      const context = level; 
      level = (typeof(context.time) === "function") ? context.time() : 0;
    }
    state.workOnTimeLevel[level]--

    // Handle finished time levels. 
    let first = true;  
    while (level < state.workOnTimeLevel.length && state.workOnTimeLevel[level] === 0) {
      // if (!first) logMark("No work on next level, signaling early finish.");
      if (typeof(configuration.onFinishedTimeLevel) === "function") {
        configuration.onFinishedTimeLevel(level, first);
      }
      state.revalidationTimeLock = level;
      level++;
      first = false;  
    }
  } 

  function workOnTimeLevel(level, action) {
    enterTimeLevel(level);
    action();
    exitTimeLevel(level);
  }


  /**********************************
   *
   *   Causality Global stacklets
   *
   **********************************/

  function updateContextState() {
    state.inActiveRecording = state.context !== null && state.context.isRecording && state.recordingPaused === 0;
    state.inRepeater = (state.context && state.context.type === "partial") ? state.context.repeater : null;
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
    enterTimeLevel(enteredContext);
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
    exitTimeLevel(activeContext);
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
   *  Timelines
   *
   *  Storage for plain object properties is virtualized: instead of
   *  living directly on `target`, each property's value lives in a
   *  "writing" node on a per-property timeline - a linked list of
   *  writings ordered by time. A repeater/invalidator reads and writes
   *  at its own declared `time` (0 by default); reading resolves to the
   *  writing with the largest `time <= requested`.
   *
   *  A writing represents either a set (`set: true`, carrying a value,
   *  which may itself be `undefined`) or an unset (`set: false`) - i.e.
   *  "no value" is a distinct writing kind, not just an absent/missing
   *  value, so that an explicit `obj.a = undefined` can be told apart
   *  from `obj.a` never having been assigned, or having been deleted.
   *
   *  Besides one timeline per property, each handler also gets a single
   *  reserved enumeration timeline (keyed by `enumerationTimelineKey`, a
   *  Symbol so it can never collide with a real property name) whose
   *  writing only ever carries observers, never a value - it exists
   *  purely to track "who enumerated this object's keys" so they can be
   *  invalidated when a property is defined or removed.
   *
   ***************************************************************/

  function createTimelineWriting(time, writer) {
    return {
      time: time,
      // Which partial (or null, for external code) actually made this
      // writing - the tie-breaker when two writings share the same
      // declared `time` number (a parent and child defaulting to the same
      // level, most commonly) - see comparePositions()/compareWriterOrder()
      // below.
      writer: typeof(writer) === 'undefined' ? null : writer,
      value: undefined,
      set: false,
      observers: null,
      timeline: null,
      next: null,
      previous: null,
    };
  }

  function createTimeline(handler, key) {
    const writing = createTimelineWriting(0, null);
    const timeline = {
      key: key,
      handler: handler,
      first: writing,
      last: writing,
      // Cache pointer at the writing a reader/writer should start seeking
      // from - amortizes the common case where reads/writes at nearby
      // times cluster together, instead of always walking from `first`.
      currentWriting: writing,
    };
    writing.timeline = timeline;
    return timeline;
  }

  // Every writing has been retracted - reinstate a fresh time-0 anchor so
  // there is always somewhere to hang a dependency for future reads.
  function reanchorEmptyTimeline(timeline) {
    const writing = createTimelineWriting(0, null);
    writing.timeline = timeline;
    timeline.first = writing;
    timeline.last = writing;
    timeline.currentWriting = writing;
  }

  function getOrCreateTimeline(handler, key) {
    let timeline = handler.timelines[key];
    if (typeof(timeline) === 'undefined') {
      timeline = handler.timelines[key] = createTimeline(handler, key);
    } else if (timeline.first === null) {
      reanchorEmptyTimeline(timeline);
    }
    return timeline;
  }

  /***************************************************************
   *
   *  Time as tree position
   *
   *  Repeaters form a forest: independent top-level repeaters each have a
   *  flat declared `time` (stage1/stage2/etc.), but a repeater created *as
   *  a child* has its own declared time entirely superseded by its
   *  position in the tree - a parent's time is really an interval its
   *  children subdivide. Two writings/positions are compared by their
   *  declared `time` number first; only when those are equal (a parent and
   *  child sharing a level, most commonly both defaulting to 0) does tree
   *  position break the tie. "Stupid" by design for now: plain tree
   *  traversal, no order-maintenance optimization - see
   *  docs/plan-partial-repeaters.md.
   *
   ***************************************************************/

  // Path from `writer` (a partial, or null for external) up to its
  // top-level root, deepest first: [writer, writer's repeater, that
  // repeater's parentRepeater, ...] up to a repeater with no parent.
  function writerPathToRoot(writer) {
    const path = [];
    let node = writer;
    while (node) {
      path.push(node);
      node = (node.type === "partial") ? node.repeater : node.parentRepeater;
    }
    return path;
  }

  // Which of `nodeA`/`nodeB` (both direct children - partials or repeaters -
  // of `parentRepeater`) comes first in its children list. Checks both
  // `children` and `pendingChildren`, since a node can transiently sit in
  // either mid-reconciliation. If one of them isn't found in either list at
  // all (a stale reference to a partial from an already-finalized past run
  // of the same repeater - see findExactWriting), treats them as equal
  // rather than guessing an order - only a node that's actually still
  // somewhere in the tree can be sensibly ordered against another.
  function compareSiblingOrder(parentRepeater, nodeA, nodeB) {
    let foundA = false;
    let foundB = false;
    let list = parentRepeater.children.first;
    while (list !== null) {
      if (list === nodeA) { if (foundB) return 1; foundA = true; }
      if (list === nodeB) { if (foundA) return -1; foundB = true; }
      list = list.nextSibling;
    }
    list = parentRepeater.pendingChildren.first;
    while (list !== null) {
      if (list === nodeA) { if (foundB) return 1; foundA = true; }
      if (list === nodeB) { if (foundA) return -1; foundB = true; }
      list = list.nextSibling;
    }
    return 0;
  }

  // Order two writers sharing the same declared time. External (null)
  // always sorts first, matching "external writes are initialization".
  // Otherwise walks both writers' paths to their shared root, finds where
  // they diverge, and compares sibling order at that point - or, if one
  // writer's path is a prefix of the other's, the ancestor sorts first
  // (whatever a parent wrote before creating a child precedes anything the
  // child itself writes).
  function compareWriterOrder(writerA, writerB) {
    if (writerA === writerB) return 0;
    if (writerA === null) return -1;
    if (writerB === null) return 1;

    const pathA = writerPathToRoot(writerA);
    const pathB = writerPathToRoot(writerB);
    let ia = pathA.length - 1;
    let ib = pathB.length - 1;
    if (pathA[ia] !== pathB[ib]) {
      // Different root trees entirely - same declared time but otherwise
      // unrelated (e.g. two independent top-level repeaters both at the
      // same level - the "same-time writers" question, not solved here).
      // Stable fallback so ordering is at least consistent.
      return pathA[ia].id - pathB[ib].id;
    }
    while (ia >= 0 && ib >= 0 && pathA[ia] === pathB[ib]) {
      ia--;
      ib--;
    }
    if (ia < 0) return -1; // writerA's whole path was a prefix of writerB's - A is an ancestor of B
    if (ib < 0) return 1;
    return compareSiblingOrder(pathA[ia + 1], pathA[ia], pathB[ib]);
  }

  // Order (timeA, writerA) against (timeB, writerB): by declared time
  // first, tree position only as a tie-breaker.
  function comparePositions(timeA, writerA, timeB, writerB) {
    if (timeA !== timeB) return timeA - timeB;
    return compareWriterOrder(writerA, writerB);
  }

  // Resolve the writing valid for `time`/`writer`: the writing with the
  // largest position `<= (time, writer)`, walking from the cached
  // `currentWriting` via `next`/`previous` and updating the cache to
  // match. There is always at least a time-0 writing once the timeline
  // exists, so this never needs to return null - self-healing if every
  // writing has been retracted since the timeline was last looked up
  // (callers like hasTimelineValue/readTimelineValue look the timeline up
  // directly, without going through getOrCreateTimeline first).
  //
  // `time === Infinity` (external reads - see currentReadTime()) skips the
  // walk entirely: there's nothing to tie-break against infinity, it's
  // always the timeline's latest writing, full stop.
  function seekWriting(timeline, time, writer) {
    if (typeof(writer) === 'undefined') writer = null;
    if (timeline.currentWriting === null) {
      reanchorEmptyTimeline(timeline);
    }
    if (time === Infinity) {
      return timeline.currentWriting = timeline.last;
    }
    let writing = timeline.currentWriting;
    if (comparePositions(writing.time, writing.writer, time, writer) <= 0) {
      while (writing.next !== null && comparePositions(writing.next.time, writing.next.writer, time, writer) <= 0) {
        writing = writing.next;
      }
    } else {
      while (comparePositions(writing.time, writing.writer, time, writer) > 0) {
        writing = writing.previous;
      }
    }
    timeline.currentWriting = writing;
    return writing;
  }

  // Is there already a writing at exactly this position? Compares by tree
  // position (comparePositions), not writer object identity - a leaf
  // repeater's own single partial is a fresh object every rerun, but it
  // occupies the same slot each time and must reconcile against its own
  // previous writing, not accumulate a new one forever.
  function findExactWriting(timeline, time, writer) {
    const writing = seekWriting(timeline, time, writer);
    return comparePositions(writing.time, writing.writer, time, writer) === 0 ? writing : null;
  }

  // Splice a writing (new or previously unlinked) into its timeline at its
  // own `.time`/`.writer` position, keeping writings ordered. Shared by
  // insertion and by relinking a retracted writing that turned out to be
  // reusable.
  function spliceWritingIntoTimeline(timeline, writing) {
    const previous = seekWriting(timeline, writing.time, writing.writer);
    const next = previous.next;
    writing.previous = previous;
    writing.next = next;
    previous.next = writing;
    if (next !== null) {
      next.previous = writing;
    } else {
      timeline.last = writing;
    }
    timeline.currentWriting = writing;
  }

  function insertNewWriting(timeline, time, writer) {
    const writing = createTimelineWriting(time, writer);
    writing.timeline = timeline;
    spliceWritingIntoTimeline(timeline, writing);
    return writing;
  }

  function relinkWriting(writing) {
    spliceWritingIntoTimeline(writing.timeline, writing);
  }

  function getOrCreateExactWriting(handler, key, time, writer) {
    const timeline = getOrCreateTimeline(handler, key);
    return findExactWriting(timeline, time, writer) || insertNewWriting(timeline, time, writer);
  }

  // Fully remove a writing from its timeline. Unlike marking a writing
  // unset, this makes reads transparently fall through to whatever writing
  // is now nearest below it - retracting a writing (a repeater no longer
  // has anything to say about this property) is not the same as asserting
  // that the property has no value.
  function unlinkWriting(writing) {
    const timeline = writing.timeline;
    if (writing.previous !== null) {
      writing.previous.next = writing.next;
    } else {
      timeline.first = writing.next;
    }
    if (writing.next !== null) {
      writing.next.previous = writing.previous;
    } else {
      timeline.last = writing.previous;
    }
    if (timeline.currentWriting === writing) {
      timeline.currentWriting = writing.previous || writing.next || null;
    }
    writing.previous = null;
    writing.next = null;
  }

  function getOrCreateTimelineWriting(handler, key, time, writer) {
    return seekWriting(getOrCreateTimeline(handler, key), time, writer);
  }

  function getOrCreateEnumerationTimelineWriting(handler) {
    return seekWriting(getOrCreateTimeline(handler, enumerationTimelineKey), 0, null);
  }

  // Move an object literal's own data properties into timelines, leaving
  // accessor properties (getters/setters) and methods (function values,
  // e.g. onChange/onDispose/onEstablish hooks) untouched on target. Always
  // attributed to time 0/external, regardless of whether observable() was
  // itself called from inside a repeater - these are the object's baseline
  // starting values, not something the calling repeater computed.
  function moveTargetDataIntoTimelines(handler, target) {
    Object.keys(target).forEach(function(key) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (typeof(descriptor.get) === 'function' || typeof(descriptor.set) === 'function') {
        return;
      }
      if (typeof(descriptor.value) === 'function') {
        return;
      }
      delete target[key];
      const writing = getOrCreateTimelineWriting(handler, key, 0, null);
      writing.value = descriptor.value;
      writing.set = true;
    });
  }


  /***************************************************************
   *
   *  Timeline read/write interface
   *
   *  A small wrapper API so internal bookkeeping code - like the rebuild
   *  reference-translation step in finishRebuilding below - reads and
   *  writes a handler's property values through here, instead of poking at
   *  raw timeline writings (or, worse, a raw `target`) directly. Callers
   *  that go through here don't need to know about currentWriting, seeking,
   *  or any future caching - they just read or write "the value of this
   *  property on this handler" at a given time.
   *
   *  These are silent: they do not invalidate observers or emit change
   *  events. They exist for patching up already-written values (e.g.
   *  resolving a temporary object reference to its established
   *  counterpart), not for performing a new observable write - use the
   *  proxy itself (going through setHandlerObject) for that.
   *
   ***************************************************************/

  function hasTimelineValue(handler, key, time, writer) {
    const timeline = handler.timelines[key];
    return typeof(timeline) !== 'undefined' && seekWriting(timeline, time, writer).set;
  }

  function readTimelineValue(handler, key, time, writer) {
    const timeline = handler.timelines[key];
    if (typeof(timeline) === 'undefined') return undefined;
    const writing = seekWriting(timeline, time, writer);
    return writing.set ? writing.value : undefined;
  }

  function writeTimelineValueSilently(handler, key, value, time, writer) {
    const writing = getOrCreateExactWriting(handler, key, time, writer);
    writing.value = value;
    writing.set = true;
  }

  // All property keys (excluding the reserved enumeration timeline) that
  // currently hold a value as of `time`/`writer`.
  function timelineDataKeys(handler, time, writer) {
    const keys = [];
    for (let key in handler.timelines) {
      if (seekWriting(handler.timelines[key], time, writer).set) keys.push(key);
    }
    return keys;
  }

  // What time a write happens "at": the current context's own time if it
  // declares one (a repeater/invalidator), else time 0 - external, outside-
  // any-repeater writes always land at the baseline, feeding the pipeline
  // as fresh input for time>0 repeaters to pick up.
  function currentTime() {
    const context = state.context;
    return (context && typeof(context.time) === "function") ? context.time() : 0;
  }

  // What time a read happens "at": same as currentTime() inside a
  // repeater/invalidator, but external reads (outside any repeater) see the
  // latest writing rather than the baseline - the pipeline's fully-settled
  // output, not its raw input. seekWriting naturally walks all the way to
  // `last` for an unbounded time.
  function currentReadTime() {
    const context = state.context;
    return (context && typeof(context.time) === "function") ? context.time() : Infinity;
  }

  // The current partial, for tie-breaking writings that share the same
  // declared time (see "Time as tree position" above) - null for external
  // code or while inside an invalidator (which doesn't participate in the
  // repeater tree).
  function currentWriter() {
    const context = state.context;
    return (context && context.type === "partial") ? context : null;
  }


  /***************************************************************
   *
   *  Object Handlers
   *
   ***************************************************************/


  function getHandlerObject(target, key) {
    key = key.toString();

    if (key === objectMetaProperty) {
      return this.meta;
    } else if (key === objectTimelinesProperty) {
      return this.timelines;
    } else if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      let result = forwardToHandler.get.apply(forwardToHandler, [forwardToHandler.target, key]);
      return result;
    }

    if (onReadGlobal && !onReadGlobal(this, target, key)) { //Used for ensureInitialized, registerActivity & canRead
      return cannotReadPropertyValue;
    }

    const time = currentReadTime();
    const writer = currentWriter();
    if (state.inActiveRecording) recordDependencyOnProperty(state.context, this, key, time, writer);

    let scan = target;
    while ( scan !== null && typeof(scan) !== 'undefined' ) {
      let descriptor = Object.getOwnPropertyDescriptor(scan, key);
      if (typeof(descriptor) !== 'undefined' &&
          typeof(descriptor.get) !== 'undefined') {
        return descriptor.get.bind(this.meta.proxy)();
      }
      scan = Object.getPrototypeOf( scan );
    }

    if (hasTimelineValue(this, key, time, writer)) {
      return readTimelineValue(this, key, time, writer);
    }
    return target[key];
  }

  function setHandlerObject(target, key, value) {
    if (key === objectMetaProperty) throw new Error("Cannot set the dedicated meta property '" + objectMetaProperty + "'");
    if (key === objectTimelinesProperty) throw new Error("Cannot set the dedicated timelines property '" + objectTimelinesProperty + "'");

    if (this.meta.forwardTo !== null) {
      let forwardToHandler = this.meta.forwardTo[objectMetaProperty].handler;
      return forwardToHandler.set.apply(forwardToHandler, [forwardToHandler.target, key, value]);
    }

    if (onWriteGlobal && !onWriteGlobal(this, target, key)) {
      return;
    }

    // Respect real setters (and reject writes to getter-only properties),
    // mirroring the getter lookup in getHandlerObject.
    let scan = target;
    while ( scan !== null && typeof(scan) !== 'undefined' ) {
      let descriptor = Object.getOwnPropertyDescriptor(scan, key);
      if (typeof(descriptor) !== 'undefined' && typeof(descriptor.set) === 'function') {
        descriptor.set.call(this.meta.proxy, value);
        return true;
      }
      if (typeof(descriptor) !== 'undefined' && typeof(descriptor.get) !== 'undefined') {
        return false; // Getter without setter.
      }
      scan = Object.getPrototypeOf( scan );
    }

    const time = currentTime();
    const writer = currentWriter();
    const timeline = getOrCreateTimeline(this, key);
    const context = state.context;
    const hasPendingWriting = !!(context && context.pendingWritings && context.pendingWritings.has(timeline));

    let writing;
    if (hasPendingWriting) {
      // A writing this same repeater made last run, detached at the start
      // of this rerun so fresh reads couldn't see it - reconcile against
      // it now that we know the real new value, instead of blindly
      // creating (and eagerly notifying about) a new one.
      writing = context.pendingWritings.get(timeline);
    } else {
      writing = findExactWriting(timeline, time, writer) || insertNewWriting(timeline, time, writer);
    }

    const undefinedKey = !writing.set;
    const previousValue = writing.value;

    // If same value as already set (or as it was before this rerun
    // retracted it), nothing observable changed.
    if (writing.set && sameAsPrevious(previousValue, value)) {
      if (hasPendingWriting) {
        // The writing being reused still carries whatever writer created it
        // originally, which may by now be fully orphaned (unreachable from
        // any repeater's children/pendingChildren - see compareSiblingOrder)
        // once its own partial has been replaced. An orphaned writer
        // compares as "equal" to everything, which would send relinkWriting
        // to the wrong spot - so re-attribute to the current, live writer
        // (the one actually reconciling against it) before splicing back in.
        writing.writer = writer;
        relinkWriting(writing);
        context.pendingWritings.delete(timeline);
        context.writings.set(timeline, writing);
      }
      return true;
    } // TODO: It would be even safer if we write protected non observable data structures that are assigned, if we are using mode: useNonObservablesAsValues

    writing.value = value;
    writing.set = true;

    if (hasPendingWriting) {
      writing.writer = writer;
      relinkWriting(writing);
      context.pendingWritings.delete(timeline);
    }
    if (context && context.writings) {
      context.writings.set(timeline, writing);
    }

    invalidateWritingObservers(writing, this.proxy, key);
    if (undefinedKey) invalidateEnumerateObservers(this, key);

    emitSetEvent(this, key, value, previousValue);

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

    const time = currentTime();
    const writer = currentWriter();
    const timelineHasValue = hasTimelineValue(this, key, time, writer);

    if (!timelineHasValue && !(key in target)) {
      return true;
    }

    let previousValue;
    if (timelineHasValue) {
      const writing = getOrCreateTimelineWriting(this, key, time, writer);
      previousValue = writing.value;
      writing.value = undefined;
      writing.set = false;
    } else {
      previousValue = target[key];
      delete target[key];
    }

    invalidatePropertyObservers(this, key, time, writer);
    invalidateEnumerateObservers(this, key);
    emitDeleteEvent(this, key, previousValue);

    return true;
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
    timelineDataKeys(this, currentReadTime(), currentWriter()).forEach(function(timelineKey) {
      if (keys.indexOf(timelineKey) === -1) keys.push(timelineKey);
    });
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
    if (hasTimelineValue(this, key, currentReadTime(), currentWriter())) return true;
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
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (typeof(descriptor) !== 'undefined') return descriptor;
    const time = currentReadTime();
    const writer = currentWriter();
    if (hasTimelineValue(this, key, time, writer)) {
      return {
        value: readTimelineValue(this, key, time, writer),
        writable: true,
        enumerable: true,
        configurable: true,
      };
    }
    return undefined;
  }


  /***************************************************************
   *
   *  Create
   *
   ***************************************************************/

  function isObservable(entity) {
    return entity !== null && typeof(entity) === "object" && typeof(entity[objectMetaProperty]) === "object" && entity[objectMetaProperty].world === world; 
  }


  function observable(target, buildId) { // created target
    if (typeof(target) === 'undefined') {
      target = {};
    }
    if (typeof(target) !== "object") return target;
    if (typeof(buildId) === 'undefined') {
      buildId = null;
    }
    if (isObservable(target)) {
      throw new Error("Cannot observe an already observed object!");
    }

    let handler;
    if (target instanceof Array) {
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
        timelines : {},
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

    let proxy = new Proxy(target, handler);

    handler.target = target;
    handler.proxy = proxy;

    handler.meta = {
      world: world,
      id: "not yet", // Wait for rebuild analysis
      buildId : buildId,
      forwardTo : null,
      target: target,
      handler : handler,
      proxy : proxy,

      // Here to avoid prevent events being sent to objects being rebuilt.
      isBeingRebuilt: false,
    };

    if (!(target instanceof Array)) {
      moveTargetDataIntoTimelines(handler, target);
    }

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
      handler.proxy.onChange(event);
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
        exitTimeLevel(observer);
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
        enterTimeLevel(observer);
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


  // Every repeater's actual reads/writes are always registered one level
  // down, on a "partial" - never directly on the repeater. A repeater's
  // execution is sliced into one partial per child-attachment point:
  // creating or relinking a child closes the current partial and opens a
  // fresh one, so each partial owns exactly the reads/writes made between
  // one child boundary and the next. With no children created, there's
  // just the one partial. See docs/plan-partial-repeaters.md.
  //
  // A partial can never usefully run on its own - the repeater's code has
  // to execute in one go - so invalidating a partial (something it read
  // changed) delegates straight to invalidating its owning repeater.
  function createPartial(repeater) {
    return {
      type: "partial",
      id: state.observerId++,
      description: repeater.description,
      repeater: repeater,
      sources: [],
      writings: new Map(),
      pendingWritings: new Map(),
      // Sibling pointers within the owning repeater's children/
      // pendingChildren list (partials and real child repeaters share one
      // list) - see createChildList()/attachToCurrentParent() below.
      nextSibling: null,
      previousSibling: null,
      get isRecording() {
        return this.repeater.isRecording;
      },
      time() {
        return this.repeater.time();
      },
      dispose() {
        removeAllSources(this);
      },
      invalidateAction() {
        this.repeater.invalidateAction();
      },
      causalityString() {
        return "<partial of> " + this.repeater.causalityString();
      },
    };
  }

  // A repeater's children (real child repeaters, interleaved with the
  // partials that own the reads/writes between them) live in one ordered
  // linked list - see createPartial() above.
  function createChildList() {
    return { first: null, last: null };
  }

  function appendToChildList(list, node) {
    node.previousSibling = list.last;
    node.nextSibling = null;
    if (list.last !== null) {
      list.last.nextSibling = node;
    } else {
      list.first = node;
    }
    list.last = node;
  }

  function unlinkFromChildList(list, node) {
    if (node.previousSibling !== null) {
      node.previousSibling.nextSibling = node.nextSibling;
    } else {
      list.first = node.nextSibling;
    }
    if (node.nextSibling !== null) {
      node.nextSibling.previousSibling = node.previousSibling;
    } else {
      list.last = node.previousSibling;
    }
    node.previousSibling = null;
    node.nextSibling = null;
  }

  // Create a fresh partial for `repeater`'s current position - either the
  // very first one for this run, or the next one after a child boundary -
  // reconciling it against whatever old partial occupies the same position
  // in `repeater.pendingChildren` (the previous run's sequence, still fully
  // intact: nothing about it is touched until the moment its replacement is
  // actually created). Position is tracked simply as "the front of
  // pendingChildren", consumed in order as the fresh run reaches each spot;
  // the moment something doesn't line up, `repeater.reconciling` goes false
  // and every later position in this run just creates fresh, unreconciled
  // partials - finalizeChildren() sweeps up whatever's left once the run
  // finishes, same as it always has.
  function createNextPartial(repeater) {
    const partial = createPartial(repeater);
    if (repeater.reconciling) {
      const oldPartial = repeater.pendingChildren.first;
      if (oldPartial !== null && oldPartial.type === "partial") {
        unlinkFromChildList(repeater.pendingChildren, oldPartial);
        removeAllSources(oldPartial);
        // Every writing this old partial made was already detached from
        // its timeline back in dispose() - hand the map itself off rather
        // than notifying anything yet. setHandlerObject reconciles each one
        // as the new partial's writes actually happen, draining matches out
        // of it; whatever's left when this partial closes (see
        // attachToCurrentParent()/refresh()) never got a matching write and
        // is genuinely gone.
        partial.pendingWritings = oldPartial.writings;
      } else {
        repeater.reconciling = false;
      }
    }
    partial.parentRepeater = repeater;
    partial.listMembership = "confirmed";
    repeater.currentPartial = partial;
    appendToChildList(repeater.children, partial);
    return partial;
  }

  // Shared by repeat() (a brand new child) and linkRepeater() (an existing
  // one): attach `child` (a repeater or, internally, a partial) to whatever
  // repeater is currently executing, then close the current partial and
  // open a fresh one so subsequent code in the parent attributes its
  // reads/writes to a new sub-position after this child. A no-op (besides
  // returning) if there's no enclosing repeater to attach to.
  function attachToCurrentParent(child) {
    const parentContext = state.context;
    if (!parentContext || parentContext.type !== "partial") {
      return;
    }
    const parentRepeater = parentContext.repeater;

    if (parentRepeater.reconciling && parentRepeater.pendingChildren.first === child) {
      // Structure still lines up with last time - pure bookkeeping, nothing
      // about the child's own state (sources, writings, its own children)
      // is touched at all.
      unlinkFromChildList(parentRepeater.pendingChildren, child);
    } else {
      if (child.parentRepeater === parentRepeater && child.listMembership === "pending") {
        // A different child was relinked here than occupied this position
        // last time (e.g. children reordered) - still reclaim it from
        // wherever it sits, but positional correspondence for the rest of
        // this run is no longer trustworthy.
        unlinkFromChildList(parentRepeater.pendingChildren, child);
      }
      parentRepeater.reconciling = false;
    }
    child.parentRepeater = parentRepeater;
    child.listMembership = "confirmed";
    if (typeof(child.retracted) !== 'undefined') child.retracted = false;
    appendToChildList(parentRepeater.children, child);

    // This partial's writes are complete now - anything it didn't reconcile
    // against its own predecessor is genuinely gone.
    finalizeWritings(parentContext);

    leaveContext(parentContext);
    const partial = createNextPartial(parentRepeater);
    enterContext(partial);
  }

  // Anything still in `repeater.pendingChildren` was never reclaimed this
  // run (a partial the parent's code no longer reaches, or a child never
  // re-linked) - genuinely retract it now. A retracted child stays fully
  // intact and re-linkable later (see the docs); it's its own children/
  // pending-children that recurse here, since it isn't running again right
  // now for anything to reconcile against.
  function finalizeChildren(repeater) {
    let node = repeater.pendingChildren.first;
    while (node !== null) {
      const next = node.nextSibling;
      node.previousSibling = null;
      node.nextSibling = null;
      // Fully gone from the tree now - compareSiblingOrder relies on this
      // (a stale writer reference it can't find anywhere compares as equal
      // to whatever currently holds that position, rather than guessing).
      node.listMembership = null;
      if (node.type === "partial") {
        removeAllSources(node);
        retractAndFinalizeWritings(node);
      } else {
        node.dispose();
        finalizeChildren(node);
        node.retracted = true;
      }
      node = next;
    }
    repeater.pendingChildren = createChildList();
  }

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
      // The partial currently holding this repeater's reads/writes - see
      // createPartial() above and refresh() below.
      currentPartial: null,
      // This run's confirmed children (real child repeaters interleaved
      // with the partials between them) and, transiently between dispose()
      // and the end of the next refresh(), the previous run's sequence
      // awaiting reconciliation - see attachToCurrentParent()/
      // finalizeChildren() above.
      children: createChildList(),
      pendingChildren: createChildList(),
      // Sibling pointers within a *parent's* children/pendingChildren list
      // (unused while this repeater is top-level).
      nextSibling: null,
      previousSibling: null,
      parentRepeater: null,
      listMembership: null, // "confirmed" | "pending" | null (top-level)
      // Retracted: this repeater's writings are gone and it's sitting
      // unclaimed in some parent's pendingChildren, but it's still fully
      // intact and re-linkable. Disposed: gone forever. See
      // docs/plan-partial-repeaters.md.
      retracted: false,
      disposed: false,
      // True from dispose() through the end of the next refresh(): the
      // fresh run's partials/children still line up positionally with
      // pendingChildren's front, so createNextPartial()/
      // attachToCurrentParent() keep reconciling against it. Goes false
      // the moment anything doesn't match, for the rest of that run.
      reconciling: false,
      nextToNotify: null,
      repeaterAction : modifyRepeaterAction(repeaterAction, options),
      nonRecordedAction: repeaterNonRecordingAction,
      options: options ? options : {},
      finishRebuilding() {
          finishRebuilding(this);
      },
      time() {
        return typeof(this.options.time) !== "undefined" ? this.options.time : 0; 
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
        if (!this.currentPartial) return result;
        for (let source of this.currentPartial.sources) {
          while (source.parent) source = source.parent;
          result += source.handler.proxy.toString() + "." + source.key + "\n";
        }
        return result;
      },
      restart() {
        this.invalidateAction();
      },
      invalidateAction() {
        repeaterDirty(this);
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
        // Idempotent: a repeater already sitting dirty (e.g. through a
        // legitimate dependency invalidation) can also be reached directly
        // by its parent's finalizeChildren() in the very same rerun, if the
        // parent never re-links it either. children is already empty in
        // that case (the first dispose() moved it to pendingChildren) - so
        // there's nothing further to move, and doing it again would
        // overwrite pendingChildren with that emptiness, losing what the
        // first call had just stashed there.
        if (this.children.first !== null) {
          // Move this run's whole partial/child sequence to pending. Which
          // of it gets reused (relinked children, reconciled partials) is
          // still worked out lazily, one at a time, as the fresh run
          // actually reaches each position - see createNextPartial()/
          // attachToCurrentParent(). But every partial's *writings* are
          // detached from their timelines right now, unconditionally - a
          // read that happens before this repeater actually reruns (another
          // repeater interleaved via the dirty queue, or an ancestor's own
          // later code - see renderOnto.js case 1) must not see this
          // repeater's stale prior output; it needs to fall through to
          // whatever's now below it. The writing objects themselves aren't
          // touched otherwise - they stay right where they are, in each
          // partial's own `writings`, ready to be handed off as
          // pendingWritings to whichever new partial reconciles against
          // that same position, or genuinely retracted and notified if none
          // ever does - see createNextPartial()/finalizeChildren().
          let node = this.children.first;
          while (node !== null) {
            node.listMembership = "pending";
            if (node.type === "partial") {
              node.writings.forEach(function(writing) {
                unlinkWriting(writing);
              });
            }
            node = node.nextSibling;
          }
          this.pendingChildren = this.children;
          this.children = createChildList();
        }
        this.currentPartial = null;
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
      nextDirty : null,
      previousDirty : null,
      lastRepeatTime: 0,
      waitOnNonRecordedAction: 0,
      refresh() {
        const repeater = this; 
        const options = repeater.options;
        if (options.onRefresh) options.onRefresh(repeater);
        
        repeater.finishedRebuilding = false;
        repeater.createdCount = 0;
        repeater.createdTemporaryCount = 0;
        repeater.removedCount = 0;

        // Reconciliation (if any) starts from the front of the previous
        // run's still-fully-intact sequence, consumed one partial/child at
        // a time as this run actually reaches each position - see
        // createNextPartial()/attachToCurrentParent().
        repeater.reconciling = repeater.pendingChildren.first !== null;
        const partial = createNextPartial(repeater);

        // Recorded action (cause and/or effect)
        repeater.isRecording = true;
        enterContext(partial);
        repeater.returnValue = repeater.repeaterAction(repeater);
        repeater.isRecording = false;
        updateContextState()

        // The action may have created/relinked children, which closes the
        // current partial and opens new ones (see attachToCurrentParent) -
        // so by now repeater.currentPartial may be a later partial than
        // the one we entered above, not `partial` itself.
        const finalPartial = repeater.currentPartial;

        // Anything retracted at the start of this rerun that never got
        // reconciled against a fresh write this run is genuinely gone now
        // (this repeater's own writings), and likewise for any of its
        // children never re-linked this run.
        finalizeWritings(finalPartial);
        finalizeChildren(repeater);

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
        leaveContext( finalPartial );
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

    function matchChildrenInEquivalentSlot(establishedObjectTarget, newObjectTarget) {
      for (let [establishedSlot, newSlot] of shapeAnalysis.slotsIterator(establishedObjectTarget, newObjectTarget, object => (isObservable(object) && object[objectMetaProperty].buildId))) {
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
      // TODO(timelines): a user-supplied rebuildShapeAnalysis.translateReferences
      // still receives the raw `target`, which no longer holds plain data
      // properties for objects (they live in handler.timelines now) - only
      // accessors/methods remain there. Its public contract would need to
      // change (e.g. to receive read/write functions instead of a raw
      // object) to see virtualized properties; left as-is for now since
      // that's a user-facing API change, not an internal detail.
      for(let id in repeater.newIdObjectShapeMap) {
        let object = repeater.newIdObjectShapeMap[id];
        let target;
        let handler;
        const temporaryObject = object[objectMetaProperty].forwardTo;
        if (temporaryObject) {
          target = temporaryObject[objectMetaProperty].target;
          handler = temporaryObject[objectMetaProperty].handler;
        } else {
          target = object[objectMetaProperty].target;
          handler = object[objectMetaProperty].handler;
        }
        if (repeater.options.rebuildShapeAnalysis.translateReferences) {
          repeater.options.rebuildShapeAnalysis.translateReferences(target, translateReference);
        } else if (target instanceof Array) {
          for (let property in target) {
            target[property] = translateReference(target[property])
          }
        } else {
          // Go through the timeline read/write interface instead of the raw
          // target - plain data properties live in handler.timelines now.
          const time = currentTime();
          const writer = currentWriter();
          timelineDataKeys(handler, time, writer).forEach(function(key) {
            writeTimelineValueSilently(handler, key, translateReference(readTimelineValue(handler, key, time, writer)), time, writer);
          });
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
          mergeInto(object, temporaryObject);

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
            const objectTarget = object[objectMetaProperty].target;
            // console.log("Dispose object: " + objectTarget.constructor.name + "." + object[objectMetaProperty].id)
            emitDisposeEvent(object[objectMetaProperty].handler);
            if (typeof(objectTarget.onDispose) === "function") object.onDispose();
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
          mergeInto(created, temporaryObject);
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
            const objectTarget = object[objectMetaProperty].target;
            // console.log("Dispose object: " + objectTarget.constructor.name + "." + object[objectMetaProperty].id)
            emitDisposeEvent(object[objectMetaProperty].handler);
            if (typeof(objectTarget.onDispose) === "function") object.onDispose();
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
        const repeater = state.inRepeater;
        if (repeater.options.rebuildShapeAnalysis) {
          const {matchChildrenInEquivalentSlot} = reBuildShapeAnalysis(repeater);
          matchChildrenInEquivalentSlot(object[objectMetaProperty].target, temporaryObject[objectMetaProperty].target);
        }
        // console.groupEnd();
      }

      // A re-build, push changes to established object.
      object[objectMetaProperty].forwardTo = null;
      temporaryObject[objectMetaProperty].isBeingRebuilt = false; 
      mergeInto(object, temporaryObject);

      

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
    const result = repeater.refresh();
    // If created while nested inside another repeater's execution, this
    // repeater automatically becomes its child - closing the parent's
    // current partial and opening a fresh one for whatever parent code
    // comes next. See attachToCurrentParent().
    attachToCurrentParent(repeater);
    return result;
  }

  // Reattach a previously-created repeater as a child of whichever
  // repeater is currently executing - pure reattachment, never a trigger.
  // If `oldRepeater` is currently invalid, cascade's normal dirty-queue
  // machinery refreshes it on its own schedule, independent of when this
  // is called; if it's clean, this is a no-op beyond the reattachment
  // itself - no rerun, no state loss. Component/child identity (which old
  // repeater corresponds to which new render call) is entirely the
  // caller's responsibility - cascade only exposes this primitive.
  function linkRepeater(oldRepeater) {
    attachToCurrentParent(oldRepeater);
    return oldRepeater;
  }


  function repeaterDirty(repeater) { // TODO: Add update block on this stage?
    repeater.dispose();
    const time = repeater.time();
    enterTimeLevel(time);
    // disposeChildContexts(repeater);
    // disposeSingleChildContext(repeater);

    const timeList = state.dirtyRepeaters;

    const list = timeList[time];
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
    const time = repeater.time(); // repeater
    const list = state.dirtyRepeaters[time];
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

  // Anything still pending after a rerun (or after a permanent dispose)
  // was never reconciled against a fresh write, so it's genuinely gone -
  // notify whoever was watching it.
  function finalizeWritings(repeater) {
    repeater.pendingWritings.forEach(function(writing, timeline) {
      invalidateWritingObservers(writing, timeline.handler.proxy, timeline.key);
    });
    repeater.pendingWritings.clear();
  }

  // A partial that finalizeChildren() finds still sitting unconsumed in
  // pendingChildren never got picked up by createNextPartial() (either its
  // owning repeater is being permanently abandoned, not rerun, or the fresh
  // run's structure diverged before reaching it). Its writings were already
  // detached from their timelines back in dispose() (so they weren't
  // sitting stale in between); nothing ever came along to reconcile against
  // them, so notify and discard for real now, same as finalizeWritings().
  function retractAndFinalizeWritings(partial) {
    partial.writings.forEach(function(writing, timeline) {
      invalidateWritingObservers(writing, timeline.handler.proxy, timeline.key);
    });
    partial.writings.clear();
    finalizeWritings(partial);
  }

  function anyDirtyRepeater(start=0) {
    const timeList = state.dirtyRepeaters; 
    let time = start; 
    while(time < timeList.length) {
      if (timeList[time].first !== null) {
        return true; 
      }
      time++;
    }
    return false; 
  }

  function firstDirtyRepeater() {
    const timeList = state.dirtyRepeaters;
    
    // Find work in unlocked level
    let time = state.revalidationTimeLock + 1;
    while (time < timeList.length) {
      if (timeList[time].first) {
        return timeList[time].first;
      }
      time++;
    }

    // Nothing found, reset lock and start again! 
    state.revalidationTimeLock = -1;
    time = state.revalidationTimeLock + 1;
    while (time < timeList.length) {
      if (timeList[time].first) {
        return timeList[time].first;
      }
      time++;
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
            exitTimeLevel(repeater.time());
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