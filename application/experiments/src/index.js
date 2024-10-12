import { themeTest } from "./themeTest"
import { configuration, model, setFlowConfiguration } from "@liquefy/flow.core";
import { setBasicUIAsTheme } from "@liquefy/basic-ui";
import { materialExperiment } from "./materialExperiments";

setFlowConfiguration({
  traceReactivity: true,
  warnWhenNoKey: false,
  autoAssignProperties: true
});

// buttonTest();
// startSimpleMoveAnimation();
// startSimpleAddRemoveAnimation();
// startSimpleApplicationMenu();
// startSingleStaticWidget();
// startPatternMatching();
// startHelloWorld();

//setBasicUIAsTheme();
//themeTest();

materialExperiment();