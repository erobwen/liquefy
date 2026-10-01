
export function argumentsToArray(argumentList) {
  return Array.prototype.slice.call(argumentList);
}

// Helper to quickly get a child array
export function getArray() {
  var argumentList = argumentsToArray(arguments);
  var object = argumentList.shift();
  while (argumentList.length > 0) {
    var key = argumentList.shift();
    if (typeof(object[key]) === 'undefined') {
      if (argumentList.length === 0) {
        object[key] = [];
      } else {
        object[key] = {};
      }
    }
    object = object[key];
  }
  return object;
}


const log = console.log;
const logg = (string) => {
  if (string) {
    console.log("-------------" + string + "-------------");
  } else {
    console.log("--------------------------");
  }
};

/************************************************************************
 *
 *  Merge into
 *
 ************************************************************************/

// Copy a freshly-constructed twin's (source) properties onto the
// established object (target) it was reconciled with during a rebuild.
// State properties (see declareState() in cascade.js) are deliberately
// skipped: they belong to the established object's own life, not to
// whatever this rebuild happened to construct - copying them would reset
// them to their defaults on every rebuild.
export function mergeInto(target, source) {
  const stateProperties = target.causality.stateProperties || null;
  const isState = (property) => stateProperties !== null && stateProperties.has(property);
  if (source instanceof Array) {
    // The elements, as this rebuild built them, written in one go - an
    // absolute write, not splices relative to whatever the established
    // array held: what comes before it on its timeline may yet change (see
    // cascade.js's "Temporal arrays"). Read without recording: a rebuild
    // never depends on what it built.
    const world = target.causality.world;
    world.assignArray(target, world.withoutRecording(() => source.slice()));
    for (let property in source) {
      if (isNaN(property) && !isState(property)) {
        target[property] = source[property];
      }
    }
  } else {
    for (let property in source) {
      if (isState(property)) continue;
      target[property] = source[property];
    }
  }
  return target;
}

export function configSignature(configuration) {
  if (configuration.name) {
    return configuration.name; 
  } else {
    configuration = normalizeConfig(configuration);
    let signature = JSON.stringify(configuration);
    return signature;
  }
}

// Each function its own identity in a signature: two configurations
// differing only in a callback (onEventGlobal, customCreateRepeater, ...)
// are two worlds, not one.
const functionIds = new WeakMap();
let nextFunctionId = 0;
function functionId(fn) {
  if (!functionIds.has(fn)) functionIds.set(fn, nextFunctionId++);
  return functionIds.get(fn);
}

export function normalizeConfig(object) {
  if (typeof(object) === "object") {
    if (object === null) return "null";  
    let keys = Object.keys(object);
    keys.sort(function(a, b){
      if(a < b) return -1;
      if(a > b) return 1;
      return 0;
    });
    let sortedObject = {};
    keys.forEach(function(key) {
      let value = object[key];
      if (typeof(value) === 'object' || typeof(value) === 'function') value = normalizeConfig(value);
      sortedObject[key] = value;
    });
    return sortedObject;
  } else if (typeof(object) === "function") {
    return "[function " + functionId(object) + "]";
  } else {
    return "[" + typeof(object) + "]";
  }
}