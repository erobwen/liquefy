import getWorld from "@liquefy/causaility";
const log = console.log;


/**
 * World (from causality)
 */
export const world = getWorld({
  useNonObservablesAsValues: true,
  warnOnNestedRepeater: false,
  emitReBuildEvents: true, 
  priorityLevels: 3,
  // onEventGlobal: event => collectEvent(event)
  onFinishedPriorityLevel: onFinishedPriorityLevel
});

/**
 * Priority levels
 */
export const updateModelTime = 0;
export const buildComponentTime = 1;
export const renderViewTime = 2;


/**
 * World functions
 */
export const {
  transaction,
  observable,
  deeplyObservable,
  isObservable, 
  repeat,
  finalize,
  withoutRecording,
  sameAsPreviousDeep,
  workOnPriorityLevel,
  invalidateOnChange,
  postponeInvalidations,
  continueInvalidations,
  state
} = world;

/**
 * Testers
 */
export function isComponent(object) {
  return object instanceof Component;
}

export function isModel(object) {
  return isObservable() || !isComponent(object);
}



/**
 * Model creation
 */
export const model = deeplyObservable;


/**
 * Flow configuration
 */
export const configuration = {
  warnWhenNoKey: false,
  traceReactivity: false,
  traceAnimation: false,
  traceWarnings: false, 
  autoAssignProperties: false, 
  defaultTransitionAnimations: null,
  onFinishReBuildingFlowCallbacks: [],
  onFinishReBuildingDOMCallbacks:  [],
}

export function setFlowConfiguration(newConfiguration) {
  Object.assign(configuration, newConfiguration);
  trace = configuration.traceReactivity;
  traceAnimation = configuration.traceAnimation;
  traceWarnings = configuration.traceWarnings; 
}


/**
 * Debugging
 */
export let trace = false;
export let traceAnimation = false; 
export let traceWarnings = false; 
export let activeTrace = false; 
export const activeTraceModel = model({
  on: false 
})
window.activeTrace = activeTraceModel;
repeat(() => {
  activeTrace = activeTraceModel.on;
})
window.components = {};
window.idToComponent = {}
window.world = world;
window.model = model;
window.ensure = world.repeat;


function onFinishedPriorityLevel(level, didActualWork) {
  // if (trace)
  if (trace) log("<<<finished priority: " + level + ">>>");
  // if (finishedAllLevels) log("no more repeaters...");

  // Finished re building flow with expanded primitives. Measure bounds and style before FLIP animation. 
  if (level === 1 && didActualWork) {
    // log(configuration.onFinishReBuildingFlowCallbacks)
    configuration.onFinishReBuildingFlowCallbacks.forEach(callback => callback())
  }

  // Let flow rebuild the DOM, while not removing nodes of animated flows (they might move if inserted elsewhere)

  // Finished re building DOM, proceed with animations.  
  if (level === 2) {
    configuration.onFinishReBuildingDOMCallbacks.forEach(callback => callback())
  }
}


export function when(condition, operation) { // TODO: Move to causality. 
    return repeat(() => {
      const value = condition();
      if (value) {
        operation(value);
      }
    });
  }
  

export function callback(key, callback) {
    return observable(callback, key);
}
