import { configuration, postponeInvalidations, continueInvalidations, traceAnimation, traceWarnings } from "@liquefy/flow.core";
import { logAnimationFrameGroup, logAnimationSeparator } from "@liquefy/flow.core";
import { getDomRenderContexts } from "./DOMRenderContext";

// import { inExperiment, inExperimentOnCount } from "..";

const log = console.log;

/**
 * Installation
 */
export function installDOMAnimation() {
  configuration.onFinishRenderingComponentsCallbacks.push(onFinishRenderingComponents);
  configuration.onFinishReBuildingDOMCallbacks.push(onFinishReBuildingDOM);
}


/**
 * Reset global animation state (on hot reload)
 */
export function resetDOMAnimation() {
  Object.assign(componentChanges, newComponentChanges());
  previousComponentChanges = {}
  counter = 0;
  getDomRenderContexts().length = 0;
}


/**
 * Freeze component changes (to prevent chained animations)
 */
let count = 0;
export function freezeComponentChanges() {
  count++;
  if (traceAnimation && traceWarnings) console.warn("Risky to use freeze " + count);
  // postponeInvalidations();
}

export function unfreezeComponentChanges() {
  count--;
  if (traceAnimation && traceWarnings) console.warn("Unfreeze... " + count);
  // continueInvalidations();
}


/**
 * Debug printouts
 */
export function logProperties(object, properties) {
  log(extractProperties(object, properties));
}


/**
 * Global component change tracking
 */
export const componentChanges = newComponentChanges();

function newComponentChanges() {
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

  *allAnimatedComponents() {
    for (let component of Object.values(this.globallyAddedAnimated)) {
      yield component; 
    }
    for (let component of Object.values(this.globallyRemovedAnimated)) {
      yield component; 
    }
    for (let component of Object.values(this.globallyResidentAnimated)) {
      yield component; 
    }
    for (let component of Object.values(this.globallyMovedAnimated)) {
      yield component; 
    }
  },

  *allAddedFlows() {
    for (let component of Object.values(this.globallyAdded)) {
      yield component; 
    }
  },
  
  *allAnimatedAddedFlows() {
    for (let component of Object.values(this.globallyAddedAnimated)) {
      yield component; 
    }
  },
  
  *allAnimatedRemovedFlows() {
    for (let component of Object.values(this.globallyRemovedAnimated)) {
      yield component; 
    }
  },

  *allAnimatedResidentFlows() {
    for (let component of Object.values(this.globallyResidentAnimated)) {
      yield component; 
    }
  },

  *allAnimatedMovedFlows() {
    for (let component of Object.values(this.globallyMovedAnimated)) {
      yield component; 
    }
  },

  *allAnimatedMovedResidentAndRemovedFlows() {
    for (let component of Object.values(this.globallyResidentAnimated)) {
      yield component; 
    }
    for (let component of Object.values(this.globallyMovedAnimated)) {
      yield component; 
    }
    for (let component of Object.values(this.globallyRemovedAnimated)) {
      yield component; 
    }
  },

  *allAnimatedMovedResidentFlows() {
    for (let component of Object.values(this.globallyResidentAnimated)) {
      yield component; 
    }
    for (let component of Object.values(this.globallyMovedAnimated)) {
      yield component; 
    }
  },

  *allAnimatedMovedAddedAndRemovedFlows() {
    for (let component of Object.values(this.globallyMovedAnimated)) {
      yield component; 
    }
    for (let component of Object.values(this.globallyAddedAnimated)) {
      yield component; 
    }
    for (let component of Object.values(this.globallyRemovedAnimated)) {
      yield component; 
    }
  },
})
};


/**
 * Flow changes, to keep track of animation frames. 
 */
export let previousComponentChanges = {}
window.componentChanges = componentChanges;
let counter = 0;

export const changeType = {
  resident: "resident", 
  added: "added", 
  removed: "removed",
  moved: "moved"
}


/**
 * On finish rendering components
 */
