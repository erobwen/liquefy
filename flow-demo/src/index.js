import { startRecursiveDemo } from "./application/recursiveDemoApplication.js";
import { startHelloWorld } from "./application/helloWorldApplication.js";
import { configuration, model, setFlowConfiguration } from "./flow/Flow.js";
import { startProgrammaticReactiveLayout } from "./application/programmaticReactiveLayout.js";
import { startComplexFormApplication } from "./application/complexFormApplication.js";
import { startAnimationExample } from "./application/animationExample.js";
import { startDemo } from "./application/demo.js";
import { installDOMAnimation, resetDOMAnimation } from "./flow.DOM/DOMAnimation.js";
import { startPatternMatching } from "./application/patternMatching.js";
import { buttonTest } from "./application/buttonTest.js";
import { startModalDemo } from "./application/modalDemo.js";
import { startSingleStaticWidget } from "./application/singleStaticWidget.js";
import { startSimpleMoveAnimation } from "./application/simpleMoveAnimation.js";
import { startSimpleAddRemoveAnimation } from "./application/simpleAddRemoveAnimation.js";
import { logMark } from "./flow/utility.js";
import { setAnimationTime } from "./flow.DOM/ZoomFlyDOMNodeAnimation.js";
import { startSimpleApplicationMenu } from "./application/simpleApplicationMenu.js";

if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => { 
    resetDOMAnimation();
    configuration.onFinishReBuildingFlowCallbacks.length = 0;
    configuration.onFinishReBuildingDOMCallbacks.length = 0;
  });
}

const debuggingState = model({
  inExperiment: false
})

export function inExperiment() {
  return debuggingState.inExperiment;
}

let counter = 1;

export function inExperimentOnCount(countTo) {
  if (counter >= countTo) {
    startExperiment();
    return true; 
  }
  counter++;
  return false; 
}

export function startExperiment() {
  logMark("STARTING EXPERIMENT")
  setAnimationTime(50);
  debuggingState.inExperiment = true;
}

Array.prototype.remove = function(target) {
  const index = this.findIndex((element) => {
    return element === target;
  });
  if (index >= 0) {
    this.splice(index, 1);
    return true;
  } else {
    return false; 
  }
}

setFlowConfiguration({
  warnWhenNoKey: false,
  traceReactivity: false,
  autoAssignProperties: true
});
installDOMAnimation();

// buttonTest();
// startSimpleMoveAnimation();
// startSimpleAddRemoveAnimation();
// startSimpleApplicationMenu();
// startSingleStaticWidget();
// startPatternMatching();

startDemo();

// startModalDemo();
// startAnimationExample();
// startHelloWorld();
// startRecursiveDemo();
// startProgrammaticReactiveLayout();
// startComplexFormApplication();

