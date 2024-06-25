import { repeat, Component, trace, configuration, component, activeTrace, creators, postponeInvalidations, continueInvalidations, traceAnimation, traceWarnings } from "@liquefy/flow.core";
import { logMark, logAnimationFrameGroup, logAnimationFrameEnd, logAnimationSeparator } from "@liquefy/flow.core";

import { DOMNodeAnimation } from "./DOMNodeAnimation";
import { getWrapper } from "./DOMNode";

// import { inExperiment, inExperimentOnCount } from "..";

const log = console.log;

/**
 * Installation
 */
export function installDOMAnimation() {
  configuration.onFinishReBuildingFlowCallbacks.push(onFinishReBuildingFlow);
  configuration.onFinishReBuildingDOMCallbacks.push(onFinishReBuildingDOM);
}


/**
 * Reset global animation state (on hot reload)
 */
export function resetDOMAnimation() {
  Object.assign(flowChanges, newFlowChanges());
  previousFlowChanges = {}
  counter = 0;
  domFlowTargets = [];
}


/**
 * Freeze flow changes (to prevent chained animations)
 */
let count = 0;
export function freezeFlowChanges() {
  count++;
  if (traceAnimation && traceWarnings) console.warn("Risky to use freeze " + count);
  // postponeInvalidations();
}

export function unfreezeFlowChanges() {
  count--;
  if (traceAnimation && traceWarnings) console.warn("Unfreeze... " + count);
  // continueInvalidations();
}


/**
 * DOM Flow Targets to animate
 */
let domFlowTargets = [];

export function addDOMFlowTarget(target) {
  domFlowTargets.push(target)
}

export function removeDOMFlowTarget(target) {
  domFlowTargets.splice(domFlowTargets.indexOf(target), 1);
}


/**
 * Debug printouts
 */

export function logProperties(object, properties) {
  log(extractProperties(object, properties));
}

export function extractProperties(object, properties) {
  const condensed = {};
  properties.forEach(property => {
    if (typeof(property) !== "string") {
      property.partial.forEach(part => {
        if (object[part]) {
          condensed[part] = object[part]   
        }
      });
      if (object[property.compound]) {
        condensed[property.compound] = object[property.compound];
      }
    } else {
      if (object[property]) {
        condensed[property] = object[property];
      }
    }
  });
  return condensed;
}


/**
 * Global flow change tracking
 */
export const flowChanges = newFlowChanges();

function newFlowChanges() {
  return ({

  number: 0,

  idPrimitiveMap: {},
  idParentIdMap: {},

  globallyAdded: {},
  globallyRemoved: {},
  globallyResident: {},
  globallyMoved: {},

  globallyAddedAnimated: {},
  globallyRemovedAnimated: {},
  globallyResidentAnimated: {},
  globallyMovedAnimated: {},

  *allAnimatedFlows() {
    for (let flow of Object.values(this.globallyAddedAnimated)) {
      yield flow; 
    }
    for (let flow of Object.values(this.globallyRemovedAnimated)) {
      yield flow; 
    }
    for (let flow of Object.values(this.globallyResidentAnimated)) {
      yield flow; 
    }
    for (let flow of Object.values(this.globallyMovedAnimated)) {
      yield flow; 
    }
  },

  *allAddedFlows() {
    for (let flow of Object.values(this.globallyAdded)) {
      yield flow; 
    }
  },
  
  *allAnimatedAddedFlows() {
    for (let flow of Object.values(this.globallyAddedAnimated)) {
      yield flow; 
    }
  },
  
  *allAnimatedRemovedFlows() {
    for (let flow of Object.values(this.globallyRemovedAnimated)) {
      yield flow; 
    }
  },

  *allAnimatedResidentFlows() {
    for (let flow of Object.values(this.globallyResidentAnimated)) {
      yield flow; 
    }
  },

  *allAnimatedMovedFlows() {
    for (let flow of Object.values(this.globallyMovedAnimated)) {
      yield flow; 
    }
  },

  *allAnimatedMovedResidentAndRemovedFlows() {
    for (let flow of Object.values(this.globallyResidentAnimated)) {
      yield flow; 
    }
    for (let flow of Object.values(this.globallyMovedAnimated)) {
      yield flow; 
    }
    for (let flow of Object.values(this.globallyRemovedAnimated)) {
      yield flow; 
    }
  },

  *allAnimatedMovedResidentFlows() {
    for (let flow of Object.values(this.globallyResidentAnimated)) {
      yield flow; 
    }
    for (let flow of Object.values(this.globallyMovedAnimated)) {
      yield flow; 
    }
  },

  *allAnimatedMovedAddedAndRemovedFlows() {
    for (let flow of Object.values(this.globallyMovedAnimated)) {
      yield flow; 
    }
    for (let flow of Object.values(this.globallyAddedAnimated)) {
      yield flow; 
    }
    for (let flow of Object.values(this.globallyRemovedAnimated)) {
      yield flow; 
    }
  },
})
};