export function onFinishRenderingComponents() {
  
  counter++
  if (traceAnimation) {
    logAnimationFrameGroup(counter)
    logAnimationSeparator("---------------------------------------- Flow rebuilt, DOM untouched, calculate changes... -------------------");
    console.groupCollapsed("Potentially start DOM building for new components here ...");
    // log(counter);
  }
  // if (counter === 5) return; 

  // Save previous state for comparison
  Object.assign(previousComponentChanges, componentChanges);
  
  // Reset current state
  componentChanges.number++;
  componentChanges.idPrimitiveMap = {};
  componentChanges.idParentIdMap = {};
  componentChanges.globallyAdded = {}; 
  componentChanges.globallyResident = {}; 
  componentChanges.globallyMoved = {};
  componentChanges.globallyRemoved = {};
  
  // componentChanges.structure = null; // TODO
  // componentChanges.idToStructure = new Map()

  const idPrimitiveMap = componentChanges.idPrimitiveMap;
  const idParentIdMap = componentChanges.idParentIdMap;

  function analyzePrimitives(idPrimitiveMap, primitiveComponent) {
    idPrimitiveMap[primitiveComponent.id] = primitiveComponent;
    idParentIdMap[primitiveComponent.id] = primitiveComponent.parentPrimitive;
  
    for (let child of primitiveComponent.iteratePrimitiveChildren()) {
      analyzePrimitives(idPrimitiveMap, child);
    }
  }

  // function copyStructure(primitiveComponent, parent) {
  //   const result = {
  //     parent, 
  //     children: [...mapIter(
  //       primitiveComponent.iteratePrimitiveChildren(), 
  //       (child) => copyStructure(child, primitiveComponent)
  //     )]
  //   }
  //   componentChanges.idToStructure.set(primitiveComponent.id, result);
  //   return result; 
  // }

  // function* mapIter(iterable, callback) {
  //   for (let x of iterable) {
  //     yield callback(x);
  //   }
  // }
  
  for (let context of getDomRenderContexts()) {
    analyzePrimitives(idPrimitiveMap, context.component.getPrimitive());
    // componentChanges.structure = copyStructure(context.component.getPrimitive(), null) 
  }
  // console.log(idParentIdMap);

  // Added, resident or moved 
  for (let id in idPrimitiveMap) {
    const primitive = idPrimitiveMap[id];
    const inPreviousMap = previousComponentChanges ? !!previousComponentChanges.idPrimitiveMap[id] : false;
    if (inPreviousMap) {
      // In last map, resident or moved        
      if (!previousComponentChanges.idParentIdMap || (previousComponentChanges.idParentIdMap[id] === idParentIdMap[id])) {
        // Same parent, resident
        componentChanges.globallyResident[id] = primitive;
      } else {
        // Moved
        componentChanges.globallyMoved[id] = primitive;
      }
    } else {
      // Globally added
      componentChanges.globallyAdded[id] = primitive;
    }
  }

  // Find removed nodes
  for (let id in previousComponentChanges.idPrimitiveMap) {
    const inPreviousMap = previousComponentChanges.idPrimitiveMap[id];
    if (typeof(idPrimitiveMap[id]) === "undefined" && !inPreviousMap.parentPrimitive) { // Consider: Keep track of directly removed using inPreviousMap.parentPrimitive? 
      componentChanges.globallyRemoved[id] = inPreviousMap;
    }
  }

  function filterAnimatedInMap(map) {
     return Object.values(map)
      .reduce((result, component) => {
        if (component.getAnimation()) {

          let stableFoundation = true; 
          let scan = component.parentPrimitive;
          while(scan) {
          
            if (componentChanges.globallyAdded[scan.id] && (!scan.getAnimation() || !scan.getAnimation().allwaysStableFoundationEvenWhenAdded())) {
              stableFoundation = false; 
              break; 
            }
            scan = scan.parentPrimitive;
          }
          if (stableFoundation || component.getAnimation().acceptUnstableFoundation(scan)) {
            result[component.id] = component;
          }
        }
        return result;
      }, {});
  }

  componentChanges.globallyAddedAnimated = filterAnimatedInMap(componentChanges.globallyAdded);
  componentChanges.globallyResidentAnimated = filterAnimatedInMap(componentChanges.globallyResident);
  componentChanges.globallyMovedAnimated = filterAnimatedInMap(componentChanges.globallyMoved);
  componentChanges.globallyRemovedAnimated = filterAnimatedInMap(componentChanges.globallyRemoved);

  function toStrings(changes) {
    return {
      addedIncludingNonAnimated: Object.values(changes.globallyAdded).map(component => component.toString()),
      added: Object.values(changes.globallyAddedAnimated).map(component => component.toString()),
      resident: Object.values(changes.globallyResidentAnimated).map(component => component.toString()), 
      moved: Object.values(changes.globallyMovedAnimated).map(component => component.toString()),
      movedIncludingNonAnimated: Object.values(changes.globallyMoved).map(component => component.toString()),
      removed: Object.values(changes.globallyRemovedAnimated).map(component => component.toString()),
      removedIncludingNonAnimated: Object.values(changes.globallyRemoved).map(component => component.toString()),
    }
  }

  // Mark each component / node with changes and chained changes sequences for analysis. 
  for (let component of componentChanges.allAnimatedComponents()) {
    if (component.getDomNode()) {
      const changes = {
        number: componentChanges.number,
        activated: false, 
        type: changeType.resident,
        previous: component.changes,
        transitioningProperties: (component.changes && component.changes.transitioningProperties) ? component.changes.transitioningProperties : {} 
      };
      component.changes = changes; 
      component.domNode.changes = changes; 
    }
  }

  // Mark all animated. 
  for (let component of componentChanges.allAnimatedMovedFlows()) {
    if (component.domNode) {
      component.domNode.changes.type = changeType.moved;
    }
  }
  for (let component of componentChanges.allAnimatedAddedFlows()) {
    if (component.getDomNode()) {
      component.domNode.changes.type = changeType.added; 
    }
  }
  for (let component of componentChanges.allAnimatedRemovedFlows()) {
    if (component.domNode) {
      component.domNode.changes.type = changeType.removed;
      component.domNode.changes.targetDimensions = {width: component.domNode.offsetWidth, height: component.domNode.offsetHeight } 
    }
  }

  if (traceAnimation) {
    console.groupEnd();
    console.log("New animated changes:");
    log(toStrings(componentChanges));
  }
  logAnimationSeparator("---------------------------------------- Measure original bounds... ------------------------------------------");

  for (let component of componentChanges.allAnimatedComponents()) {
    if (component.getDomNode()) {
      component.getAnimation().recordOriginalBoundsAndStyle(component);
    }
  }
  
  logAnimationSeparator("---------------------------------------- Prepare for DOM building... -----------------------------------------");

  for (let component of componentChanges.allAnimatedComponents()) {
    if (component.domNode) {
      component.getAnimation().prepareForDOMBuilding(component)
    }
  }

  // Insert deflated trailers for moved. 
  
  logAnimationSeparator("---------------------------------------- Rebuilding DOM... ----------------------------------------------------")
  if (traceAnimation) console.groupCollapsed("...");
  componentChanges.onFinishRenderingComponentsDone = true;
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
  if (!componentChanges.onFinishRenderingComponentsDone) return;
  delete componentChanges.onFinishRenderingComponentsDone;

  if (traceAnimation) console.groupEnd();
  logAnimationSeparator("---------------------------------------- DOM rebuilt, measure target sizes ... -------------------------------");
  
  // Measure the final size of added and moved (do this before we start to emulate original)
  for (let component of componentChanges.allAnimatedComponents()) {
    if (component.domNode) {
      component.getAnimation().domJustRebuiltMeasureTargetSizes(component);
    }
  }
  // if (inExperiment()) return;


  logAnimationSeparator("---------------------------------------- Emulate original footprints and styles ------------------------------");
  // Consider: Introduce leaders at this stage to do more accurate target size measurements without leaders? 
  // Styles needs to be original at this point to have correct footprints. 

  // Emulate original footprints. 
  for (let component of componentChanges.allAnimatedComponents()) {
    if (component.domNode) {
      component.getAnimation().emulateOriginalFootprintsAndFixateAnimatedStyle(component);
    }
  }
  // if (inExperimentOnCount(3)) return;
  // We now have original style and footprints, but new structure. 
  
  logAnimationSeparator("---------------------------------------- Emulate original bounds for FLIP animations -------------------------");
  
  // Emulate original footprints. 
  for (let component of componentChanges.allAnimatedComponents()) {
    if (component.domNode) {
      component.getAnimation().emulateOriginalBounds(component);
    }
  }

  // Activate animations using a function call to freeze component changes in a lexical closure. 
  activateAnimationAfterFirstRender({...componentChanges});  
}



