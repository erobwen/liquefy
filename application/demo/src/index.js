import { configuration, model, setFlowConfiguration } from "@liquefy/flow.core";
import { installDOMAnimation, resetDOMAnimation } from "@liquefy/flow.DOM";

import { startRecursiveDemo } from "./pages/recursiveDemoApplication.js";
import { startComplexFormApplication } from "./pages/complexFormApplication.js";
import { startDemo } from "./demo.js";
import { startAnimationExample } from "./pages/animationExample.js";
import { startProgrammaticReactiveLayout } from "./pages/programmaticReactiveLayout.js";
import { startModalDemo } from "./pages/modalDemo.js";

import { logMark } from "@liquefy/flow.core";
import { setBasicUIAsTheme } from "@liquefy/basic-ui";

setBasicUIAsTheme();

// Setup flow 
setFlowConfiguration({
  warnWhenNoKey: false,
  traceReactivity: false,
  autoAssignProperties: true
});
installDOMAnimation();

// if (module.hot) {
//   module.hot.accept();
//   module.hot.dispose(() => { 
//     resetDOMAnimation();
//     configuration.onFinishReBuildingFlowCallbacks.length = 0;
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
// startComplexFormApplication();
// startAnimationExample();
// startProgrammaticReactiveLayout();
startModalDemo();
// startPortalDemo();

// startDemo();