/**
 * Flow changes, to keep track of animation frames. 
 */
export let previousFlowChanges = {}
window.flowChanges = flowChanges;
let counter = 0;

export const changeType = {
  resident: "resident", 
  added: "added", 
  removed: "removed",
  moved: "moved"
}


/**
 * On finish building flow
 */
export function onFinishReBuildingFlow() {
  
  counter++
  if (traceAnimation) {
    logAnimationFrameGroup(counter)
    logAnimationSeparator("---------------------------------------- Flow rebuilt, DOM untouched, calculate changes... -------------------");
    console.groupCollapsed("Potentially start DOM building for new flows here ...");
    // log(counter);
  }
  // if (counter === 5) return; 

  // Save previous state for comparison
  Object.assign(previousFlowChanges, flowChanges);
  
  // Reset current state
  flowChanges.number++;
  flowChanges.idPrimitiveMap = {};
  flowChanges.idParentIdMap = {};
  flowChanges.globallyAdded = {}; 
  flowChanges.globallyResident = {}; 
  flowChanges.globallyMoved = {};
  flowChanges.globallyRemoved = {};

  const idPrimitiveMap = flowChanges.idPrimitiveMap;
  const idParentIdMap = flowChanges.idParentIdMap;

  function analyzePrimitives(idPrimitiveMap, primitiveFlow) {
    idPrimitiveMap[primitiveFlow.id] = primitiveFlow;
    idParentIdMap[primitiveFlow.id] = primitiveFlow.parentPrimitive;
  
    for (let child of primitiveFlow.iteratePrimitiveChildren()) {
      analyzePrimitives(idPrimitiveMap, child);
    }
  }
  
  for (let target of domFlowTargets) {
    analyzePrimitives(idPrimitiveMap, target.flow.getPrimitive());
  }
  // console.log(idParentIdMap);

  // Added, resident or moved 
  for (let id in idPrimitiveMap) {
    const primitive = idPrimitiveMap[id];
    const inPreviousMap = previousFlowChanges ? !!previousFlowChanges.idPrimitiveMap[id] : false;
    if (inPreviousMap) {
      // In last map, resident or moved        
      if (!previousFlowChanges.idParentIdMap || (previousFlowChanges.idParentIdMap[id] === idParentIdMap[id])) {
        // Same parent, resident
        flowChanges.globallyResident[id] = primitive;
      } else {
        // Moved
        flowChanges.globallyMoved[id] = primitive;
      }
    } else {
      // Globally added
      flowChanges.globallyAdded[id] = primitive;
    }
  }

  // Find removed nodes
  for (let id in previousFlowChanges.idPrimitiveMap) {
    const inPreviousMap = previousFlowChanges.idPrimitiveMap[id];
    if (typeof(idPrimitiveMap[id]) === "undefined" && !inPreviousMap.parentPrimitive) { // Consider: Keep track of directly removed using inPreviousMap.parentPrimitive? 
      flowChanges.globallyRemoved[id] = inPreviousMap;
    }
  }

  function filterAnimatedInMap(map) {
     return Object.values(map)
      .reduce((result, flow) => {
        if (flow.animation) {

          let stableFoundation = true; 
          let scan = flow.parentPrimitive;
          while(scan) {
          
            if (flowChanges.globallyAdded[scan.id] && (!scan.animation || !scan.animation.allwaysStableFoundationEvenWhenAdded())) {
              stableFoundation = false; 
              break; 
            }
            scan = scan.parentPrimitive;
          }
          if (stableFoundation || flow.animation.acceptUnstableFoundation(scan)) {
            result[flow.id] = flow;
          }
        }
        return result;
      }, {});
  }

  flowChanges.globallyAddedAnimated = filterAnimatedInMap(flowChanges.globallyAdded);
  flowChanges.globallyResidentAnimated = filterAnimatedInMap(flowChanges.globallyResident);
  flowChanges.globallyMovedAnimated = filterAnimatedInMap(flowChanges.globallyMoved);
  flowChanges.globallyRemovedAnimated = filterAnimatedInMap(flowChanges.globallyRemoved);

  function toStrings(changes) {
    return {
      addedIncludingNonAnimated: Object.values(changes.globallyAdded).map(flow => flow.toString()),
      added: Object.values(changes.globallyAddedAnimated).map(flow => flow.toString()),
      resident: Object.values(changes.globallyResidentAnimated).map(flow => flow.toString()), 
      moved: Object.values(changes.globallyMovedAnimated).map(flow => flow.toString()),
      movedIncludingNonAnimated: Object.values(changes.globallyMoved).map(flow => flow.toString()),
      removed: Object.values(changes.globallyRemovedAnimated).map(flow => flow.toString()),
      removedIncludingNonAnimated: Object.values(changes.globallyRemoved).map(flow => flow.toString()),
    }
  }

  // Mark each flow / node with changes and chained changes sequences for analysis. 
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.getDomNode()) {
      const changes = {
        number: flowChanges.number,
        activated: false, 
        type: changeType.resident,
        previous: flow.changes,
        transitioningProperties: (flow.changes && flow.changes.transitioningProperties) ? flow.changes.transitioningProperties : {} 
      };
      flow.changes = changes; 
      flow.domNode.changes = changes; 
    }
  }

  // Mark all animated. 
  for (let flow of flowChanges.allAnimatedMovedFlows()) {
    if (flow.domNode) {
      flow.domNode.changes.type = changeType.moved;
    }
  }
  for (let flow of flowChanges.allAnimatedAddedFlows()) {
    if (flow.getDomNode()) {
      flow.domNode.changes.type = changeType.added; 
    }
  }
  for (let flow of flowChanges.allAnimatedRemovedFlows()) {
    if (flow.domNode) {
      flow.domNode.changes.type = changeType.removed;
      flow.domNode.changes.targetDimensions = {width: flow.domNode.offsetWidth, height: flow.domNode.offsetHeight } 
    }
  }

  if (traceAnimation) {
    console.groupEnd();
    console.log("New animated changes:");
    log(toStrings(flowChanges));
  }
  logAnimationSeparator("---------------------------------------- Measure original bounds... ------------------------------------------");

  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.getDomNode()) {
      flow.animation.recordOriginalBoundsAndStyle(flow);
    }
  }
  
  logAnimationSeparator("---------------------------------------- Prepare for DOM building... -----------------------------------------");

  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.prepareForDOMBuilding(flow)
    }
  }

  // Insert deflated trailers for moved. 
  
  logAnimationSeparator("---------------------------------------- Rebuilding DOM... ----------------------------------------------------")
  if (traceAnimation) console.groupCollapsed("...");
  flowChanges.onFinishReBuildingFlowDone = true;
}

