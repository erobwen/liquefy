import { configuration, model, setFlowConfiguration } from "@liquefy/flow.core";
import { installDOMAnimation, resetDOMAnimation } from "@liquefy/flow.DOM";

import { startRecursiveDemo } from "./pages/recursiveDemoApplication.js";
import { startReactiveFormApplication } from "./pages/reactiveFormApplication.js";
import { startDemo } from "./demo.js";
import { startAnimationExample } from "./pages/animationExample.js";
import { startProgrammaticReactiveLayout } from "./pages/programmaticReactiveLayout.js";
import { startModalDemo } from "./pages/modalDemo.js";
import { startPortalDemo } from "./pages/portalDemo.js";

import { logMark } from "@liquefy/flow.core";
import { basicTheme } from "@liquefy/basic-ui";
import { assignGlobalTheme } from "@liquefy/themed-ui";

assignGlobalTheme(basicTheme);

// Setup flow 
setFlowConfiguration({
  traceReactivity: false,
  warnWhenNoKey: false,
  autoAssignProperties: true
});
installDOMAnimation();

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