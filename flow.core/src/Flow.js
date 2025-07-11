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
 * Priority levels, to make reactive updates happen in a certain rough order. 
 */
export const updateModelTime = 0; // Default
export const renderComponentTime = 1;
export const updateDOMTime = 2;

const priorityLevels = {
  updateModel: 0,
  renderComponent: 1,
  updateDOM: 2 
}

const priorityLevelToString = {}
for(let property in priorityLevels) {
  priorityLevelToString[priorityLevels[property]] = property;
}


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
export const deeplyObservableCopy = (object) => deeplyObservable(object, true)

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
  onFinishRenderingComponentsCallbacks: [],
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


// export const updateModelTime = 0; // Default
// export const renderComponentTime = 1;
// export const updateDOMTime = 2;


var lastTime = null;
function onFinishedPriorityLevel(level, didActualWork) {
  // if (trace)
  const time = new Date().getTime();
  let difference = null;
  if (lastTime) {
    difference = time - lastTime;
  }
  lastTime = time; 
  const differenceString = (difference !== null) ? `${difference / 1000}s` : ""
  if (trace) log(`<<<finished priority: ${priorityLevelToString[level]} ${differenceString} >>>`);
  // if (finishedAllLevels) log("no more repeaters...");

  // Finished re building flow with expanded primitives. Measure bounds and style before FLIP animation. 
  if (level === renderComponentTime && didActualWork) {
    // log(configuration.onFinishRenderingComponentsCallbacks)
    configuration.onFinishRenderingComponentsCallbacks.forEach(callback => callback())
  }

  // Let flow rebuild the DOM, while not removing nodes of animated flows (they might move if inserted elsewhere)

  // Finished re building DOM, proceed with animations.  
  if (level === updateDOMTime) {
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