// Insert deflated leaders for removed but insert added nodes directly to be as close as possible to target for measuring


/**
 * On finish rebuilding DOM
 * 
 * Between these two functions the DOM is rebuilt with new structure and styling. 
 * 
 * Consider: Block style changes for transform for nodes in an animation?
 */
export function onFinishReBuildingDOM() {

  // counter++
  if (!flowChanges.onFinishReBuildingFlowDone) return;
  delete flowChanges.onFinishReBuildingFlowDone;

  if (traceAnimation) console.groupEnd();
  logAnimationSeparator("---------------------------------------- DOM rebuilt, measure target sizes ... -------------------------------");
  
  // Measure the final size of added and moved (do this before we start to emulate original)
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.domJustRebuiltMeasureTargetSizes(flow);
    }
  }
  // if (inExperiment()) return;


  logAnimationSeparator("---------------------------------------- Emulate original footprints and styles ------------------------------");
  // Consider: Introduce leaders at this stage to do more accurate target size measurements without leaders? 
  // Styles needs to be original at this point to have correct footprints. 

  // Emulate original footprints. 
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.emulateOriginalFootprintsAndFixateAnimatedStyle(flow);
    }
  }
  // if (inExperimentOnCount(3)) return;
  // We now have original style and footprints, but new structure. 
  
  logAnimationSeparator("---------------------------------------- Emulate original bounds for FLIP animations -------------------------");
  
  // Emulate original footprints. 
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.emulateOriginalBounds(flow);
    }
  }

  // Activate animations using a function call to freeze flow changes in a lexical closure. 
  activateAnimationAfterFirstRender({...flowChanges});  
}



