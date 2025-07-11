import { startRecursiveDemo } from "./src/pages/recursiveDemoApplication.js";
import { startReactiveFormApplication } from "./src/pages/reactiveFormApplication.js";
import { startDemo } from "./src/demo.js";
import { startAnimationExample } from "./src/pages/animationExample.js";
import { startProgrammaticReactiveLayout } from "./src/pages/programmaticReactiveLayout.js";
import { startModalDemo } from "./src/pages/modalDemo.js";
import { startPortalDemo } from "./src/pages/portalDemo.js";

import { basicTheme } from "@liquefy/basic-ui";
import { assignGlobalTheme } from "@liquefy/themed-ui";

import "./config.flow.js"

assignGlobalTheme(basicTheme);

// Setup flow 


// if (module.hot) {
//   module.hot.accept();
//   module.hot.dispose(() => { 
//     resetDOMAnimation();
//     configuration.onFinishRenderingComponentsCallbacks.length = 0;
//     configuration.onFinishReBuildingDOMCallbacks.length = 0;
//   });
// }

// const debuggingState = model({
//   inExperiment: false
// })

// export function inExperiment() {
//   return debuggingState.inExperiment;
// }

// let counter = 1;

// export function inExperimentOnCount(countTo) {
//   if (counter >= countTo) {
//     startExperiment();
//     return true; 
//   }
//   counter++;
//   return false; 
// }

// export function startExperiment() {
//   logMark("STARTING EXPERIMENT")
//   setAnimationTime(50);
//   debuggingState.inExperiment = true;
// }

Array.prototype.remove = function(target) {
  const index = this.findIndex((element) => element === target);
  if (index >= 0) {
    this.splice(index, 1);
    return true;
  } else {
    return false; 
  }
}

/**
 * Set 
 */

// startRecursiveDemo();
// startReactiveFormApplication();
// startAnimationExample();
// startProgrammaticReactiveLayout();
// startModalDemo();
// startPortalDemo();

startDemo();