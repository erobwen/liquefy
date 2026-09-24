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

  // Dev-time-only safety net for the O(1) order-number chain (see
  // compareWriterOrder()/structuralCompareWriterOrder()): also compute
  // writer order via the older, structural parent/sibling walk (O(depth),
  // never optimized, but doesn't depend on the order-number bookkeeping
  // being correct) and throw if the two disagree. Off by default - it's
  // a real O(depth) tree walk on every comparison, not something to pay
  // for outside development.
  verifyChainOrderStructurally: false,

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
    refreshingAllDirtyRepeaters: false,
    workOnTimeLevel: [...Array(configuration.timeLevels).keys()].map(() => 0),
    revalidationTimeLock: -1,

    // The repeater work scheduler - see "Repeater scheduling: pipelines,
    // wavefronts, parking" below for the full design. One {active, parked}
    // pair of FIFOs per time level, holding *pipelines* (chainHeads), not
    // individual repeaters - a chainHead's own internal heap/parkedPartials
    // (see createChainHead()) is where the actual repeaters needing
    // attention live.
    workQueue: [...Array(configuration.timeLevels).keys()].map(() => ({
      active: { first: null, last: null },
      parked: { first: null, last: null },
    })),
    // Separate from revalidationTimeLock above (which belongs to the
    // older, general context-enter/exit bookkeeping - see enterTimeLevel/
    // exitTimeLevel - and is left alone here specifically so this new
    // scheduler's own lock can't be perturbed by that unrelated
    // machinery, the same bug class already found and fixed once this
    // session when the two were briefly conflated).
    workQueueTimeLock: -1,
    // The chainHead currently being drained by drainActivePipeline(), if
    // any - see scheduleWork()'s own use of it to detect "is new work
    // arriving for the very pipeline I'm mid-processing".
    activePipeline: null,

    // flush() (see below) - recursion-safe, like recordingPaused/
    // blockInvalidation above. While > 0, an invalidation/flagging that
    // would otherwise park (waiting for the next wave) instead retreats
    // the wave - see ensurePipelineActiveOrParked()/scheduleWork().
    flushing: 0,
    // Set by either kind of retreat (the outer workQueueTimeLock, or a
    // pipeline's own internal wavefront) - checked once, right after every
    // processRepeater() call, never mid-refresh - see checkWaveRetreat().
    waveRetreated: false,
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
    flush,
    accessInitialValues,
    declareState,
    retractRepeater,
    refreshIfNeeded,

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
    invalidateDownstreamEnumerationObservers,
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
  const collectOvertakenPropertyObservers = dependencyInterface.collectOvertakenPropertyObservers;
  const relocatePropertyObserverEntry = dependencyInterface.relocatePropertyObserverEntry;
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

  // Give the application control over wave direction: while flushing > 0,
  // an invalidation/flagging that would normally park (waiting for the
  // next wave to come back around) instead moves the wave itself
  // backward, so it's picked up again within this same wave - see
  // ensurePipelineActiveOrParked()/scheduleWork()/checkWaveRetreat() under
  // "Repeater scheduling" below. Lets a modal dialog whose frame already
  // rendered add content back into it without waiting a frame, or a
  // view-model correct an invalid selection at the model level and have
  // everything downstream re-derive immediately - at the caller's own
  // risk of an infinite oscillation, same as any other loop whose
  // termination depends on the logic inside it eventually settling.
  function flush(callback) {
    state.flushing++;
    const result = callback();
    state.flushing--;
    return result;
  }

  // Read/write as though genuinely outside any repeater, regardless of
  // what's actually executing - currentTime()/currentReadTime()/
  // currentWriter() all derive purely from state.context, so nulling it
  // for the callback's duration reuses the exact same "write lands at the
  // baseline (time 0, writer null), read sees the latest" behavior
  // external code already gets for free (see currentTime()'s own
  // comment), rather than needing any new invalidation path. A write here
  // to a property that already has a baseline writing (every observable's
  // construction writes one - see moveTargetDataIntoTimelines) reuses that
  // exact writing rather than splicing in a new one, so it goes through
  // the same unconditional, eager invalidateWritingObservers every
  // ordinary rewrite-in-place already gets - not migrateOvertakenObserversFor,
  // and so not subject to entryNeedsDeferredTreatment's same-chain
  // deferral either: this isn't overtaking a reader positioned after it,
  // it's rewriting the exact slot that reader already depends on.
  //
  // This only affects *where* a write lands, not *when* the resulting
  // invalidation is processed relative to the current wave - compose with
  // flush() (accessInitialValues(() => flush(() => ...)), either order)
  // when the correction also needs to settle within the same wave, rather
  // than waiting for the next one.
  function accessInitialValues(callback) {
    const savedContext = state.context;
    state.context = null;
    updateContextState();
    const result = callback();
    state.context = savedContext;
    updateContextState();
    return result;
  }

  // Declare some of an observable's properties as *state*, as opposed to
  // ordinary properties (see cascade.component/README.md, "Component state
  // and properties"): initialized exactly once, when the object is
  // established, and thereafter changed only from outside any repeater
  // (an event handler reacting to the user) or deliberately, at initial
  // time (accessInitialValues()) - never as a side effect of some repeater
  // in the pipeline recomputing. Two things follow, both enforced here:
  //
  //  1. setHandlerObject() throws on a write to a state property while a
  //     repeater is executing (state.inRepeater !== null). A write inside
  //     accessInitialValues() passes - that's the sanctioned way to write
  //     state from inside a pipeline, exactly what its name says.
  //  2. mergeInto() (lib/utility.js) skips state properties when a rebuild
  //     copies a freshly-constructed twin's properties onto the established
  //     object it was reconciled with (see finishRebuilding()) - so a
  //     rebuild can never reset state back to its defaults. This is the one
  //     place the distinction is gated: during a rebuild the constructed
  //     object is a throwaway anyway (setHandlerObject redirects its writes
  //     there via forwardTo), so a constructor is free to write defaults
  //     unconditionally without knowing whether it's a rebuild - it simply
  //     doesn't get copied back.
  //
  // The defaults are written at the baseline position (time 0, writer
  // null), same as an object literal's own construction data (see
  // moveTargetDataIntoTimelines) - deliberately *not* positioned within
  // whatever repeater happens to be constructing the object, so disposing
  // that repeater later can never unlink them.
  function declareState(object, defaults) {
    if (!isObservable(object)) throw new Error("declareState() expects an observable object.");
    const meta = object[objectMetaProperty];
    const register = (someMeta) => {
      if (!someMeta.stateProperties) someMeta.stateProperties = new Set();
      Object.keys(defaults).forEach((key) => someMeta.stateProperties.add(key));
    };
    register(meta);
    // While being rebuilt, writes to `object` land on its temporary twin
    // (see setHandlerObject's forwardTo redirect) - register there too, so
    // the write guard below treats both sides consistently.
    if (meta.forwardTo !== null) register(meta.forwardTo[objectMetaProperty]);
    accessInitialValues(() => {
      Object.keys(defaults).forEach((key) => { object[key] = defaults[key]; });
    });
    return object;
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
      // level, most commonly) - see compareWritingToReader()/compareWriterOrder()
      // below.
      writer: typeof(writer) === 'undefined' ? null : writer,
      value: undefined,
      set: false,
      observers: null,
      timeline: null,
      next: null,
      previous: null,
      // Whether this writing is currently spliced into its timeline's own
      // linked list - see unlinkWriting()/spliceWritingIntoTimeline(). Kept
      // as an explicit flag rather than inferred from previous/next being
      // null, since a writing that's the sole entry in its timeline has
      // both null while still genuinely linked.
      linked: false,
      // Owning-repeater staleness (see repeater.dispose() and
      // finalizeTouchedStaleWritings()/finalizeStaleWritings()): true
      // while this writing is this repeater's own prior output, unlinked
      // from its timeline (same as any other invalidated writing - a
      // repeater's prior output is invisible to everyone the instant it's
      // known to be stale, not just to itself) but held onto, not
      // discarded, in case this repeater's current rerun writes this same
      // property again - reused (same object, relinked) instead of always
      // creating a fresh one. nextValue/hasNextValue buffer whatever this
      // run's own write(s) to the same property produce, within the one
      // partial that claimed it - deliberately not compared against
      // `value` (or notified) until that partial closes, so a property
      // set, unset, and set again within one partial's own execution
      // settles once against the real before/after, not once per
      // intermediate write.
      stale: false,
      hasNextValue: false,
      nextValue: undefined,
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
    writing.linked = true;
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
    writing.linked = true;
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
   *  Time as tree position - via O(1)-comparable order numbers
   *
   *  Repeaters form a forest: independent top-level repeaters each have a
   *  flat declared `time` (stage1/stage2/etc.), but a repeater created *as
   *  a child* has its own declared time entirely superseded by its
   *  position in the tree - a parent's time is really an interval its
   *  children subdivide. Two writings/positions are compared by their
   *  declared `time` number first; only when those are equal (a parent and
   *  child sharing a level, most commonly both defaulting to 0) does tree
   *  position break the tie.
   *
   *  Tree position used to mean literally walking each writer up to its
   *  root and comparing paths - correct, but O(depth) per comparison, on
   *  every read/write. Instead, every partial gets a single `orderNumber`
   *  within its root repeater's "partial chain" - a total order maintained
   *  incrementally as partials are created, so any two partials sharing a
   *  chain compare in O(1) via plain subtraction. This is the classic
   *  order-maintenance problem (Dietz & Sleator's "maintaining order in a
   *  list", simplified by Bender et al.) applied to repeater execution
   *  order instead of a plain list - see docs/plan-partial-repeaters.md.
   *
   ***************************************************************/

  // Every root repeater (no parent) owns one of these; every repeater
  // inherits its root's chainHead once, at creation time, and keeps it for
  // life - see repeat(). `id` is a stable, arbitrary tiebreaker for the
  // rare case of comparing writers from two entirely different root trees,
  // which have no real relative position at all beyond "consistently one
  // way or the other" (the "same-time writers" question from
  // docs/plan-time-aware-timelines.md - not solved here, just kept stable).
  function createChainHead(rootRepeater) {
    return {
      id: state.observerId++,
      count: 0,          // live partials currently occupying a chain slot
      first: null,        // lowest orderNumber
      last: null,          // highest orderNumber
      // The most recently activated partial anywhere in this chain - an
      // O(1) predecessor for the next brand-new insertion, valid because
      // execution within one root tree is always synchronous and
      // depth-first (see createNextPartial()/attachToCurrentParent()).
      executionCursor: null,

      // This pipeline's one, single time level - set once, here, from its
      // root repeater's own declared time (or 0), and never changed after
      // (an {independent: true} root with no declared time takes its
      // creator's level instead - see repeat(), set right after this).
      // Every repeater sharing this chainHead uses it - see repeater.time()
      // - since a pipeline was decided to always execute within exactly
      // one time level (nothing forces a nested repeater to ever declare a
      // different one; if something legitimately needs to run at an
      // earlier/later level, that's a *different* pipeline, owned by
      // whatever component requested it, not a child of this one).
      time: typeof(rootRepeater.options.time) !== "undefined" ? rootRepeater.options.time : 0,
      rootRepeater: rootRepeater,

      // This pipeline's own work, this wave - see "Repeater scheduling"
      // below for the full design. heap: repeaters needing attention,
      // sorted by repeater.firstPartial's live orderNumber (see
      // heapInsert/heapPopMin) - never the root repeater itself, which is
      // always earlier than anything that could be in here and is checked
      // directly instead (see drainActivePipeline). parkedPartials:
      // repeaters that arrived behind this pipeline's own wavefront,
      // waiting for the next wave (see scheduleWork). wavefront: the
      // firstPartial of the last-processed repeater this active session -
      // only meaningful while this chainHead === state.activePipeline.
      heap: [],
      parkedPartials: [],
      wavefront: null,

      // This chainHead's own membership in state.workQueue[time] - which
      // of its two lists (if either) it's currently sitting in, plus the
      // FIFO linkage within that list. null while fully idle (and while
      // this chainHead === state.activePipeline, mid-drain - see
      // ensurePipelineActiveOrParked()).
      queueMembership: null,
      nextQueued: null,
      previousQueued: null,
    };
  }

  // Plain JS numbers throughout, not BigInt - Number.MAX_SAFE_INTEGER is
  // already far beyond any realistic partial count, and keeps every
  // comparison a native subtraction.
  const chainOrderMaxInt = Number.MAX_SAFE_INTEGER;
  // Partials * 2 + 1 = MAXINT: the densest possible packing (every other
  // number used) still leaves exactly one free slot between neighbors.
  // Not expected to ever actually be reached - insertPartialIntoChain()
  // throws rather than silently violating the invariant if it somehow is.
  const chainMaxPartials = Math.floor((chainOrderMaxInt - 1) / 2);

  // Step used for an ordinary (non-blast) insertion - large while a chain
  // has hardly been touched, shrinking as it fills up. Coarse, fixed tiers
  // rather than a tuned continuous curve - there's no real workload yet to
  // calibrate one against.
  function chainSpacerFor(chainHead) {
    const pressure = chainHead.count / chainOrderMaxInt;
    if (pressure < 0.25) return 65536;
    if (pressure < 0.75) return 256;
    return 1;
  }

  // Insert a brand-new partial (never previously in any chain) into
  // `chainHead`, positioned immediately after whatever partial was most
  // recently active there. Correct because execution within one root tree
  // is always synchronous and depth-first: "whatever ran right before
  // this" really is the correct predecessor, no search needed. A partial
  // being *reconciled* against an old one never calls this - it just
  // inherits the old one's chain node directly, see createNextPartial().
  function insertPartialIntoChain(chainHead, partial) {
    if (chainHead.count >= chainMaxPartials) {
      throw new Error("Partial chain exhausted its order-number space (" + chainMaxPartials + " live partials)");
    }
    const predecessor = chainHead.executionCursor;
    const successor = predecessor !== null ? predecessor.orderNext : null;

    let orderNumber;
    if (predecessor === null) {
      orderNumber = 0; // first partial ever in this chain
    } else if (successor === null) {
      orderNumber = predecessor.orderNumber + chainSpacerFor(chainHead); // appending at the tail
    } else {
      const spacer = chainSpacerFor(chainHead);
      const candidate = predecessor.orderNumber + spacer;
      orderNumber = candidate < successor.orderNumber
        ? candidate
        : Math.floor((predecessor.orderNumber + successor.orderNumber) / 2);
    }

    partial.orderNumber = orderNumber;
    partial.orderPrevious = predecessor;
    partial.orderNext = successor;
    if (predecessor !== null) predecessor.orderNext = partial; else chainHead.first = partial;
    if (successor !== null) successor.orderPrevious = partial; else chainHead.last = partial;
    chainHead.count++;
    chainHead.executionCursor = partial;

    // Only inserting *between* two existing neighbors can leave no room to
    // insert anything else there later - an append always still has the
    // entire rest of the number space open ahead of it.
    if (successor !== null &&
        ((orderNumber - predecessor.orderNumber) <= 1 || (successor.orderNumber - orderNumber) <= 1)) {
      releaseChainPressure(chainHead, partial);
    }
  }

  // Widen the gaps around `center` (just inserted, with no room left on at
  // least one side) by collecting a window of its order-chain neighbors and
  // spreading them evenly across the interval they currently span. Expands
  // whichever side currently has the smaller delta, so the window grows
  // roughly symmetrically, and keeps going until the window is at most
  // half-full (density <= 1/2 - the standard order-maintenance threshold).
  // Only then does respreading actually create room: with density <= 1/2
  // the step between neighbors comes out > 2, so every number in the
  // window is distinct afterwards. There is deliberately no cap on how many
  // nodes the search may visit - an earlier version stopped after a fixed
  // count and respread whatever it had, which is a no-op when those nodes
  // were already too dense for their span. That was fine for the flat
  // "squeeze siblings in before one anchor at the tail" shape (the window
  // reaches the chain's end and vents, see below), but not for a deeply
  // nested one: inserting a whole new subtree at the same spot every time,
  // with a stack of ancestors' trailing partials sitting right behind it,
  // the window never reached the tail, the numbers kept collapsing, and
  // two live partials eventually shared one - at which point two different
  // writers' writings reconcile onto each other as the same position (see
  // test/nested-chain-pressure.js, and cascade.application/demo's
  // RecursiveDemo where it surfaced as swapped DOM children).
  //
  // If the forward side ever runs off the real end of the chain, its
  // "successor" becomes the open space all the way up to MAXINT - which
  // satisfies the density condition immediately, spreading that whole
  // window generously into previously untouched territory. Concretely: the
  // chain grows conservatively left-to-right at first (small, fixed steps),
  // and the first blast whose search happens to reach the tail vents a
  // whole neighborhood of pressure out into that huge unused range at once
  // - permanently, if edits stay roughly local the way they do in a
  // document (this falls out of the rule above for free, no special case).
  function releaseChainPressure(chainHead, center) {
    const x = center.orderNumber;

    let backwardEdge = center;
    let forwardEdge = center;
    let deltaBackward = 0;
    let deltaForward = 0;
    let visited = 1;
    let forwardExhausted = false;
    let backwardExhausted = false;

    function stepForward() {
      if (forwardEdge.orderNext === null) {
        deltaForward = chainOrderMaxInt - x;
        forwardExhausted = true;
        return;
      }
      forwardEdge = forwardEdge.orderNext;
      deltaForward = forwardEdge.orderNumber - x;
      visited++;
    }

    function stepBackward() {
      if (backwardEdge.orderPrevious === null) {
        backwardExhausted = true;
        return;
      }
      backwardEdge = backwardEdge.orderPrevious;
      deltaBackward = x - backwardEdge.orderNumber;
      visited++;
    }

    stepForward(); // always start by expanding forward

    while (
      !(forwardExhausted && backwardExhausted) &&
      visited / (deltaForward + deltaBackward) > 0.5
    ) {
      if (backwardExhausted) stepForward();
      else if (forwardExhausted) stepBackward();
      else if (deltaForward > deltaBackward) stepBackward();
      else stepForward();
    }

    const rangeStart = backwardEdge.orderNumber;
    const rangeEnd = forwardExhausted ? chainOrderMaxInt : forwardEdge.orderNumber;

    const collected = [];
    for (let node = backwardEdge; ; node = node.orderNext) {
      collected.push(node);
      if (node === forwardEdge) break;
    }
    const gapCount = collected.length - 1;
    if (gapCount <= 0) return; // nothing to spread out (shouldn't happen - center always has a real successor when this is called)
    const step = (rangeEnd - rangeStart) / gapCount;
    for (let i = 0; i < collected.length; i++) {
      collected[i].orderNumber = Math.round(rangeStart + i * step);
    }
  }

  // Reassign `newPartial` the exact chain slot `oldPartial` occupied (same
  // orderNumber, same neighbors) - the reconciliation counterpart to
  // insertPartialIntoChain(): no count change, no renumbering, just a
  // reference swap, the same shape as writing.writer reassignment on a
  // reconciled property write.
  function inheritOrderChainNode(chainHead, newPartial, oldPartial) {
    newPartial.orderNumber = oldPartial.orderNumber;
    newPartial.orderPrevious = oldPartial.orderPrevious;
    newPartial.orderNext = oldPartial.orderNext;
    if (newPartial.orderPrevious !== null) newPartial.orderPrevious.orderNext = newPartial; else chainHead.first = newPartial;
    if (newPartial.orderNext !== null) newPartial.orderNext.orderPrevious = newPartial; else chainHead.last = newPartial;
    chainHead.executionCursor = newPartial;
  }

  // Remove a genuinely retracted partial's slot from its chain for good -
  // its number becomes free for reuse by whatever eventually falls between
  // its old neighbors. See finalizeChildren()/retractPartialChainSlot().
  function removePartialFromChain(chainHead, partial) {
    if (partial.orderPrevious !== null) partial.orderPrevious.orderNext = partial.orderNext; else chainHead.first = partial.orderNext;
    if (partial.orderNext !== null) partial.orderNext.orderPrevious = partial.orderPrevious; else chainHead.last = partial.orderPrevious;
    if (chainHead.executionCursor === partial) chainHead.executionCursor = partial.orderPrevious || partial.orderNext || null;
    partial.orderPrevious = null;
    partial.orderNext = null;
    chainHead.count--;
  }

  // Reposition an *already-live* chain member to reflect "right here,
  // right now", rather than wherever it happened to land whenever it was
  // last positioned - needed by attachToCurrentParent() once a parent's
  // reconciliation has broken (see there): a relinked-but-not-rerun
  // child's own rightmostPartial otherwise keeps whatever orderNumber it
  // was assigned the last time it actually ran, which can be arbitrarily
  // far behind (this chain is shared and grows for the app's whole
  // lifetime, not reset per run) the *current* run's real execution
  // order. Left uncorrected, a sibling's fresh write positioned right
  // after this child (via insertPartialIntoChain's own
  // "immediately after executionCursor" rule) can end up with a *larger*
  // orderNumber than this child's own stale one - so when this child
  // later reads that value, seekWriting's "largest writing at time <= my
  // own position" rule silently treats the fresh write as not-yet-
  // happened from this child's (stale) vantage point, even though it
  // already ran. Plain remove-then-insert: removePartialFromChain
  // unlinks it (rolling back executionCursor first, if this partial
  // happened to be sitting there), then insertPartialIntoChain re-adds
  // it as if fresh, immediately after wherever execution actually is
  // now - count is left correct since one decrements and the other
  // increments it back.
  function movePartialToCurrentPosition(chainHead, partial) {
    removePartialFromChain(chainHead, partial);
    insertPartialIntoChain(chainHead, partial);
  }

  // Order two writers (partials, or null for external code) when they
  // share a chain (the common case - same root tree): prefer the always-
  // correct structural (parent/sibling) walk - see structuralCompareWriterOrder's
  // own comment - falling back to the O(1) orderNumber only when structural
  // genuinely can't tell (neither writer currently findable in a confirmed-
  // or-pending list - e.g. both retracted). Order-number is a fast, best-
  // effort hint, not the source of truth right now: a whole reordered
  // subtree can leave it genuinely wrong, not just stale - see
  // attachToCurrentParent()'s own eager-retraction handling of that, and
  // this file's own git history for the concrete failures that surfaced
  // from trying to trust it through a reorder instead. Different root
  // trees have no real relative position; fall back to a stable,
  // arbitrary-but-consistent comparison via each chain's own id so
  // ordering is at least deterministic.
  function compareWriterOrder(writerA, writerB) {
    if (writerA === writerB) return 0;
    if (writerA === null) return -1;
    if (writerB === null) return 1;
    const chainA = writerA.repeater.chainHead;
    const chainB = writerB.repeater.chainHead;
    if (chainA !== chainB) return chainA.id - chainB.id;

    const structural = structuralCompareWriterOrder(writerA, writerB);
    if (structural !== null) return structural;
    return writerA.orderNumber - writerB.orderNumber;
  }

  // Walk a writer (a partial, or a bare top-level repeater) up to its
  // root purely via structural parent/sibling pointers (parentRepeater,
  // previousSibling/nextSibling on the *confirmed* children list) -
  // completely independent of orderNumber/chainHead bookkeeping. Used
  // only by the dev-time shadow verifier below; not on any hot path.
  function structuralWriterPath(writer) {
    const path = [];
    let node = writer;
    while (node) {
      path.push(node);
      node = node.parentRepeater;
    }
    return path; // [writer, its owning repeater's parent, ..., root]
  }

  // Which of two known siblings (both, at some point, owned by
  // parentRepeater) comes first - a plain O(siblings) linear scan of its
  // *confirmed* children list, since this list has no O(1) order primitive
  // of its own (that's the whole reason the order-number chain exists).
  //
  // A sibling not found there at all is either retracted (genuinely gone,
  // no relative order to report) or still sitting, unclaimed, in
  // parentRepeater.pendingChildren - this run just hasn't reattached it
  // yet (see attachToCurrentParent()). The second case *is* decidable:
  // "not yet reattached this run" always sorts after anything already
  // confirmed here, since execution hasn't reached it in the new order -
  // and if the *other* sibling is confirmed, that settles it outright.
  // Both still pending leaves the question open (no fresh execution order
  // between them yet to compare) - "can't tell structurally", not "equal".
  function structuralCompareSiblings(parentRepeater, a, b) {
    let node = parentRepeater.children.first;
    while (node !== null) {
      if (node === a) return -1;
      if (node === b) return 1;
      node = node.nextSibling;
    }
    const aPending = a.listMembership === "pending";
    const bPending = b.listMembership === "pending";
    if (aPending && !bPending) return 1;
    if (bPending && !aPending) return -1;
    return null;
  }

  // The pre-order-number algorithm this project used to compare writer
  // execution order, kept only as an independent, structurally-derived
  // cross-check (see configuration.verifyChainOrderStructurally) - O(depth
  // + siblings-at-the-divergence-point), never optimized, and correct by
  // construction since it never depends on any order-number bookkeeping
  // being right. Returns -1/0/1, or null when it genuinely can't tell
  // (different roots entirely, or one/both writers no longer structurally
  // findable - e.g. retracted - in which case there's nothing to check
  // compareWriterOrder's own answer against).
  function structuralCompareWriterOrder(writerA, writerB) {
    if (writerA === writerB) return 0;
    if (writerA === null) return -1;
    if (writerB === null) return 1;
    const pathA = structuralWriterPath(writerA);
    const pathB = structuralWriterPath(writerB);
    let ia = pathA.length - 1;
    let ib = pathB.length - 1;
    if (pathA[ia] !== pathB[ib]) return null; // different roots - no relation to check
    while (ia >= 0 && ib >= 0 && pathA[ia] === pathB[ib]) {
      ia--;
      ib--;
    }
    if (ia < 0 || ib < 0) {
      // One path is a prefix of the other - an ancestor's own writes
      // always precede anything its descendant writes.
      return ia < 0 ? -1 : 1;
    }
    const commonParent = pathA[ia + 1];
    return structuralCompareSiblings(commonParent, pathA[ia], pathB[ib]);
  }

  function verifyAgainstStructuralOrder(writerA, writerB, orderNumberResult) {
    const structural = structuralCompareWriterOrder(writerA, writerB);
    if (structural === null) return; // can't independently verify this pair right now
    const orderSign = Math.sign(orderNumberResult);
    const structuralSign = Math.sign(structural);
    if (orderSign !== structuralSign) {
      throw new Error(
        "Order-number chain disagrees with structural writer order: orderNumber comparison said " +
        orderSign + ", structural (parent/sibling) comparison said " + structuralSign +
        " for writers " + (writerA.causalityString ? writerA.causalityString() : String(writerA)) +
        " vs " + (writerB.causalityString ? writerB.causalityString() : String(writerB))
      );
    }
  }

  // Parallel pipelines. Two pipelines (different chainHeads) at the same
  // time level have no execution order relating them - neither is before
  // the other. The rule that makes that consistent:
  //
  //  - A timeline may hold same-level writings from at most one pipeline
  //    at a time (enforced when a writing is spliced in - see
  //    spliceWritingIntoTimeline()). So a level's own writings are always
  //    ordered within a single chain, never across two.
  //  - A reader in some *other* pipeline at that level sees the owning
  //    pipeline's latest writing there - the whole level counts as before
  //    it, exactly like a lower time level does.
  //
  // External writes (writer null - outside any repeater, or at initial time
  // via accessInitialValues()) belong to no pipeline: they are the time-0
  // baseline, visible to everyone, and claim nothing.
  //
  // This is where a writing sits relative to a position (readTime, reader):
  // by declared time first, tree position as the tie-breaker; negative -
  // before it (visible to a reader there), zero - that exact slot,
  // positive - after it. The read walk (seekWriting), exact-slot lookup,
  // splicing, and the overtaken-reader checks (migrateOvertakenObserversFor,
  // ...) all go through here, so they always agree about where a reader in
  // a parallel pipeline stands. The parallel branch below only ever decides
  // a reader-vs-writing question: splicing a writing next to a parallel
  // pipeline's same-level writings is exactly what the single-owner rule
  // rejects, so two writings are never ordered across pipelines.
  function compareWritingToReader(writingTime, writingWriter, readTime, reader) {
    if (writingTime !== readTime) return writingTime - readTime;
    if (writingWriter !== null && reader !== null
        && writingWriter.repeater.chainHead !== reader.repeater.chainHead) {
      return -1;
    }
    return compareWriterOrder(writingWriter, reader);
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
  //
  // No special-casing needed here for a repeater's own stale writings
  // (see repeater.dispose()/finalizeStaleWritings()) - those are unlinked
  // from the timeline the moment they're marked stale (same "reruns must
  // fully retract, not merely unset" invariant as always: a repeater's
  // prior output must not be visible to *anyone* - not just itself - the
  // instant it's known to be invalidated, even before the repeater gets a
  // chance to actually rerun and confirm or replace it), so an ordinary
  // walk already skips straight past them to whatever's genuinely still
  // current underneath.
  function seekWriting(timeline, time, writer) {
    if (typeof(writer) === 'undefined') writer = null;
    if (timeline.currentWriting === null) {
      reanchorEmptyTimeline(timeline);
    }
    if (time === Infinity) {
      return timeline.currentWriting = timeline.last;
    }
    let writing = timeline.currentWriting;
    if (compareWritingToReader(writing.time, writing.writer, time, writer) <= 0) {
      while (writing.next !== null && compareWritingToReader(writing.next.time, writing.next.writer, time, writer) <= 0) {
        writing = writing.next;
      }
    } else {
      while (compareWritingToReader(writing.time, writing.writer, time, writer) > 0) {
        writing = writing.previous;
      }
    }
    timeline.currentWriting = writing;
    return writing;
  }

  // Is there already a writing at exactly this position? Compares by tree
  // position (compareWritingToReader), not writer object identity - a leaf
  // repeater's own single partial is a fresh object every rerun, but it
  // occupies the same slot each time and must reconcile against its own
  // previous writing, not accumulate a new one forever.
  function findExactWriting(timeline, time, writer) {
    const writing = seekWriting(timeline, time, writer);
    return compareWritingToReader(writing.time, writing.writer, time, writer) === 0 ? writing : null;
  }

  // Splice a writing (new or previously unlinked) into its timeline at its
  // own `.time`/`.writer` position, keeping writings ordered. Shared by
  // insertion and by relinking a retracted writing that turned out to be
  // reusable.
  function spliceWritingIntoTimeline(timeline, writing) {
    const previous = seekWriting(timeline, writing.time, writing.writer);
    const next = previous.next;
    // A level's writings form one contiguous run, so if another pipeline
    // owns this level of this timeline, one of the two neighbors is its
    // (see compareWritingToReader(): the seek above lands a parallel
    // writer right after the owner's last writing at this level).
    if (writing.writer !== null) {
      throwIfParallelOwner(timeline, writing, previous);
      if (next !== null) throwIfParallelOwner(timeline, writing, next);
    }
    writing.previous = previous;
    writing.next = next;
    previous.next = writing;
    if (next !== null) {
      next.previous = writing;
    } else {
      timeline.last = writing;
    }
    timeline.currentWriting = writing;
    writing.linked = true;
  }

  // See compareWritingToReader(): a timeline's writings at one time level
  // must all come from a single pipeline. Two parallel pipelines writing
  // the same property at the same level have no order between them, so
  // there's no consistent answer to which value either of them - or any
  // reader - should see. Claimed only while live: once the owner's
  // writings are retracted, another pipeline may take the level over.
  function throwIfParallelOwner(timeline, writing, neighbor) {
    if (neighbor.writer === null || neighbor.time !== writing.time) return;
    const owner = neighbor.writer.repeater;
    const intruder = writing.writer.repeater;
    if (owner.chainHead === intruder.chainHead) return;
    throw new Error(
      "Property '" + timeline.key + "' is already written at time level " + writing.time +
      " by repeater '" + (owner.chainHead.rootRepeater.description || "unnamed") + "'s pipeline;" +
      " repeater '" + (intruder.description || "unnamed") + "' belongs to a different pipeline at the same" +
      " time level and cannot write it too. Parallel pipelines may read each other's properties" +
      " (seeing the latest writing), but each property has one writer pipeline per time level."
    );
  }

  function insertNewWriting(timeline, time, writer) {
    const writing = createTimelineWriting(time, writer);
    writing.timeline = timeline;
    spliceWritingIntoTimeline(timeline, writing);
    return writing;
  }

  // Re-splice a writing at wherever its (possibly just-reassigned) writer
  // now positions it. A stale writing being reused across a rerun (see
  // repeater.dispose()/finalizeStaleWritings()) was unlinked the moment it
  // was marked stale, so the common case here is a genuinely-unlinked
  // writing needing nothing more than a fresh splice - but a *second*
  // write to the same property within one run (see setHandlerObject's own
  // context.writings check) finds it already relinked from the first
  // touch, so this still needs to detach it from wherever it currently
  // sits before re-inserting it, the same as an ordinary already-linked
  // writing being moved would.
  function relinkWriting(writing) {
    if (writing.linked) {
      unlinkWriting(writing);
    }
    spliceWritingIntoTimeline(writing.timeline, writing);
  }

  // A writing's "effective" value for comparison purposes - whatever a
  // fresh read of it would see right now (see hasTimelineValue/
  // readTimelineValue), not necessarily what's already committed to
  // `.value`/`.set` (a stale writing mid-reuse only has its real answer in
  // nextValue until its owning partial closes - see
  // finalizeTouchedStaleWritings()).
  function writingEffectiveValue(writing) {
    if (writing.hasNextValue) return { set: true, value: writing.nextValue };
    return { set: writing.set, value: writing.value };
  }

  function writingsHaveSameEffectiveValue(a, b) {
    const ea = writingEffectiveValue(a);
    const eb = writingEffectiveValue(b);
    if (ea.set !== eb.set) return false;
    if (!ea.set) return true;
    return sameAsPrevious(ea.value, eb.value);
  }

  // A writing that just landed at `writing.previous`'s immediate successor
  // position (whether freshly inserted, or a stale writing just reused at
  // a new position - see setHandlerObject's own two call sites) may have
  // "overtaken" some of writing.previous's existing readers: a reader
  // whose own read position is after `writing`'s position resolved to
  // `writing.previous` only because `writing` didn't exist yet at read
  // time (see collectOvertakenPropertyObservers's own comment for why only
  // the immediate predecessor's observers can ever be affected). Left
  // uncorrected, that reader's dependency stays pinned to `writing.previous`
  // forever - it never learns `writing` is now the closer, correct answer,
  // so a later write to `writing` alone (never touching `writing.previous`
  // again) would silently fail to reach it.
  //
  // Strictly-after (`> 0`), not at-or-after: a recorded entry whose
  // position *equals* writing's own can only be writing's own writer
  // reading this same timeline earlier in its own execution, then writing
  // it later in that same run (the ordinary read-then-write shape every
  // leaf repeater in renderOnto.js uses) - two distinct writers can never
  // compare equal (the order-chain invariant gives every live partial a
  // unique orderNumber; the one case that isn't ruled out that way,
  // writer===null for two different external writes, can't reach here in
  // the first place, since two external writes to the same property always
  // land on the very same already-exact-matching writing - see
  // setHandlerObject's `justInserted` comment). Treating a self-entry as
  // overtaken would mean invalidating - mid-execution - the very writer
  // that just produced this value, for a dependency that was never
  // actually stale.
  //
  // Whether deferring `entry`'s invalidation (flagging it, rather than
  // firing it right away) could ever matter - i.e. whether `entry` is a
  // genuine member of the *same* wavefront-ordered tree as whatever is
  // causing this settlement (`referenceWriter`). It isn't enough for
  // `entry` to belong to a repeater's partial at all: two repeaters with
  // no shared chainHead (see "Time as tree position" above) have no
  // execution sequence connecting them - nothing about "wait, something
  // between here and there might still undo this" applies, because there
  // is no "in between" for unrelated trees, only compareWriterOrder's own
  // arbitrary-but-stable chain-id tiebreak. Deferring such an entry
  // wouldn't be unsafe, just pointless complexity with no payoff - so it's
  // grouped with invalidators (see below) as "eager", not "deferred".
  // `referenceWriter === null` (an external, non-repeater write) means
  // there's no tree at all on the writing side either, so nothing gets
  // deferred relative to it.
  function entryNeedsDeferredTreatment(entry, referenceWriter) {
    return entry.observer.type === "partial"
      && referenceWriter !== null
      && entry.observer.repeater.chainHead === referenceWriter.repeater.chainHead;
  }

  // Whether a stale writing about to be reused (see setHandlerObject's
  // staleQueue branch) actually needs to be retired instead - i.e.
  // whether it currently has *any* observer that entryNeedsDeferredTreatment
  // would defer. If not - no observers at all, or every current observer
  // is eager-eligible (an invalidator, or same-time legacy code in an
  // unrelated chain) - reusing it in place is exactly as safe as it
  // always was: finalizeTouchedStaleWritings' own eager notify-if-
  // different is the right treatment for all of them anyway, so there's
  // no reason to pay for a fresh writing object and a retire/settle pass
  // just to arrive at the same outcome. `writer` is the same reference
  // the candidate's own `.writer` is about to be reassigned to (see the
  // `writing.stale` branch just below), so checking against it here
  // rather than the candidate's own (about-to-be-stale) writer gives the
  // right answer for what it's *becoming*, not what it used to be.
  function staleWritingNeedsRetirement(candidate, writer) {
    if (candidate.observers === null) return false;
    return collectOvertakenPropertyObservers(candidate, () => true)
      .some((entry) => entryNeedsDeferredTreatment(entry, writer));
  }

  // What happens to an overtaken entry:
  //
  //  - Same effective value either way: always just repoint, silently, no
  //    matter which kind of entry it is - nothing observable changes, and
  //    any *later* writing that further supersedes this one gets its own
  //    independent chance to notice and re-check, since the entry simply
  //    follows wherever it's currently parked.
  //  - Different value, not eligible for deferred treatment (see
  //    entryNeedsDeferredTreatment - an invalidator, whose `time ===
  //    Infinity` read means it always wants "whatever's latest, right
  //    now" and was never part of any tree-position ordering to begin
  //    with; or a partial from an entirely unrelated chain): repoint AND
  //    invalidate right now, same as this always worked - neither has any
  //    notion of "the wavefront hasn't reached it yet" to wait for.
  //  - Different value, same-tree partial entry: do NOT repoint or
  //    invalidate yet - flag it instead (flagRepeaterEntry) and leave it
  //    exactly where it is. A's change might still be undone by B before
  //    execution ever actually reaches this reader (see the A/B/C
  //    discussion this came out of) - repointing or invalidating this
  //    early would be exactly "invalidation traveling faster than the
  //    computation front". Left parked on `previous`, the entry stays
  //    correctly, automatically covered by `previous`'s own ordinary
  //    invalidation too: if `previous` itself later genuinely changes
  //    before the flag is ever resolved, that fires directly, for real,
  //    bypassing the flag entirely - exactly as it should.
  //
  // Shared by migrateOvertakenObserversFor (an existing dependency
  // overtaken by a closer writing) and retireWritingOnto (a stale writing
  // that couldn't safely be reused, so a fresh writing takes its place at
  // the same slot instead) - to `oldWriting`'s own observers, the two
  // situations look identical: some other writing (`newWriting`) is now
  // the correct answer instead of `oldWriting`.
  function settleOvertakenObservers(oldWriting, newWriting, entries) {
    if (entries.length === 0) return;
    const sameValue = writingsHaveSameEffectiveValue(oldWriting, newWriting);
    entries.forEach((entry) => {
      if (entry.flagged) return; // already pending a deferred recheck - let that recheck re-seek fresh rather than layering another guess on top
      if (sameValue) {
        relocatePropertyObserverEntry(oldWriting, newWriting, entry);
        return;
      }
      if (entryNeedsDeferredTreatment(entry, newWriting.writer)) {
        flagRepeaterEntry(entry.observer.repeater, entry, oldWriting);
      } else {
        relocatePropertyObserverEntry(oldWriting, newWriting, entry);
        invalidateObserver(entry.observer, newWriting.timeline.handler.proxy, newWriting.timeline.key);
      }
    });
  }

  function migrateOvertakenObserversFor(writing) {
    const previous = writing.previous;
    if (previous === null) return;
    const overtaken = collectOvertakenPropertyObservers(
      previous,
      (entryTime, entryWriter) => compareWritingToReader(writing.time, writing.writer, entryTime, entryWriter) < 0
    );
    settleOvertakenObservers(previous, writing, overtaken);
  }

  // A stale writing this repeater could have reused (see setHandlerObject's
  // staleQueue branch) but didn't, because it still had live observers -
  // reusing it would have meant mutating its `.value` in place and then
  // having to decide, immediately and unconditionally, whether to notify
  // them (see finalizeTouchedStaleWritings) - exactly the eager treatment
  // a tree-ordered (partial-type) observer must never get. So the old
  // writing was abandoned outright instead (unlinked, its own `.value`
  // frozen exactly as it was) and `newWriting` was inserted fresh at that
  // same slot. Every one of `oldWriting`'s observers - unconditionally,
  // not just ones positioned after `newWriting` - needs to move onto
  // `newWriting` now that it's the real answer for that slot; there's no
  // positional filter here the way migrateOvertakenObserversFor has, since
  // `oldWriting` isn't being *overtaken from some positions on*, it's
  // being fully retired.
  function retireWritingOnto(oldWriting, newWriting) {
    if (oldWriting.observers === null) return;
    const allEntries = collectOvertakenPropertyObservers(oldWriting, () => true);
    settleOvertakenObservers(oldWriting, newWriting, allEntries);
  }

  function getOrCreateExactWriting(handler, key, time, writer) {
    const timeline = getOrCreateTimeline(handler, key);
    return findExactWriting(timeline, time, writer) || insertNewWriting(timeline, time, writer);
  }

  // Enumeration doesn't get its own multi-writing, spliced timeline the
  // way properties do (see docs/plan-array-timelines.md - that's a bigger,
  // separate undertaking, and a repeater's own enumeration writing would
  // need the same staleWritings-style reconciliation across reruns that
  // properties get via dispose(); without it, old reruns' writings would
  // just accumulate, pointing at partials no longer in the live
  // order-number chain - exactly what an earlier attempt at this ran into,
  // caught by the structural order verifier). There's still just the one,
  // permanently reused writing per handler - but instead of firing every
  // one of its observers unconditionally on any key add/remove, this only
  // fires the ones positioned strictly *after* the change (compareWritingToReader
  // > 0), leaving readers that already ran before it untouched. Always
  // eager, never flagged: flagging only pays off when there's a genuinely
  // fresher writing to defer resolution against later (see
  // resolveFlaggedRepeater's own live re-seek) - with a single writing
  // that's never replaced, that resolution would always trivially resolve
  // back to itself and never detect a real change.
  function invalidateDownstreamEnumerationObservers(writing, time, writer, proxy, key) {
    if (writing.observers === null) return;
    const downstream = collectOvertakenPropertyObservers(
      writing,
      (entryTime, entryWriter) => compareWritingToReader(time, writer, entryTime, entryWriter) < 0
    );
    downstream.forEach((entry) => invalidateObserver(entry.observer, proxy, key));
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
    writing.linked = false;
  }

  function getOrCreateTimelineWriting(handler, key, time, writer) {
    return seekWriting(getOrCreateTimeline(handler, key), time, writer);
  }

  function getOrCreateEnumerationTimelineWriting(handler, time, writer) {
    return seekWriting(getOrCreateTimeline(handler, enumerationTimelineKey), time, writer);
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
    if (typeof(timeline) === 'undefined') return false;
    const writing = seekWriting(timeline, time, writer);
    // hasNextValue - a buffered, not-yet-finalized write from this run
    // (see finalizeStaleWritings()) - is this property's real current
    // value regardless of who's asking; only the *notification* of
    // whether it net-changed from before is deferred, not its visibility
    // to a fresh read.
    return writing.hasNextValue || writing.set;
  }

  function readTimelineValue(handler, key, time, writer) {
    const timeline = handler.timelines[key];
    if (typeof(timeline) === 'undefined') return undefined;
    const writing = seekWriting(timeline, time, writer);
    if (writing.hasNextValue) return writing.nextValue;
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

    // State properties (see declareState()) may only be written outside
    // any repeater - from an event handler, or at initial time via
    // accessInitialValues(), which nulls state.context and so passes here.
    if (this.meta.stateProperties && this.meta.stateProperties.has(key) && state.inRepeater !== null) {
      throw new Error(
        "Cannot write state property '" + key + "' from inside a repeater. " +
        "State is written at initialization (declareState/initializeState), from an event handler outside any repeater, " +
        "or deliberately at initial time via accessInitialValues()/setState()."
      );
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

    // Did this exact partial already write this exact timeline earlier in
    // this same run (a plain repeated write, no child boundary in
    // between - "only the last one counts")? Reuse whatever it already
    // resolved to, rather than re-consulting either reconciliation
    // source below - those each only ever get consulted once per (this
    // repeater, this timeline, this occurrence) per run.
    let writing = context && context.writings ? context.writings.get(timeline) : undefined;
    // Whether `writing` was spliced into the timeline at a brand-new
    // position by *this very call* (as opposed to an ordinary rewrite of
    // an already-existing writing at the same position) - see
    // migrateOvertakenObserversFor()'s own comment for why that matters:
    // only a genuinely fresh splice can possibly overtake an existing
    // reader of whatever writing used to be its immediate predecessor.
    let justInserted = false;
    // Set when a stale writing existed for this (repeater, timeline)
    // occurrence but couldn't safely be reused (see the staleQueue branch
    // below) - resolved once the fresh writing this call falls through to
    // creating has its own final value, via retireWritingOnto().
    let retiredWriting = null;

    if (typeof(writing) === 'undefined') {
      const repeater = writer !== null ? writer.repeater : null;
      const staleQueue = repeater !== null && repeater.staleWritings !== null
        ? repeater.staleWritings.get(timeline)
        : undefined;
      if (staleQueue && staleQueue.length > 0) {
        // Reconciling against this exact repeater's own prior writing for
        // this exact property (see repeater.dispose()) - by timeline
        // identity, not position, so this still works even when this
        // repeater's own structure changed enough since last run to break
        // positional reconciliation (see docs/plan-partial-repeaters.md).
        // A queue, not a single writing, because this same repeater can
        // write the very same property more than once in one run, from
        // different partials (the padding/spaceLeft "before"/"between"/
        // "after" pattern) - each occurrence must reconcile against its
        // own corresponding occurrence from last run, consumed in the
        // same order both times (see repeater.dispose()'s own comment).
        const candidate = staleQueue.shift();
        if (staleQueue.length === 0) repeater.staleWritings.delete(timeline);
        if (staleWritingNeedsRetirement(candidate, writer)) {
          // Reuse would mutate this exact object's `.value` in place, and
          // that mutation must decide - immediately, unconditionally - to
          // notify its current observers if the value differs (see
          // finalizeTouchedStaleWritings). That's fine for an observer
          // staleWritingNeedsRetirement() judged eager-eligible (an
          // invalidator, or a same-time legacy dependent from an entirely
          // different chain - see entryNeedsDeferredTreatment), but never
          // for a genuine same-tree (partial-type) observer, which needs
          // the same flagged, deferred-until-the-wavefront-arrives
          // treatment migrateOvertakenObserversFor already gives a
          // dependency overtaken by a closer writing. So: don't reuse this
          // occurrence at all. Abandon it outright - its own `.value`
          // stays frozen exactly as it is, a safe, stable reference for
          // whichever of its observers must defer their own comparison -
          // and fall straight through to an ordinary fresh insertion
          // below, as if this repeater had never written this property
          // before. retireWritingOnto() (called once the fresh writing's
          // own value is known) settles its former observers exactly like
          // any other retired writing's.
          retiredWriting = candidate;
        } else {
          writing = candidate;
          // Finalized (compared, reused-or-notified) the moment *this*
          // partial closes, not deferred to the whole repeater's run -
          // see createPartial()'s own comment on touchedStaleWritings for
          // why.
          if (context.touchedStaleWritings === null) context.touchedStaleWritings = [];
          context.touchedStaleWritings.push(writing);
        }
      }
      if (typeof(writing) === 'undefined') {
        writing = findExactWriting(timeline, time, writer);
        if (writing === null) {
          writing = insertNewWriting(timeline, time, writer);
          justInserted = true;
        }
      }
    }

    if (writing.stale) {
      // Still mid-reconciliation for this repeater's current run -
      // deliberately *not* compared against the old value or notified yet,
      // only buffered into nextValue. A property this repeater sets,
      // unsets, and sets again within one run must settle once, when the
      // whole run finishes (see finalizeStaleWritings()), against the real
      // before/after - not once per intermediate write. The writer/
      // position *do* need to move now, though, on every touch - not
      // deferred - so any later same-run read (of this exact writing,
      // whether by this repeater itself or a child reading what it just
      // established) resolves correctly via ordinary position comparison.
      // migrateOvertakenObserversFor() is *not* called here, deliberately
      // - see finalizeTouchedStaleWritings()'s own comment on why it has
      // to wait until this writing's own before/after is settled first.
      writing.hasNextValue = true;
      writing.nextValue = value;
      writing.writer = writer;
      relinkWriting(writing);
      if (context && context.writings) {
        context.writings.set(timeline, writing);
      }
      return true;
    }

    const undefinedKey = !writing.set;
    const previousValue = writing.value;

    // If same value as already set, nothing observable changed.
    if (writing.set && sameAsPrevious(previousValue, value)) {
      return true;
    } // TODO: It would be even safer if we write protected non observable data structures that are assigned, if we are using mode: useNonObservablesAsValues

    writing.value = value;
    writing.set = true;

    if (context && context.writings) {
      context.writings.set(timeline, writing);
    }

    invalidateWritingObservers(writing, this.proxy, key);
    // Deliberately after invalidateWritingObservers, not before: a brand
    // new writing always fires its own (pre-migration, empty) observers
    // unconditionally on this first write, regardless of value - if a
    // migrated reader were already sitting in there when that ran, it
    // would get invalidated for free even when its actual value didn't
    // change, defeating the whole point of migrateOvertakenObserversFor's
    // own value comparison. Migrating afterward keeps that decision
    // entirely independent of "is this writing's very first notification."
    if (justInserted) migrateOvertakenObserversFor(writing);
    // Same reasoning, for a stale writing this run couldn't safely reuse
    // (see the staleQueue branch above) - `writing` is always freshly
    // inserted whenever `retiredWriting` is set, so this always runs
    // alongside the migration above, against a different (and possibly
    // entirely absent) predecessor.
    if (retiredWriting !== null) retireWritingOnto(retiredWriting, writing);
    if (undefinedKey) invalidateEnumerateObservers(this, key, time, writer);

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
    invalidateEnumerateObservers(this, key, time, writer);
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

    const time = currentReadTime();
    const writer = currentWriter();
    if (state.inActiveRecording) recordDependencyOnEnumeration(state.context, this, time, writer);

    let keys = Object.keys(target);
    timelineDataKeys(this, time, writer).forEach(function(timelineKey) {
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

    const time = currentReadTime();
    const writer = currentWriter();
    if (state.inActiveRecording) recordDependencyOnEnumeration(state.context, this, time, writer)
    if (hasTimelineValue(this, key, time, writer)) return true;
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

    invalidateEnumerateObservers(this, "define property", currentTime(), currentWriter());
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

    const time = currentReadTime();
    const writer = currentWriter();
    if (state.inActiveRecording) recordDependencyOnEnumeration(state.context, this, time, writer)
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (typeof(descriptor) !== 'undefined') return descriptor;
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
        // Object.create(null), not {} - this is used as a map from
        // property key to timeline (see hasTimelineValue/getOrCreateTimeline),
        // checked via `typeof timelines[key] === 'undefined'`. A plain {}
        // has its own prototype chain, so a key that collides with one of
        // Object.prototype's own member names ("toString", "valueOf",
        // "hasOwnProperty", "constructor", ...) resolves to *that*
        // built-in function instead of undefined - hasTimelineValue's own
        // check never catches it, and whatever called seekWriting with it
        // crashes reading .time off a function that obviously has no such
        // property. Never triggered before a real, user-defined
        // toString() existed on any observable's own prototype (see
        // cascade.component's Component.toString()) for anyone to ever
        // actually read - this file's own timelines lookup was already
        // this fragile, just never exercised.
        timelines : Object.create(null),
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
          // Same build id but a different kind of object (a theme swap
          // turning key "save" from one button class into another, say):
          // not the same thing rebuilt, but a replacement. Merging the new
          // object's properties into the established one would keep the old
          // class - its old methods and behavior - under new data, so it is
          // created fresh instead, and the established one is disposed (see
          // finishRebuilding()'s dispose pass).
          && Object.getPrototypeOf(repeater.buildIdObjectMap[buildId][objectMetaProperty].target) === Object.getPrototypeOf(target)
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
      // Writings this partial itself produced, last run - see
      // repeater.dispose() (which collects these, across all of a
      // repeater's own partials, into the repeater-level staleWritings
      // map) and finalizeStaleWritings().
      writings: new Map(),
      // Stale writings (see repeater.dispose()/finalizeStaleWritings())
      // this specific partial has claimed and buffered a nextValue for so
      // far - finalized (compared, reused-or-notified) the moment *this*
      // partial closes (see attachToCurrentParent()/refresh()), not
      // deferred until the whole repeater's run finishes. That scoping
      // matters: a repeater's later partial's own reads (or an entirely
      // different repeater's, interleaved via the dirty queue) may depend
      // on what an *earlier* partial of this same repeater just wrote,
      // and need to see that notification in real time, in the same
      // relative order the old writes themselves happened in - not have
      // it batched up behind everything the rest of this run's later
      // partials also happen to touch.
      touchedStaleWritings: null,
      // Sibling pointers within the owning repeater's children/
      // pendingChildren list (partials and real child repeaters share one
      // list) - see createChildList()/attachToCurrentParent() below.
      nextSibling: null,
      previousSibling: null,
      // This partial's position in its root repeater's partial chain (see
      // "Time as tree position" above) - orderNumber compares in O(1);
      // orderNext/orderPrevious are this chain's own linked-list pointers,
      // distinct from nextSibling/previousSibling above (which are purely
      // structural, per-parent creation order, used for reconciliation).
      orderNumber: null,
      orderNext: null,
      orderPrevious: null,
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
    let reconciled = false;
    if (repeater.reconciling) {
      const oldPartial = repeater.pendingChildren.first;
      if (oldPartial !== null && oldPartial.type === "partial") {
        unlinkFromChildList(repeater.pendingChildren, oldPartial);
        removeAllSources(oldPartial);
        // Writings reconcile at the *repeater* level now, by timeline
        // identity, not per-partial-slot by position - see
        // repeater.dispose()/finalizeStaleWritings() - so there's no
        // writings hand-off to do here anymore; only the chain slot
        // itself is positional.
        // Same position as last time - inherit its exact chain slot
        // (orderNumber and neighbors) rather than inserting a new one.
        inheritOrderChainNode(repeater.chainHead, partial, oldPartial);
        reconciled = true;
      } else {
        repeater.reconciling = false;
      }
    }
    if (!reconciled) {
      insertPartialIntoChain(repeater.chainHead, partial);
    }
    repeater.rightmostPartial = partial;
    partial.parentRepeater = repeater;
    partial.listMembership = "confirmed";
    repeater.currentPartial = partial;
    appendToChildList(repeater.children, partial);
    return partial;
  }

  // Every writing produced anywhere in `node`'s own subtree, as it stood
  // last run - `node` is a "moved-away predecessor" (see
  // attachToCurrentParent()): something still sitting, unclaimed, in
  // pendingChildren in front of wherever a sibling is being reconciled
  // right now. Purely a read - nothing here is retracted, disposed, or
  // unlinked; a moved-away predecessor may still be reused later this same
  // run (a shared child used by both branches of a conditional, say - see
  // this file's own git history for a real regression from retracting one
  // of those instead of leaving it alone) or swept up normally, once truly
  // unclaimed, by finalizeChildren() at the end of this parent's own run,
  // same as always. `node` is either one of parentRepeater's own partials
  // (its own writings live directly on it) or a genuinely nested child
  // repeater (recurse into its own `.children`, exactly the same mixed
  // partial/repeater list attachToCurrentParent()/createNextPartial()
  // build everywhere else).
  function collectSubtreeWritings(node, into) {
    if (node.type === "partial") {
      for (const writing of node.writings.values()) into.push(writing);
    } else {
      let inner = node.children.first;
      while (inner !== null) {
        collectSubtreeWritings(inner, into);
        inner = inner.nextSibling;
      }
    }
  }

  // Whether `repeater` is `subtreeRoot` itself or genuinely nested inside
  // it, walked via parentRepeater - the same upward walk
  // structuralWriterPath() uses, just stopping the moment it finds what
  // it's looking for rather than building the whole path.
  function repeaterIsWithinSubtree(repeater, subtreeRoot) {
    let r = repeater;
    while (r !== null) {
      if (r === subtreeRoot) return true;
      r = r.parentRepeater;
    }
    return false;
  }

  // A sibling (`child`) just found reconciling to a different position
  // than last time (see attachToCurrentParent()) may have its own real
  // dependency on something a *moved-away predecessor* - still sitting in
  // pendingChildren, structurally in front of where `child` is needed now
  // - wrote last run (e.g. `child` reads a shared DOMElementTarget's own
  // `lastChild`, last written by whichever sibling actually ran
  // immediately before it). That write was never invalidated or retracted
  // - the predecessor simply moved - but it's no longer structurally
  // reachable from `child`'s new position either, so an ordinary relink
  // (which only reconsiders a dependency when its *value* changes, never
  // when a reader's own position does) would silently leave `child`
  // depending on a stale answer.
  //
  // For each `predecessor` skipped over: collect every writing its own
  // subtree produced last run, and for each one, check whichever of its
  // own observers falls anywhere inside `child`'s own subtree - `child`
  // itself, or one of its own nested descendants. A build()-composed
  // subtree that never reads anything position-sensitive (most of one,
  // ordinarily) has no matching entries at all here and is left completely
  // untouched - only the specific partials that actually depended on the
  // predecessor's own output are ever considered, not `child`'s whole
  // subtree wholesale.
  //
  // Deliberately *not* routed through flagRepeaterEntry()/resolveFlaggedRepeater()'s
  // own deferred, re-seek-and-compare-values treatment (what an ordinarily
  // overtaken dependency gets): that machinery's own self-authored-write
  // fallback (seekWriting resolving to entry.writer's *own* later write,
  // then falling back to `.previous` - see resolveFlaggedRepeater()'s own
  // comment) assumes `.previous` (a fixed, timeline-insertion-order
  // pointer) is always still an accurate stand-in for "whichever writer
  // structurally precedes me" - true when only *new* writings are being
  // spliced in, false here, where the predecessor and `child` themselves
  // have been reordered relative to each other without any new writing
  // involved at all: `.previous` still points at the predecessor's old
  // writing regardless, so the value-comparison path silently concludes
  // "nothing changed" even though the dependency is no longer valid at
  // all (confirmed by direct instrumentation - see this file's own git
  // history). What actually matters here isn't "did the value change" (it
  // might not have, and this would still need retracting) - it's "is this
  // writing's own writer still structurally before this reader, now that
  // positions have actually changed" - compareWriterOrder (which already
  // prefers the always-correct structural walk, including its own
  // still-pending-vs-confirmed handling - see structuralCompareSiblings())
  // answers exactly that, directly, with no timeline seeking needed.
  //
  // Must be called only after `child` is itself already fully, structurally
  // confirmed and repositioned (see the call site in attachToCurrentParent()) -
  // otherwise `child` and `predecessor` both still read as "not yet
  // reattached this run", which compareWriterOrder can't tell apart, so it
  // falls back to stale order-numbers that still reflect *last* run's
  // order (confirmed by direct instrumentation - the whole mechanism
  // silently does nothing if called too early).
  function flagOverlapWithMovedPredecessor(predecessor, child) {
    const writings = [];
    collectSubtreeWritings(predecessor, writings);
    for (const writing of writings) {
      const entries = collectOvertakenPropertyObservers(writing, () => true);
      for (const entry of entries) {
        if (entry.flagged) continue;
        if (!repeaterIsWithinSubtree(entry.observer.repeater, child)) continue;
        if (compareWriterOrder(writing.writer, entry.writer) < 0) continue; // still genuinely before this reader - no problem
        entry.flagged = true;
        invalidateRepeater(entry.observer.repeater);
      }
    }
  }

  // The other half of the moved-predecessor problem: `child` just moved
  // *ahead* of some sibling that hasn't been reattached yet this run (a
  // "new predecessor appeared in front of it" - see this file's own git
  // history for the concrete case this was found from, and
  // domElementTarget.js/reorder-fuzz.js for the tests). Every writing `child`'s
  // own subtree produced last run is still exactly where it's always been
  // in its own property timeline - untouched, since nothing here rewrote
  // it - even though `child`'s live structural position (and everything
  // nested inside it) has just changed. An existing reader positioned
  // after `child`, still pointing at whatever it depended on *before*
  // `child` ever moved here, has no way to discover this on its own: the
  // ordinary "a fresh writing overtook my dependency" migration
  // (migrateOvertakenObserversFor) only ever fires as a side effect of an
  // actual write - and a descendant whose own reconciliation against its
  // own immediate parent still "lines up" (the fast path, just above)
  // never writes again this pass, no matter how far its own ancestor
  // moved.
  //
  // Every writing per distinct property within `child`'s own subtree needs
  // this, not just the last one - migrateOvertakenObserversFor only ever
  // checks *one hop* back (`writing.previous`'s own observers), the same
  // way an ordinary write only ever migrates against its own immediate
  // predecessor. An external reader parked several same-value "pass-
  // through" links back (e.g. sitting on a writing three ancestors above
  // where it actually needs to end up) only ever gets relayed forward one
  // hop at a time, exactly the way an ordinary run's chain of individual
  // rewrites would relay it - so every intermediate link in `child`'s own
  // subtree needs its own hop touched, in structural order, or the relay
  // stops wherever the touching does. This is still bounded, just not as
  // tightly as touching only the last one: it costs one relink+migrate
  // per writing `child`'s subtree actually produced on each property, the
  // same O(subtree writings) collectSubtreeWritings already walks for
  // flagOverlapWithMovedPredecessor above - not a new order of cost, just
  // matching output-side work to the input-side walk already being paid
  // for.
  //
  // Re-splicing each one to wherever it now structurally belongs (exactly
  // like movePartialToCurrentPosition does for the order-number chain,
  // just for this one writing's own position in its property timeline)
  // is what makes migrateOvertakenObserversFor's own `.previous` lookup
  // correct afterward - without this, a writing whose neighbor got
  // retired/unlinked out from under it (see retireWritingOnto) can be
  // left pointing at a stale, no-longer-adjacent neighbor, so the
  // overtaking check it triggers would ask the wrong question.
  function retouchSubtreeWritings(child) {
    const writings = [];
    collectSubtreeWritings(child, writings);
    const byTimeline = new Map();
    for (const writing of writings) {
      if (!writing.linked) continue; // already retired/replaced by something else this run
      let list = byTimeline.get(writing.timeline);
      if (!list) {
        list = [];
        byTimeline.set(writing.timeline, list);
      }
      list.push(writing);
    }
    for (const list of byTimeline.values()) {
      // Structural (execution) order, earliest first - each one's own
      // migration needs its predecessor already re-spliced correctly, the
      // same dependency an ordinary run's own sequence of writes always
      // has for free.
      list.sort((a, b) => compareWriterOrder(a.writer, b.writer));
      for (const writing of list) {
        relinkWriting(writing);
        migrateOvertakenObserversFor(writing);
      }
    }
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
    let skippedPredecessors = null;
    let reconciliationBroke = false;

    if (parentRepeater.reconciling && parentRepeater.pendingChildren.first === child) {
      // Structure still lines up with last time - pure bookkeeping, nothing
      // about the child's own state (sources, writings, its own children)
      // is touched at all.
      unlinkFromChildList(parentRepeater.pendingChildren, child);
    } else {
      reconciliationBroke = true;
      parentRepeater.reconciling = false;
      if (child.parentRepeater === parentRepeater && child.listMembership === "pending") {
        // This exact child existed under this exact parent last run too -
        // just not at the very front of what's left in pendingChildren.
        // Everything still sitting *ahead* of it there is a moved-away
        // predecessor: it didn't show up again where it used to be, either
        // genuinely dropped from the tree, or shifted *later* in this new
        // order (its own turn just hasn't come yet - a shared child used
        // by more than one branch, say). Which of those it is isn't
        // decidable yet, with no lookahead - so it is deliberately left
        // alone here, not retracted (an earlier attempt at exactly that
        // caused a real regression - see this file's own git history: it
        // can't tell "gone" from "coming up again shortly" apart, and
        // retracting the wrong one throws away a live repeater's own
        // dependency tracking). It's still reclaimable later this same
        // run if its own turn does come (the ordinary `listMembership ===
        // "pending"` check this whole branch already relies on), or swept
        // up normally by finalizeChildren() once this parent's whole run
        // finishes, exactly as always.
        //
        // What *does* need handling right now: anything that predecessor's
        // own subtree wrote last run - never invalidated or retracted,
        // since it only moved - is no longer structurally reachable from
        // `child`'s new position, so an ordinary relink (which only
        // reconsiders a dependency when its *value* changes, never when a
        // reader's own position does) would silently leave `child` - or
        // one of its own nested descendants - watching a stale answer.
        // flagOverlapWithMovedPredecessor() finds exactly those readers -
        // but needs `child` itself already fully, structurally reattached
        // and repositioned first (below), not just found here: it asks
        // "is the predecessor's own writer still structurally before this
        // reader", and both `child` and a still-pending predecessor
        // otherwise compare as "equally not yet reattached this run" -
        // undecidable - falling back to stale order-numbers that still
        // reflect *last* run's order, the opposite of what's needed. So
        // this list of predecessors is only *collected* here; the actual
        // check happens after `child`'s own reattachment, further below.
        skippedPredecessors = [];
        let node = parentRepeater.pendingChildren.first;
        while (node !== child) {
          skippedPredecessors.push(node);
          node = node.nextSibling;
        }
        unlinkFromChildList(parentRepeater.pendingChildren, child);
      }
      // Once reconciliation has broken, this child's own rightmostPartial
      // can no longer be trusted to already reflect "right here, right
      // now" the way it does in the reconciled fast path (there, nothing
      // about the sequence changed, so its old position was still
      // correct) - see movePartialToCurrentPosition()'s own comment for
      // the concrete failure this causes if left uncorrected (a sibling's
      // fresh write can silently become invisible to this child later).
      // Best-effort only for now, not relied on for correctness -
      // compareWriterOrder() prefers the always-correct structural
      // (parent/sibling) comparison when one is available (see its own
      // comment) precisely because a whole reordered subtree can leave
      // this order-number bookkeeping genuinely wrong, not just stale.
      if (child.rightmostPartial) {
        movePartialToCurrentPosition(parentRepeater.chainHead, child.rightmostPartial);
      }
    }
    // Claimed by a different parent than the one it currently belongs to
    // (a child moved between two sibling subtrees - see
    // cascade.component's renderContextTransplant.js): detach it from the
    // old parent's list first. appendToChildList() below only overwrites
    // the node's own sibling pointers, so without this the old parent's
    // list keeps a stale reference - and when the old parent reruns, its
    // finalizeChildren() retracts the child right out from under its new
    // owner. Which parent reruns first is up to the scheduler, so this
    // only bit in one direction of the move.
    const oldParent = child.parentRepeater;
    if (oldParent && oldParent !== parentRepeater && child.listMembership) {
      unlinkFromChildList(child.listMembership === "pending" ? oldParent.pendingChildren : oldParent.children, child);
    }
    child.parentRepeater = parentRepeater;
    child.listMembership = "confirmed";
    if (typeof(child.retracted) !== 'undefined') child.retracted = false;
    appendToChildList(parentRepeater.children, child);
    // Only now - `child` is fully, structurally confirmed and repositioned
    // above, so comparing a moved-away predecessor's own writer against it
    // (compareWriterOrder, inside flagOverlapWithMovedPredecessor) reflects
    // *this* run's real order, not a stale or undecidable one.
    // The reverse direction - see retouchSubtreeWritings's own comment.
    // Scoped to "reconciliation broke for this child at all" (same
    // condition as movePartialToCurrentPosition above), not to whether
    // anything was actually skipped to reach *it* - a child with no
    // skipped predecessors of its own can still be the *cause* of a later
    // sibling needing this (see reorder-fuzz.js's own tests). Must run
    // *before* flagOverlapWithMovedPredecessor below - that call may
    // invalidate `child` itself (a direct dependency on a skipped
    // predecessor), and invalidating disposes it, which resets its own
    // `.children` into `.pendingChildren` for its *own* upcoming
    // reconciliation - collectSubtreeWritings needs `child`'s subtree
    // exactly as it stood last run, still intact via `.children`.
    if (reconciliationBroke) {
      retouchSubtreeWritings(child);
    }
    if (skippedPredecessors !== null) {
      for (const predecessor of skippedPredecessors) {
        flagOverlapWithMovedPredecessor(predecessor, child);
      }
    }

    // Whatever comes next in the parent's own sequence belongs immediately
    // after this whole child subtree in chain order - advance the cursor to
    // the child's own rightmost partial (always its last partial overall,
    // regardless of nesting, since a repeater's own final partial is by
    // construction the last thing anywhere in its subtree). Needed even
    // when the child itself didn't just rerun (a clean relink, or one that
    // reran independently earlier via the dirty queue): either way,
    // rightmostPartial (unlike currentPartial) is never nulled out, so it
    // always reflects the child's true current position here.
    parentRepeater.chainHead.executionCursor = child.rightmostPartial;

    // This partial's writes are complete now - any of them reconciled
    // against this repeater's own stale prior writings (see
    // repeater.dispose()) settle here, synchronously, not deferred until
    // the whole repeater's run finishes - see
    // finalizeTouchedStaleWritings()'s own comment for why.
    finalizeTouchedStaleWritings(parentContext);

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
      // Fully gone from the tree now, not just unlinked from this list -
      // so a later relink attempt (attachToCurrentParent's `listMembership
      // === "pending"` check) can't mistake it for still being reclaimable
      // from here.
      node.listMembership = null;
      if (node.type === "partial") {
        removeAllSources(node);
        retractPartialChainSlot(node);
      } else {
        // May already be retracted - see retractRepeater() below: a child
        // retracted early, on its own, stays in its parent's confirmed
        // children list until the parent's own next rerun brings it here,
        // where it just needs unlinking (done above), nothing more.
        retractRepeater(node);
      }
      node = next;
    }
    repeater.pendingChildren = createChildList();
  }

  // Genuinely retract a repeater: it is not running again unless something
  // relinks it (see linkRepeater()/Component.renderOnto()'s wasRetracted
  // path). The normal route here is finalizeChildren() above - a child
  // simply not relinked during its parent's rerun. Exposed on its own
  // because that route can lose a race: the parent's own dispose() at the
  // start of that rerun unlinks all of its prior run's writings, and a
  // child that depended on one of them (a property written into it at
  // construction, say) is thereby invalidated and scheduled *before* the
  // rerun even gets as far as noticing the child is gone. If the child is
  // also being dropped from the tree in this same rerun, finalizeChildren
  // only ever reaches it once whatever renders it next actually reruns -
  // which the heap can easily get to *after* the child's own stale,
  // already-scheduled rerun. Retracting it here instead, the moment its
  // build identity is known to have vanished (see finishRebuilding()'s
  // dispose-event branch, and Component.onDispose()), is what makes the
  // scheduler's own `if (repeater.retracted) continue` check actually
  // catch it in time. Idempotent - retracting twice is a no-op.
  function retractRepeater(node) {
    if (node.retracted) return;
    node.dispose();
    finalizeChildren(node);
    // node itself is never running again to reclaim any of its own
    // staleWritings via a fresh write - what's left there (nothing
    // was ever claimed, since it never reran) is genuinely gone.
    finalizeStaleWritings(node);
    // Pure hygiene, not a correctness requirement - a disposed/
    // retracted repeater found sitting in a heap is already
    // unconditionally discarded regardless of workStatus (see
    // drainActivePipeline()), but there's no reason to leave a
    // dangling workStatus/flagRecords around on something that will
    // never run again either.
    node.workStatus = null;
    node.flagRecords = null;
    node.retracted = true;
    // Fires exactly once per genuine retraction (not on every dispose()
    // - a rerun or a relink never reaches here). For side effects the
    // reactive system doesn't know about (a DOM node parented outside
    // any observable, a subscription, ...) that need cleaning up even
    // though the repeater itself stays alive and re-linkable. If the
    // repeater is later relinked and retracted again, this fires again.
    if (node.options.onRetract) node.options.onRetract(node);
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
      // createPartial() above and refresh() below. Nulled by dispose() at
      // the start of every rerun (see there for why).
      currentPartial: null,
      // Same idea, but never nulled - always this repeater's own most
      // recent partial, even mid-dispose/mid-rerun. By construction it's
      // also the rightmost partial in this repeater's *entire* subtree
      // (a repeater's own final partial is always the last thing anywhere
      // below it), so attachToCurrentParent() uses it, unconditionally, to
      // advance the parent's chain cursor past a child it's attaching -
      // whether or not that child actually reran just now.
      rightmostPartial: null,
      // This repeater's own *first* partial of its current/latest run -
      // set fresh every refresh() (see there), never left pointing at a
      // stale object across reruns. The position used for this repeater's
      // own heap entry (see "Repeater scheduling" below) - has to be the
      // first partial, not rightmostPartial: a child's first partial is
      // always created strictly after its parent's own first partial
      // begins (the parent's own action is what creates the child), so
      // first-partial ordering guarantees a parent's heap entry always
      // sorts before any of its descendants' - exactly what makes the
      // lazy-pruning discard in drainActivePipeline() correct.
      // rightmostPartial has the opposite property (by construction it's
      // always >= any descendant's), so it would sort a parent *after*
      // its own children - the wrong direction.
      firstPartial: null,
      // Which root repeater's partial chain this repeater's own partials
      // get their orderNumber from - see "Time as tree position" above.
      // Set once, at creation (repeat()), from the parent active at that
      // moment (or a fresh chain if there is none); never reassigned after.
      chainHead: null,
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
      // This repeater's own writings from its previous run, keyed by
      // timeline (each a FIFO queue, not a single writing - see
      // dispose()'s own comment on why: this same repeater can easily
      // write the very same property more than once in one run, from
      // different partials), from the moment dispose() marks them stale
      // until each is either claimed this run (moved into
      // touchedStaleWritings below) or left here to be genuinely
      // abandoned once this repeater's current run finishes (see
      // finalizeStaleWritings()). Timeline-identity-keyed, not
      // position-keyed - this is what lets a rerun whose own structure
      // changed enough to break positional reconciliation still recognize
      // "I already have a writing for this exact property" instead of
      // always creating a fresh one (and always notifying, even when
      // nothing really changed). Lazily created (most repeaters never
      // write anything of their own). Never shared with another repeater -
      // see finalizeStaleWritings()'s note on why writings can't be reused
      // across repeaters.
      staleWritings: null,
      // Dependencies of this repeater's own (still-live, not-yet-rerun)
      // partials that migrateOvertakenObserversFor found possibly
      // overtaken by a closer writing, but couldn't yet resolve for real -
      // see flagRepeaterEntry()/resolveFlaggedRepeater(). Each entry is
      // {entry, previousWriting}: `entry` is the very same {observer,
      // time, writer, flagged} object still sitting in
      // `previousWriting.observers` (untouched - see
      // migrateOvertakenObserversFor's own comment on why leaving it
      // there is exactly what keeps it covered by previousWriting's own
      // ordinary invalidation in the meantime). Lazily created; null means
      // "nothing pending".
      flagRecords: null,
      // null | 'invalid' | 'flagged' - see "Repeater scheduling" above.
      // 'invalid' always wins over 'flagged' and is never downgraded back
      // (see flagRepeaterEntry()). Cleared (back to null) the moment
      // processRepeater() actually acts on it.
      workStatus: null,
      // Two separate dedup flags, for the two different places a repeater
      // can be waiting in the scheduler - see scheduleWork(). A root
      // repeater (parentRepeater === null) only ever uses inATimeBucket;
      // inHeap stays false for it forever, since a root never enters a
      // heap (see drainActivePipeline() - it's always checked directly
      // instead, being unconditionally the earliest position in its own
      // pipeline). A nested repeater only ever uses inHeap.
      inHeap: false,
      inATimeBucket: false,
      nextToNotify: null,
      repeaterAction : modifyRepeaterAction(repeaterAction, options),
      nonRecordedAction: repeaterNonRecordingAction,
      options: options ? options : {},
      finishRebuilding() {
          finishRebuilding(this);
      },
      time() {
        // Every repeater sharing one chainHead executes at exactly the
        // same, single time level - see createChainHead()'s own comment
        // on why. This delegates rather than re-reading this.options.time
        // directly so a nested repeater's own options.time (which should
        // never legitimately differ, but isn't otherwise prevented from
        // being set) can't silently desync it from its pipeline.
        return this.chainHead.time;
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
        // A retracted child comes back by being relinked into its parent
        // (attachToCurrentParent() clears `retracted`) before it's
        // restarted. A retracted root - an {independent: true} repeater
        // stopped by its owner with retractRepeater() - has no parent to
        // relink it, so restarting it is what brings it back.
        if (this.retracted && this.parentRepeater === null) this.retracted = false;
        this.invalidateAction();
      },
      invalidateAction() {
        invalidateRepeater(this);
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
        // No explicit removal from the scheduler needed here (unlike the
        // old detatchRepeater() this replaced) - workStatus/inHeap/
        // inATimeBucket are what track "is this repeater scheduled" now,
        // not list membership toggled from inside dispose(), and a
        // disposed-or-retracted repeater found sitting in a heap gets
        // discarded for free at pop time (see drainActivePipeline()).
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
          // attachToCurrentParent(). Every partial's *writings* are
          // unlinked from their timelines right now, unconditionally - a
          // read that happens before this repeater actually reruns
          // (another repeater interleaved via the dirty queue, or an
          // ancestor's own later code - see renderOnto.js case 1) must not
          // see this repeater's stale prior output; it needs to fall
          // through to whatever's now below it, same as always - this
          // repeater doesn't get to keep asserting a value it's already
          // known to be reconsidering, even before it's had its own chance
          // to rerun and confirm or replace it.
          //
          // The writing objects themselves aren't discarded, though -
          // marked stale and collected into this.staleWritings, keyed by
          // timeline rather than position, ready to be reused (same
          // object, relinked at its new position) the moment this
          // repeater's own fresh run writes that same property again -
          // see setHandlerObject()/finalizeStaleWritings(). That's what
          // lets a rerun whose structure changed enough since last time to
          // break positional reconciliation still recognize "I already
          // have a writing for this exact property" instead of always
          // creating a fresh one (and always notifying, even when nothing
          // really changed) - the actual gap this whole mechanism exists
          // to close. A *queue* per timeline, not a single writing:
          // this same repeater can easily write the same property more
          // than once in one run, at different positions (the classic
          // padding/spaceLeft pattern - "before", "between", and "after" a
          // child, all writes to the very same property, from three
          // different partials of this one repeater) - each needs to
          // reconcile against its own corresponding occurrence from last
          // run, not all three collapsing onto whichever one dispose()
          // happened to visit last. children.first is walked in the same
          // order every run (structural, creation order), so appending
          // here and consuming FIFO in setHandlerObject lines up the Nth
          // write this run with the Nth write last run.
          let node = this.children.first;
          while (node !== null) {
            node.listMembership = "pending";
            if (node.type === "partial") {
              node.writings.forEach((writing, timeline) => {
                unlinkWriting(writing);
                writing.stale = true;
                if (this.staleWritings === null) this.staleWritings = new Map();
                let queue = this.staleWritings.get(timeline);
                if (typeof(queue) === 'undefined') {
                  queue = [];
                  this.staleWritings.set(timeline, queue);
                }
                queue.push(writing);
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
        // Set fresh every run, not just once - see firstPartial's own
        // comment on why a stale reference across reruns would be wrong.
        repeater.firstPartial = partial;

        // Recorded action (cause and/or effect)
        repeater.isRecording = true;
        const contextBeforeThisRun = state.context;
        enterContext(partial);
        try {
          repeater.returnValue = repeater.repeaterAction(repeater);
        } catch (error) {
          // Contain the damage: state.context is a single, module-level
          // pointer, not scoped to this repeater or this call - left
          // pointing into this run's own (now-abandoned) context tree,
          // every read/write anywhere in the process afterward would be
          // mis-attributed to this defunct position, corrupting completely
          // unrelated components' own reconciliation (a component's
          // render() or build() throwing is the common real-world trigger -
          // see cascade.DOM/src/test/domNodeComponent.js). Unwind back to
          // wherever this repeater's own context was entered from, the
          // same as the success path eventually does (just immediately,
          // not after finalizeTouchedStaleWritings/finalizeChildren/
          // finishRebuilding below, none of which are safe to run against
          // a run that didn't finish - so this repeater's own
          // reconciliation state is left genuinely incomplete; only the
          // *rest of the process* is protected from it). Re-throws the
          // original error - this does not make a throwing repeaterAction
          // recoverable, only contained.
          repeater.isRecording = false;
          while (state.context !== null && state.context !== contextBeforeThisRun) {
            leaveContext(state.context);
          }
          throw error;
        }
        repeater.isRecording = false;
        updateContextState()

        // The action may have created/relinked children, which closes the
        // current partial and opens new ones (see attachToCurrentParent) -
        // so by now repeater.currentPartial may be a later partial than
        // the one we entered above, not `partial` itself.
        const finalPartial = repeater.currentPartial;

        // Finish rebuilding while the final partial is still open, before
        // any of this run's stale writings are settled or abandoned below.
        // Merging a rebuilt twin back into its established object (see
        // mergeInto()) writes that object's properties again - from this
        // repeater, in this run - so those writes reclaim the previous
        // run's writings of the same properties, the same as any rewrite,
        // and a property that didn't change settles quietly. Done after
        // the abandon step instead, every property of every established
        // object would first be abandoned - notifying all its readers -
        // and only then rewritten. Within one pipeline that notification
        // is deferred and rechecked, so it cost nothing; a reader in a
        // parallel pipeline (a component's render reading what its own
        // independent build repeater merged) is notified immediately and
        // reruns for nothing.
        finishRebuilding(this);

        // The final partial's own claimed stale writings (see
        // attachToCurrentParent for every earlier partial's own writings -
        // this repeater's own final one never went through there).
        finalizeTouchedStaleWritings(finalPartial);

        // Anything marked stale at the start of this rerun (see dispose())
        // that no partial of this run ever claimed is genuinely gone now
        // (this repeater's own writings), and likewise for any of its
        // children never re-linked this run.
        finalizeStaleWritings(repeater);
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
          // Identity, not just "is the key still there": a key rebuilt as a
          // different kind of object (see observable()'s build-id match) is
          // present this run too, but holds the replacement - the established
          // object it replaced is gone just the same.
          if (repeater.newBuildIdObjectMap[buildId] !== repeater.buildIdObjectMap[buildId]) {
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

    // {independent: true}: a new pipeline of its own even when created from
    // inside another repeater's run - never that repeater's child, never
    // retracted along with it, never part of its partial chain (so the
    // creator's own pipeline operations never have to visit it). Runs at
    // the creator's own time level unless `time` says otherwise, which
    // makes the two *parallel* pipelines - see compareWritingToReader():
    // each reads the other's latest writings, and each property has one
    // writer pipeline per level. Its first run is still synchronous, right
    // here, pushed onto the context stack above the creator's own partial;
    // later on, a creator that needs a fresh result mid-run can pull it the
    // same way with refreshIfNeeded(). Its lifecycle is the creator's
    // responsibility: retractRepeater() stops it, restart() resumes it.
    const independent = options.independent === true;
    const inheritedTime = (independent && typeof(options.time) === "undefined" && state.context !== null)
      ? currentTime()
      : undefined;

    if( warnOnNestedRepeater && state.inActiveRecording && !independent ){
      let parentDesc = state.context.description;
      if( !parentDesc && state.context.parent ) parentDesc = state.context.parent.description;
      if( !parentDesc ){
        parentDesc = 'unnamed';
      }
      if (configuration.traceWarnings) console.warn(Error(`repeater ${description||'unnamed'} inside active recording ${parentDesc}`));
    }
    
    // Activate!
    const repeater = createRepeater(description, repeaterAction, repeaterNonRecordingAction, options, finishRebuilding);
    // Establish chain membership *before* the first refresh() - attachToCurrentParent()
    // below sets parentRepeater too, but it only runs after refresh() returns,
    // too late for createNextPartial() to have a chainHead to insert this
    // repeater's very first partial into. The parent (if any) is exactly
    // whichever partial is currently executing right now.
    const parentContext = (!independent && state.context && state.context.type === "partial") ? state.context : null;
    repeater.parentRepeater = parentContext ? parentContext.repeater : null;
    repeater.chainHead = repeater.parentRepeater ? repeater.parentRepeater.chainHead : createChainHead(repeater);
    if (typeof(inheritedTime) !== "undefined") repeater.chainHead.time = inheritedTime;
    const result = repeater.refresh();
    // If created while nested inside another repeater's execution, this
    // repeater automatically becomes its child - closing the parent's
    // current partial and opening a fresh one for whatever parent code
    // comes next. See attachToCurrentParent().
    if (!independent) attachToCurrentParent(repeater);
    return result;
  }

  // Reattach a previously-created repeater as a child of whichever
  // repeater is currently executing - pure reattachment, never a trigger
  // of its own, and (unlike in an earlier version of this function) never
  // a checkpoint for resolving anything either: whether oldRepeater is
  // dirty, flagged, or clean, that's settled entirely by
  // drainActivePipeline()'s own position-ordered walk of its pipeline's
  // heap, not by however a parent's own execution happens to reach it.
  // That walk already guarantees a repeater is always processed relative
  // to everything else at the correct position - a child's firstPartial
  // is always later than its parent's (the parent's own execution is what
  // creates the child), so the heap alone puts every repeater in the
  // right order without linkRepeater needing to do anything about it. If
  // oldRepeater is (now, or already) dirty or flagged, cascade's own
  // scheduler refreshes/resolves it on its own schedule, independent of
  // when this is called; if it's clean, this is a no-op beyond the
  // reattachment itself - no rerun, no state loss. Component/child
  // identity (which old repeater corresponds to which new render call) is
  // entirely the caller's responsibility - cascade only exposes this
  // primitive.
  // Pure reattachment as far as a genuinely *invalid* oldRepeater is
  // concerned - cascade's own scheduler refreshes it on its own schedule
  // (via the heap), independent of when this is called, exactly as
  // documented below. But a merely *flagged* one is different: this is
  // the wavefront genuinely arriving at oldRepeater's own position (its
  // parent's execution reaching this exact call is what "the wavefront
  // reaches here" means), and it may be the *only* place that arrival is
  // ever detected - draining the heap only happens after the whole
  // *root's* refresh() already returns, which is too late if the parent's
  // own later code (right after this call) needs to see the effect of
  // resolving oldRepeater's flag (see renderOnto.js's case 1: the
  // "after" write needs a flagged sibling's writing already retracted,
  // not still linked, and that can only happen if the flag is resolved
  // right here, inline, not deferred to the heap). So a flagged
  // oldRepeater is resolved on the spot, via the same processRepeater()
  // the heap itself uses - if that finds a genuine change, it calls
  // invalidateRepeater() (dispose() runs immediately; the repeater's own
  // *refresh* is left for the heap to pick up later, same as ever - see
  // scheduleWork()'s own inHeap dedup, which naturally lets this happen
  // without double-scheduling).
  function linkRepeater(oldRepeater) {
    if (oldRepeater.workStatus === 'flagged') {
      processRepeater(oldRepeater);
    }
    attachToCurrentParent(oldRepeater);
    return oldRepeater;
  }

  /***************************************************************
   *
   *  Repeater scheduling: pipelines, wavefronts, parking
   *
   *  A "pipeline" is one root repeater's whole tree - everything sharing
   *  its chainHead - always executing within exactly one time level (see
   *  createChainHead()). state.workQueue holds one {active, parked} pair
   *  of FIFOs per level; the unit sitting in those FIFOs is a *pipeline*
   *  (its chainHead), not an individual repeater - "a pipeline is really
   *  just an invalidated repeater from the outside". A pipeline's own
   *  internal work - which of its repeaters actually need attention - is
   *  tracked on the chainHead itself: `heap` (position-ordered, by each
   *  repeater's firstPartial), `parkedPartials` (repeaters that arrived
   *  behind this pipeline's own wavefront this wave, waiting for the
   *  next), and `wavefront` (how far this pipeline has gotten, this
   *  active session).
   *
   *  Only repeaters ever occupy a heap/parkedPartials slot - a partial
   *  can never usefully run on its own, so a flagged *reading* (tracked
   *  per-entry, on repeater.flagRecords) always resolves to "does the
   *  whole owning repeater need to rerun", never to running a partial in
   *  isolation. And the pipeline's own root repeater never occupies a
   *  heap slot either - nothing can have an earlier position than the
   *  thing that created everything else in its own tree, so
   *  drainActivePipeline() checks it directly, unconditionally, before
   *  ever touching the heap.
   *
   *  Each repeater carries workStatus (null | 'invalid' | 'flagged') -
   *  'invalid' always wins and is never downgraded back to 'flagged' (see
   *  flagRepeaterEntry()) - plus two separate dedup flags for the two
   *  different places a repeater can be waiting: inHeap for a nested
   *  repeater sitting in its chainHead's heap, inATimeBucket for a root
   *  repeater whose chainHead is sitting in a workQueue bucket. A root
   *  repeater's own inHeap stays false forever - it never enters a heap -
   *  so anything that needs "is this repeater already scheduled" has to
   *  ask the right one of the two, not assume either applies uniformly.
   *
   *  "Behind the wavefront" - see scheduleWork() - covers two distinct
   *  cases with the same rule: new work discovered *within* the pipeline
   *  currently being drained, at or before wherever it's already gotten
   *  to (the back-reference case: something later just wrote to
   *  something earlier); and new work arriving for a pipeline that's
   *  merely sitting *parked* (its own heap emptied this wave, but it's
   *  still waiting on leftover parkedPartials) - even if the new work is
   *  entirely unrelated to why it was parked, it still waits for the same
   *  next wave, no early reactivation. Either way it goes into
   *  parkedPartials, not the heap - waves move strictly forward, and
   *  nothing is allowed to make one backtrack.
   *
   *  ...except flush() (see there), the one deliberate escape hatch: while
   *  state.flushing > 0, exactly this kind of "would park" case instead
   *  retreats the wave - the outer workQueueTimeLock, or a pipeline's own
   *  wavefront - and sets state.waveRetreated, which checkWaveRetreat()
   *  inspects once, right after every processRepeater() call (never
   *  mid-refresh), to hand the pipeline currently being drained back in a
   *  resumable state if the retreat reached past it.
   *
   ***************************************************************/

  // A stand-in for a real heap, given how small a pipeline's own pending
  // work is expected to be in practice - a plain array kept sorted by
  // each repeater's firstPartial, compared live via compareWriterOrder
  // (never a cached order number - see createChainHead()'s own comment on
  // why that matters once releaseChainPressure can renumber neighbors out
  // from under a stored value). Worth revisiting with an actual heap if a
  // pipeline's own heap ever turns out to hold enough repeaters at once
  // for the O(n) insert/pop here to matter.
  function heapInsert(heap, repeater) {
    let i = heap.length;
    while (i > 0 && compareWriterOrder(heap[i - 1].firstPartial, repeater.firstPartial) > 0) {
      i--;
    }
    heap.splice(i, 0, repeater);
  }

  function heapPopMin(heap) {
    return heap.shift();
  }

  function appendToLevelList(chainHead, level, which) {
    const list = state.workQueue[level][which];
    chainHead.previousQueued = list.last;
    chainHead.nextQueued = null;
    if (list.last !== null) list.last.nextQueued = chainHead; else list.first = chainHead;
    list.last = chainHead;
  }

  function unlinkFromLevelList(chainHead, level, which) {
    const list = state.workQueue[level][which];
    if (list.first === chainHead) list.first = chainHead.nextQueued;
    if (list.last === chainHead) list.last = chainHead.previousQueued;
    if (chainHead.nextQueued !== null) chainHead.nextQueued.previousQueued = chainHead.previousQueued;
    if (chainHead.previousQueued !== null) chainHead.previousQueued.nextQueued = chainHead.nextQueued;
    chainHead.nextQueued = null;
    chainHead.previousQueued = null;
  }

  // Like appendToLevelList, but at the front - used only to give a
  // flush()-abandoned pipeline priority to resume ahead of whatever else
  // is already waiting at its level (see checkWaveRetreat()).
  function prependToLevelList(chainHead, level, which) {
    const list = state.workQueue[level][which];
    chainHead.previousQueued = null;
    chainHead.nextQueued = list.first;
    if (list.first !== null) list.first.previousQueued = chainHead; else list.last = chainHead;
    list.first = chainHead;
  }

  // Ensure chainHead is correctly placed in its own level's outer
  // bucket - active if its level is still ahead of the lock, parked if
  // the sweep has already moved past it (see the module comment above on
  // why a level that's been passed never reopens this wave). A no-op if
  // it's already exactly where it belongs, so callers never need to
  // check queueMembership themselves first. Never touches anything while
  // this chainHead is the one currently being drained - see
  // drainActivePipeline(), which owns placing it once its session ends.
  //
  // flush(): if the lock has already passed this chainHead's own level,
  // that would normally mean parking - but with flushing > 0, the
  // application has asked for this wave to reach back instead, so the
  // lock itself retreats to just before this level, and waveRetreated is
  // set for checkWaveRetreat() to notice, between repeaters, that
  // whatever's currently being drained needs to be set aside for this.
  function ensurePipelineActiveOrParked(chainHead) {
    if (chainHead === state.activePipeline) return;
    if (state.flushing > 0 && chainHead.time <= state.workQueueTimeLock) {
      state.workQueueTimeLock = chainHead.time - 1;
      state.waveRetreated = true;
    }
    const wantParked = chainHead.time <= state.workQueueTimeLock;
    const want = wantParked ? 'parked' : 'active';
    if (chainHead.queueMembership === want) return;
    if (chainHead.queueMembership !== null) {
      unlinkFromLevelList(chainHead, chainHead.time, chainHead.queueMembership);
    }
    appendToLevelList(chainHead, chainHead.time, want);
    chainHead.queueMembership = want;
  }

  // The single place any repeater - root or nested, newly invalid or
  // newly flagged - gets placed into the scheduler. Never decides *what*
  // kind of work it is (see invalidateRepeater()/flagRepeaterEntry(),
  // which set workStatus before calling this); purely about *where* it
  // goes.
  // {pulledBy: puller} (a repeater, or a function returning one): this
  // repeater's work is not done on its own schedule, but when `puller`
  // pulls it (refreshIfNeeded()) - so pending work here invalidates
  // `puller` instead of queuing this repeater. For an {independent: true}
  // repeater whose results another pipeline must never see mid-rerun: a
  // component's build repeater, whose writings (the properties of
  // everything it constructed) are retracted the moment it's invalidated.
  // Queued on its own, anything rendered from those properties could run
  // before it does and read them as missing; pulled by its render
  // repeater instead, it always runs first - the render repeater comes
  // before everything it renders (see Component.js's
  // reactiveBuildEquivalent()).
  //
  // A retracted puller (a component that isn't being rendered right now)
  // leaves the work pending: nothing needs this repeater's results while
  // nobody's pulling them, so it isn't run at all - it stays invalid, not
  // queued, and is brought up to date whenever the puller comes back and
  // pulls it. Its state (for a build repeater: which object each build key
  // belongs to) is kept throughout.
  //
  // Falls back to ordinary scheduling (returns false) when there's no
  // puller to hand the work to - not created yet - or the puller is running
  // right now: invalidating a repeater mid-run from outside would dispose
  // it under its own feet; this repeater then runs on its own afterwards
  // and the puller, reading its results, reruns from that.
  function scheduleThroughPuller(repeater) {
    const pulledBy = repeater.options.pulledBy;
    const puller = typeof(pulledBy) === "function" ? pulledBy() : pulledBy;
    if (!puller || puller.disposed) return false;
    if (puller.retracted) return true;
    for (let context = state.context; context; context = context.parent) {
      if (context.type === "partial" && context.repeater === puller) return false;
    }
    if (puller.workStatus !== 'invalid') invalidateRepeater(puller);
    return true;
  }

  function scheduleWork(repeater) {
    const chainHead = repeater.chainHead;
    if (repeater.options.pulledBy && scheduleThroughPuller(repeater)) return;
    if (repeater.parentRepeater === null) {
      if (repeater.inATimeBucket) return;
      repeater.inATimeBucket = true;
      ensurePipelineActiveOrParked(chainHead);
      return;
    }
    if (repeater.inHeap) return;
    repeater.inHeap = true;
    ensurePipelineActiveOrParked(chainHead);
    const withinActivePipeline = chainHead === state.activePipeline;
    const behindWavefront = withinActivePipeline
      ? compareWriterOrder(repeater.firstPartial, chainHead.wavefront) <= 0
      : chainHead.time <= state.workQueueTimeLock;
    // flush(): a back-reference within the pipeline currently being
    // drained would normally park until the next wave - reprocess it
    // within this same wave instead. No need to actually move
    // chainHead.wavefront back for this: heapInsert already places the
    // repeater at its correct position, so the heap-loop's next pop picks
    // it up in order regardless of where wavefront currently sits.
    if (behindWavefront && withinActivePipeline && state.flushing > 0) {
      state.waveRetreated = true;
      heapInsert(chainHead.heap, repeater);
    } else if (behindWavefront) {
      chainHead.parkedPartials.push(repeater);
    } else {
      heapInsert(chainHead.heap, repeater);
    }
  }

  // The genuine-invalidation entry point - replaces the old
  // repeaterDirty(). 'invalid' always wins over 'flagged' and is never
  // downgraded back (see flagRepeaterEntry()).
  function invalidateRepeater(repeater) {
    repeater.dispose();
    repeater.flagRecords = null;
    repeater.workStatus = 'invalid';
    scheduleWork(repeater);
    refreshAllDirtyRepeaters();
  }

  function clearRepeaterLists() {
    state.observerId = 0;
    state.workQueue.forEach((levelBuckets) => {
      levelBuckets.active.first = null;
      levelBuckets.active.last = null;
      levelBuckets.parked.first = null;
      levelBuckets.parked.last = null;
    });
    state.workQueueTimeLock = -1;
    state.activePipeline = null;
    state.waveRetreated = false;
  }

  // Record that `entry` (still sitting, untouched, in
  // `previousWriting.observers`) might belong on a closer writing instead
  // - found overtaken, but with a value that genuinely differed at
  // discovery time, so acting on it immediately would risk exactly the
  // "invalidation travels faster than the computation front" problem: the
  // change that overtook it might yet be undone by something between here
  // and wherever `entry`'s own repeater actually gets reached. Idempotent
  // per entry (guarded by entry.flagged) - a second, even-closer writing
  // appearing before this is ever resolved just leaves it flagged once,
  // to be resolved fresh (against whatever's authoritative *then*) rather
  // than layered with a second, redundant guess now.
  function flagRepeaterEntry(repeater, entry, previousWriting) {
    entry.flagged = true;
    if (repeater.flagRecords === null) repeater.flagRecords = [];
    repeater.flagRecords.push({ entry, previousWriting });
    if (repeater.workStatus === null) {
      repeater.workStatus = 'flagged';
      scheduleWork(repeater);
    }
    // else: already 'invalid' or already 'flagged' - either way already
    // scheduled, flagRecords just grew, nothing more to place.
  }

  // Actually settle every flag record `repeater` is currently carrying.
  // Called only from processRepeater() - reached either opportunistically,
  // via linkRepeater() the instant its parent's own execution arrives at
  // repeater's position, or later via drainActivePipeline()'s own
  // position-ordered walk of its pipeline's heap - which has already
  // confirmed repeater.workStatus === 'flagged', meaning nothing has
  // invalidated this repeater for real since it was flagged
  // (invalidateRepeater() always wins over a mere flag and is never
  // itself downgraded - see flagRepeaterEntry()), so every record here is
  // still live and worth actually checking. Two *live* reads, taken at
  // this same moment, are all that's needed per record - not any snapshot
  // of history: `previousWriting`'s own current value (still accurate,
  // since nothing genuinely changed it without going through its own
  // ordinary invalidation - see migrateOvertakenObserversFor's own
  // reasoning) versus an entirely fresh resolution of the same (timeline,
  // time, writer) position, walked from scratch against whatever's linked
  // right now. A mutated-in-place writing along the way is never a
  // problem, because neither side of this comparison depends on any
  // intermediate state that could have been overwritten - see the
  // flagged-list design discussion this came out of.
  function resolveFlaggedRepeater(repeater) {
    const records = repeater.flagRecords;
    repeater.flagRecords = null;
    if (records === null || records.length === 0) return;

    records.forEach(({ entry, previousWriting }) => {
      entry.flagged = false;
      let fresh = seekWriting(previousWriting.timeline, entry.time, entry.writer);
      // A read and a later write to the same property, from within the
      // very same partial, share the identical (time, writer) position -
      // so if this reader also happens to write this same property later
      // in its own execution (the ordinary read-then-write shape - see
      // renderOnto.js), seekWriting can resolve straight to *that*,
      // rather than to whatever was actually linked at the moment this
      // reader read. That write didn't exist yet at read time; what this
      // reader actually saw is whatever's immediately before it.
      if (fresh.writer === entry.writer && fresh.previous !== null) {
        fresh = fresh.previous;
      }
      if (fresh === previousWriting) return; // nothing actually closer is linked anymore (e.g. it was itself retracted) - previousWriting is still the right answer, nothing to do
      const changed = !writingsHaveSameEffectiveValue(previousWriting, fresh);
      relocatePropertyObserverEntry(previousWriting, fresh, entry);
      if (changed) {
        // Direct, not via invalidateObserver(entry.observer, ...) - we're
        // already holding the repeater itself, and workStatus is the one
        // thing that actually needs setting; calling invalidateRepeater()
        // more than once in this loop (if several records all turn out
        // changed) is harmless - dispose() and scheduleWork() are both
        // idempotent.
        invalidateRepeater(repeater);
      }
    });
  }

  // A partial that finalizeChildren() finds still sitting unconsumed in
  // pendingChildren never got picked up by createNextPartial() (either its
  // owning repeater is being permanently abandoned, not rerun, or the fresh
  // run's structure diverged before reaching it) - its position in the
  // chain is genuinely done for good, so free it up for reuse by whatever
  // eventually falls between its old neighbors, rather than leaving it
  // permanently spent. Its *writings* are a separate, repeater-scoped
  // concern now - see finalizeStaleWritings(), which handles every one of
  // this partial's own writings (along with every other partial this same
  // repeater ever produced) uniformly, regardless of which specific
  // partial-slot produced them or whether that slot itself got reconciled
  // this run.
  function retractPartialChainSlot(partial) {
    removePartialFromChain(partial.repeater.chainHead, partial);
  }

  // Genuinely retract a writing that turned out to have nothing further
  // to say (never claimed by any write this run) - already unlinked from
  // its timeline since dispose() (see there). Unlike
  // migrateOvertakenObserversFor/retireWritingOnto, there's no single
  // "newWriting" to hand observers off to here - whatever's now
  // authoritative for each one depends on that entry's own (time, writer),
  // which can differ observer to observer, so a partial (tree) observer is
  // simply flagged against this now-permanently-retired `writing` (exactly
  // as an overtaken one would be) and left for resolveFlaggedRepeater to
  // seek fresh, on its own, whenever it's actually reached - `writing`
  // itself is done changing forever at this point, so its `.value` stays
  // a safe, stable reference for that later comparison. A non-partial
  // (invalidator) observer has no such wavefront to wait for, so it's
  // still notified immediately, same as always.
  function abandonStaleWriting(writing) {
    if (writing.observers !== null) {
      collectOvertakenPropertyObservers(writing, () => true).forEach((entry) => {
        if (entry.flagged) return;
        if (entryNeedsDeferredTreatment(entry, writing.writer)) {
          flagRepeaterEntry(entry.observer.repeater, entry, writing);
        } else {
          invalidateObserver(entry.observer, writing.timeline.handler.proxy, writing.timeline.key);
        }
      });
    }
    writing.stale = false;
    writing.hasNextValue = false;
    writing.nextValue = undefined;
  }

  // Called whenever a partial closes (see attachToCurrentParent(), and
  // refresh() for a repeater's own final partial) - resolve every stale
  // writing THIS SPECIFIC PARTIAL claimed this run (see setHandlerObject's
  // staleWritings-queue lookup) into "reused, no real change" or
  // "genuinely changed, notify": the buffered nextValue is the real
  // answer, compared now - for the first and only time - against what it
  // was before this run (not once per intermediate write within this same
  // partial - see setHandlerObject's own comment on why that matters: a
  // property this partial sets, unsets, and sets again must settle once,
  // not flap).
  //
  // Deliberately scoped to *this partial*, not deferred to the whole
  // repeater's run finishing (createPartial()'s own comment on
  // touchedStaleWritings has the reasoning): whoever reads what this
  // partial just wrote - a later partial of this same repeater, a child
  // repeater, anyone interleaved via the dirty queue - needs to see that
  // notification in real time, synchronously, the moment this partial's
  // own code finishes, the same as an ordinary (non-stale) write already
  // does.
  function finalizeTouchedStaleWritings(partial) {
    if (partial.touchedStaleWritings === null) return;
    partial.touchedStaleWritings.forEach(function(writing) {
      writing.stale = false;
      if (!sameAsPrevious(writing.value, writing.nextValue)) {
        writing.value = writing.nextValue;
        invalidateWritingObservers(writing, writing.timeline.handler.proxy, writing.timeline.key);
      }
      writing.hasNextValue = false;
      writing.nextValue = undefined;
      // Deliberately after the notify-if-different above, not before (see
      // setHandlerObject's own `justInserted` ordering comment for the
      // same reasoning, one level removed): a reader migrated onto
      // `writing` here got its own independent, correct "did anything
      // change from *my* perspective" verdict at migration time, compared
      // against whatever `writing.previous` was - that's unrelated to
      // whether `writing` itself just changed from *its own* prior value
      // (the comparison just above). Migrating first would let a reader
      // migration judged as "no real change" get swept up anyway by
      // writing's own unrelated before/after check, the moment it lands
      // in `writing.observers`.
      migrateOvertakenObserversFor(writing);
    });
    partial.touchedStaleWritings = null;
  }

  // Once this repeater's whole run finishes (see refresh()) - or, if it's
  // being permanently retracted (never getting another run at all) -
  // anything still left in staleWritings' queues was never claimed by any
  // write from any of this run's partials (every partial that could have
  // claimed it has already closed - see finalizeTouchedStaleWritings()
  // for whatever *was* claimed, already resolved by the time this runs):
  // it's really gone. Timeline-identity-keyed throughout (queued per
  // timeline, not positional), and strictly scoped to writings this exact
  // repeater itself produced - a writing is never reused across repeater
  // boundaries (see the A-writes-x/B-writes-x discussion this design came
  // out of: neither direction is safe, since whichever of two repeaters
  // runs first can't yet know what the other is about to do).
  function finalizeStaleWritings(repeater) {
    if (repeater.staleWritings === null) return;
    repeater.staleWritings.forEach(function(queue) {
      queue.forEach(abandonStaleWriting);
    });
    repeater.staleWritings = null;
  }

  // Dispatch a popped/checked repeater according to whatever it actually
  // needs, clearing workStatus before acting (so a re-entrant
  // invalidateRepeater() call from inside resolveFlaggedRepeater - it
  // found a genuine change - schedules cleanly against a null status,
  // rather than finding one already set and silently no-opping).
  function processRepeater(repeater) {
    if (repeater.workStatus === 'invalid') {
      repeater.workStatus = null;
      repeater.refresh();
    } else if (repeater.workStatus === 'flagged') {
      repeater.workStatus = null;
      resolveFlaggedRepeater(repeater);
    }
  }

  // Bring a repeater up to date right now, if it has pending work (invalid
  // or flagged), instead of waiting for the scheduler to reach it - the
  // repeater's refresh is simply pushed onto the context stack above
  // whatever is running, and control returns here when it's done. For
  // pulling a fresh result out of an {independent: true} repeater from
  // inside some other pipeline's run (e.g. a component's render reading
  // what its build repeater produced). A no-op for an up-to-date or
  // retracted repeater. Its pipeline may still be sitting in the work
  // queue afterwards; draining it later finds nothing left to do there.
  //
  // A pull is a hand-over point, the same as a child boundary: whatever
  // the running partial rewrote so far has to be settled first (see
  // finalizeTouchedStaleWritings() - a rewrite of an existing writing only
  // notifies its readers when the partial closes). Otherwise a creator that
  // writes an input and then pulls would find the repeater reading that
  // input not yet invalidated, get its stale result, and have to rerun
  // once more when its own partial finally closes.
  function refreshIfNeeded(repeater) {
    if (repeater.retracted || repeater.disposed) return repeater;
    if (state.context !== null && state.context.type === "partial") {
      finalizeTouchedStaleWritings(state.context);
    }
    processRepeater(repeater);
    return repeater;
  }

  // flush(): called right after every processRepeater() - not mid-refresh,
  // even one that itself recursively revalidates whole subtrees of
  // children; that's never interrupted - to notice a wave retreat and, if
  // it actually reached back past the pipeline currently being drained,
  // hand that pipeline back in a fresh, resumable state rather than
  // continuing to drain it against what's now a stale premise.
  //
  // Nothing here presumes anything in this pipeline was actually wrong -
  // only that some earlier-level work needs to run first. Whatever that
  // rerun changes will mark exactly what needs attention through the
  // ordinary invalidation/migration/flagging path, same as ever; this
  // pipeline's own already-completed work is left untouched, not
  // discarded. heap/parkedPartials already hold exactly the repeaters
  // known to need it, so folding parkedPartials into heap and handing the
  // whole pipeline back - at the front of its own level's bucket, so it
  // resumes before anything else waiting there - is all that's needed.
  //
  // While draining pipeline at time L, workQueueTimeLock sits at L - 1 as
  // a matter of course (see findNextPipeline() - it never locks the level
  // it hands back). So "did the wave actually retreat past this
  // pipeline", not merely "is the lock currently behind it" (always true,
  // harmlessly), is workQueueTimeLock < chainHead.time - 1.
  function checkWaveRetreat(chainHead) {
    if (!state.waveRetreated) return false;
    state.waveRetreated = false;
    if (state.workQueueTimeLock >= chainHead.time - 1) return false;
    chainHead.parkedPartials.forEach((r) => heapInsert(chainHead.heap, r));
    chainHead.parkedPartials = [];
    chainHead.wavefront = null;
    state.activePipeline = null;
    prependToLevelList(chainHead, chainHead.time, 'active');
    chainHead.queueMembership = 'active';
    return true;
  }

  // Drain the pipeline currently sitting in state.activePipeline (see
  // findNextPipeline(), which extracts it from its outer bucket before
  // handing it over): the root repeater first, unconditionally and
  // directly - nothing can have an earlier position than the thing that
  // created everything else in its own tree, so there's no need to pay
  // for a heap comparison to know it goes first - then the heap itself,
  // strictly in position order, advancing chainHead.wavefront as it goes
  // so scheduleWork() can correctly tell newly-arising work apart into
  // "ahead, process it this wave" vs "behind, park it for the next".
  function drainActivePipeline() {
    const chainHead = state.activePipeline;
    chainHead.wavefront = null;
    const root = chainHead.rootRepeater;

    // A loop, not a single check: resolving a flagged root can itself
    // turn up a genuine change, which calls invalidateRepeater() (from
    // inside resolveFlaggedRepeater) and sets workStatus back to
    // 'invalid' - that still has to actually run this session, not just
    // get left set and parked for yet another wave. wavefront is
    // deliberately left untouched here (not reset to reflect the root) -
    // the root is always position-zero, so it never advances the
    // wavefront; only real heap items do, below.
    //
    // Cleared up front as well as inside the loop: the root may have been
    // brought up to date out of band (refreshIfNeeded()) after its
    // pipeline was queued, leaving nothing for the loop to do - and a
    // root still marked as sitting in a time bucket would be ignored by
    // every later scheduleWork() for good.
    root.inATimeBucket = false;
    while (root.workStatus !== null) {
      root.inATimeBucket = false;
      processRepeater(root);
      if (checkWaveRetreat(chainHead)) return;
    }

    while (chainHead.heap.length > 0) {
      const repeater = heapPopMin(chainHead.heap);
      repeater.inHeap = false;
      if (repeater.disposed || repeater.retracted) continue; // gone since it was queued
      if (repeater.workStatus === null) continue; // the lazy-pruning discard - an ancestor's own refresh already reached and handled it
      chainHead.wavefront = repeater.firstPartial;
      processRepeater(repeater);
      if (checkWaveRetreat(chainHead)) return;
    }

    state.activePipeline = null;
    // Whatever's still pending - root re-flagged/re-invalidated mid-drain
    // (a back-reference targeting the root itself, which never goes
    // through parkedPartials - see scheduleWork()'s own root branch), or
    // genuine parkedPartials content - means this pipeline isn't done for
    // this wave; park it (unconditionally - not ensurePipelineActiveOrParked's
    // lock-relative decision, which would be wrong here: this pipeline's
    // own level is still the current, not-yet-locked one, so that
    // function would put it right back in `active`, findable again within
    // the very same wave).
    const rootStillPending = root.workStatus !== null;
    if (chainHead.parkedPartials.length > 0 || rootStillPending) {
      appendToLevelList(chainHead, chainHead.time, 'parked');
      chainHead.queueMembership = 'parked';
    }
  }

  // Whether any pipeline, at any level, has anything pending at all -
  // active or merely parked. Used only to decide whether
  // refreshAllDirtyRepeaters() has anything to do in the first place.
  function anyWorkQueued() {
    return state.workQueue.some((levelBuckets) => levelBuckets.active.first !== null || levelBuckets.parked.first !== null);
  }

  // Find the next pipeline to drain: the earliest still-unlocked level
  // with anything actionable, FIFO within that level - locking levels as
  // it passes them, exactly like the old firstDirtyRepeater() did.
  // Reaching the end with nothing actionable doesn't necessarily mean
  // idle, though - some levels may hold parked-only pipelines (their own
  // heap emptied this wave, but parkedPartials didn't) - so before giving
  // up, fold every one of those back into action (parkedPartials -> heap,
  // moved from parked into active) and start a fresh wave
  // (workQueueTimeLock reset to -1) if that produced anything. Only once
  // that turns up nothing either is this genuinely idle.
  function findNextPipeline() {
    let level = state.workQueueTimeLock + 1;
    while (level < state.workQueue.length) {
      if (state.workQueue[level].active.first !== null) {
        return state.workQueue[level].active.first;
      }
      state.workQueueTimeLock = level;
      level++;
    }

    let foldedAny = false;
    for (let l = 0; l < state.workQueue.length; l++) {
      let node = state.workQueue[l].parked.first;
      while (node !== null) {
        const next = node.nextQueued;
        unlinkFromLevelList(node, l, 'parked');
        node.parkedPartials.forEach((r) => heapInsert(node.heap, r));
        node.parkedPartials = [];
        appendToLevelList(node, l, 'active');
        node.queueMembership = 'active';
        foldedAny = true;
        node = next;
      }
    }
    if (foldedAny) {
      state.workQueueTimeLock = -1;
      return findNextPipeline();
    }
    return null;
  }

  function refreshAllDirtyRepeaters() {
    if (state.postponeRefreshRepeaters === 0) {
      if (!state.refreshingAllDirtyRepeaters) {
        if (anyWorkQueued()) {
          state.refreshingAllDirtyRepeaters = true;
          let chainHead;
          while ((chainHead = findNextPipeline()) !== null) {
            unlinkFromLevelList(chainHead, chainHead.time, 'active');
            chainHead.queueMembership = null;
            state.activePipeline = chainHead;
            drainActivePipeline();
          }
          // Genuinely idle - nothing left anywhere, active or parked (see
          // findNextPipeline()). Without this, the lock would stay
          // wherever it last advanced to, and a later, completely fresh
          // invalidation at an earlier level would be wrongly treated as
          // "already passed" (wantParked) by ensurePipelineActiveOrParked
          // - found while working through when a flush() retreat is even
          // real vs. just the ordinary L-1 resting position.
          state.workQueueTimeLock = -1;
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