function activateAnimationAfterFirstRender(currentFlowChanges) {
  
  // Pause causality reactions while we wait for a new frame. 
  postponeInvalidations();

  requestAnimationFrame(() => {
    logAnimationSeparator("---------------------------------------- Rendered first frame, activate animations...  ---------------------");

    // TODO: Cleanup may have occured at this stage while we were waiting for the first frame. If so, act accordingly. 

    // if (currentFlowChanges.number !== flowChanges.number) {
    //   throw new Error("A change triggered while animation not started, consider removing event listeners using pointerEvents:none or similar");
    //   // TODO: Support the possibility of animation flow changes between animation start and animation activation somehow. 
    // }
    // if (inExperiment()) return; 

    for (let flow of currentFlowChanges.allAnimatedFlows()) {
      if (flow.domNode) {
        if (traceAnimation) {
          console.group();
          console.log(flow.domNode);
        }
        flow.animation.activateAnimation(flow, currentFlowChanges);
        if (traceAnimation) {
          console.groupEnd();
        }
      }
      flow.changes.activated = true; 
    }

    // if (inExperimentOnCount(3)) return;

    logAnimationSeparator("---------------------------------------- Setup animation cleanup...  ---------------------");

    // Note: There is still time to do this since we have not released controll and allowed a second frame to render. 
    for (let flow of currentFlowChanges.allAnimatedFlows()) {
      if (flow.domNode) {
        flow.animation.setupAnimationCleanup(flow);
      }
    }

    logAnimationSeparator(counter + "------------------------------------------------------------------------------------------------------------");
    console.groupEnd()

    // Reactivate causality reactions while we wait for a new frame. 
    continueInvalidations();
  });
}


/**
 * Helpers
 */
export function sameBounds(b1, b2) {
  // log("sameBounds");
  // log(b1);
  // log(b2)
  return (
      b1.top === b2.top &&
      b1.left === b2.left &&
      b1.width === b2.width &&
      b1.height === b2.height
  );
}