function activateAnimationAfterFirstRender(currentComponentChanges) {
  
  // Pause causality reactions while we wait for a new frame. 
  postponeInvalidations();

  requestAnimationFrame(() => {
    logAnimationSeparator("---------------------------------------- Rendered first frame, activate animations...  ---------------------");

    // TODO: Cleanup may have occured at this stage while we were waiting for the first frame. If so, act accordingly. 

    // if (currentComponentChanges.number !== componentChanges.number) {
    //   throw new Error("A change triggered while animation not started, consider removing event listeners using pointerEvents:none or similar");
    //   // TODO: Support the possibility of animation component changes between animation start and animation activation somehow. 
    // }
    // if (inExperiment()) return; 

    for (let component of currentComponentChanges.allAnimatedComponents()) {
      if (component.domNode) {
        if (traceAnimation) {
          console.group();
          console.log(component.domNode);
        }
        component.getAnimation().activateAnimation(component, currentComponentChanges);
        if (traceAnimation) {
          console.groupEnd();
        }
      }
      component.changes.activated = true; 
    }

    // if (inExperimentOnCount(3)) return;

    logAnimationSeparator("---------------------------------------- Setup animation cleanup...  ---------------------");

    // Note: There is still time to do this since we have not released controll and allowed a second frame to render. 
    for (let component of currentComponentChanges.allAnimatedComponents()) {
      if (component.domNode) {
        component.getAnimation().setupAnimationCleanup(component);
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



// function findAndRecordOriginalBoundsOfOrigin(component) {
//   const originMark = nextOriginMark++;
      
//   // Scan and mark old dom structure
//   let scan = component.domNode.parentNode; 
//   if (!scan) {
//     console.log(component);
//     console.log(component.domNode);
//     console.log(scan);
//     throw new Error("Did not expect an animated without a parent!")
//   } 
//   while (scan) {
//     scan.originMark = originMark;
//     scan = scan.parentNode;
//   }
  
//   // Scan new component structure and find common ancestor for present component
//   scan = component.parentPrimitive;
//   while (scan) {
//     if (scan.domNode && scan.domNode.originMark === originMark) {
//       component.domNode.getAnimation()OriginNode = scan.domNode;
//       break;
//     }
//     scan = scan.parentPrimitive;
//   }
  
// standardAnimation.recordOriginalBoundsAndStyle(component.domNode.getAnimation()OriginNode);  
// }



