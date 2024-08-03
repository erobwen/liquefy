import { themeTest } from "./themeTest"
import { configuration, model, setFlowConfiguration } from "@liquefy/flow.core";
import { setBasicUIAsTheme } from "@liquefy/basic-ui";
import { startInputTest } from "./inputTest";

setFlowConfiguration({
  traceReactivity: true,
  warnWhenNoKey: false,
  autoAssignProperties: true
});

setBasicUIAsTheme();

// buttonTest();
// startSimpleMoveAnimation();
// startSimpleAddRemoveAnimation();
// startSimpleApplicationMenu();
// startSingleStaticWidget();
// startPatternMatching();
// startHelloWorld();
// themeTest();

startInputTest();