export const camelCase = (function () {
  var DEFAULT_REGEX = /[-_]+(.)?/g;

  function toUpper(match, group1) {
      return group1 ? group1.toUpperCase() : '';
  }
  return function (str, delimiters) {
      return str.replace(delimiters ? new RegExp('[' + delimiters + ']+(.)?', 'g') : DEFAULT_REGEX, toUpper);
  };
})();

export function getHeightIncludingMargin(node) {
  var styles = window.getComputedStyle(node);
  var margin = parseFloat(styles['marginTop']) +
               parseFloat(styles['marginBottom']);

  return Math.ceil(node.offsetHeight + margin);
}

export function getWidthIncludingMargin(node) {
  var styles = window.getComputedStyle(node);
  var margin = parseFloat(styles['marginLeft']) +
               parseFloat(styles['marginRight']);
  return Math.ceil(node.offsetWidth + margin);
}


/**
 * Animation research
 */

// export function analyzeAddedRemovedResident(oldIdMap, newIdMap) {
//   const removed = [];
//   const added = [];
//   const present = [];
//   for(let id in oldIdMap) {
//     if (typeof(newIdMap[id]) === "undefined") {
//       removed.push(oldIdMap[id]);
//     } else {
//       present.push(oldIdMap[id]);
//     }
//   }
//   for(let id in newIdMap) {
//     if (typeof(oldIdMap[id]) === "undefined") {
//       added.push(newIdMap[id]);
//     }
//   }
//   return {removed, added, present};
// }


// Consider: Could parseMatrix be used to catch divs mid air and continue with another animation?  

export function parseMatrix(matrix) {
  function extractScaleTranslate(matrix) {
    return {
    scaleX: matrix[0],
    scaleY: matrix[3],
    translateX: matrix[4],
    translateY: matrix[5],
    }
  }

  let matrixPattern = /^\w*\((-?((\d+)|(\d*\.\d+)),\s*)*(-?(\d+)|(\d*\.\d+))\)/i
  if (matrixPattern.test(matrix)) {
    let matrixCopy = matrix.replace(/^\w*\(/, '').replace(')', '');
    // console.log(matrixCopy);
    let matrixValue = matrixCopy.split(/\s*,\s*/).map(value => parseFloat(value));
    // log(matrixValue);
    return extractScaleTranslate(matrixValue);
  }
  return extractScaleTranslate([1, 0, 0, 1, 0, 0]);
}

// Possibly transform bounds? 
// const transform = parseMatrix(computedStyle.transform); 
// log(transform);
// result[node.equivalentCreator.causality.id] = {
//   top: bounds.top, //+ transform.translateY, 
//   left: bounds.left,// + transform.translateX, 
//   width: bounds.width,// * transform.scaleX, 
//   height: bounds.height,// * transform.scaleY
// };

// Stop ongoing animation!
// node.style.transition = "";
// const computedStyle = getComputedStyle(node);
// // Object.assign(node.style, computedStyle);
// if (computedStyle.transform !== "") {
//   node.style.transform = computedStyle.transform; 
// }

// let nextOriginMark = 0;



// function findAndRecordOriginalBoundsOfOrigin(flow) {
//   const originMark = nextOriginMark++;
      
//   // Scan and mark old dom structure
//   let scan = flow.domNode.parentNode; 
//   if (!scan) {
//     console.log(flow);
//     console.log(flow.domNode);
//     console.log(scan);
//     throw new Error("Did not expect an animated without a parent!")
//   } 
//   while (scan) {
//     scan.originMark = originMark;
//     scan = scan.parentNode;
//   }
  
//   // Scan new flow structure and find common ancestor for present flow
//   scan = flow.parentPrimitive;
//   while (scan) {
//     if (scan.domNode && scan.domNode.originMark === originMark) {
//       flow.domNode.animationOriginNode = scan.domNode;
//       break;
//     }
//     scan = scan.parentPrimitive;
//   }
  
// standardAnimation.recordOriginalBoundsAndStyle(flow.domNode.animationOriginNode);  
// }



