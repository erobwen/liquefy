import { themeTest } from "./themeTest"
import { configuration, model, setFlowConfiguration } from "@liquefy/flow.core";

// buttonTest();
// startSimpleMoveAnimation();
// startSimpleAddRemoveAnimation();
// startSimpleApplicationMenu();
// startSingleStaticWidget();
// startPatternMatching();
// startHelloWorld();

setFlowConfiguration({
  traceReactivity: true,
  warnWhenNoKey: false,
  autoAssignProperties: true
});

themeTest();