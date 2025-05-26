import { themeTest } from "./themeTest"
import { configuration, model, setFlowConfiguration } from "@liquefy/flow.core";
import { basicTheme } from "@liquefy/basic-ui";
import { assignGlobalTheme } from "@liquefy/themed-ui";
import { materialExperiment } from "./materialExperiments";

// assignGlobalTheme(basicTheme);

setFlowConfiguration({
  traceReactivity: false,
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

//themeTest();

materialExperiment();