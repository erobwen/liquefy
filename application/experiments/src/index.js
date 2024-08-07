import { themeTest } from "./themeTest"
import { configuration, model, setFlowConfiguration } from "@liquefy/flow.core";
import { setBasicUIAsTheme } from "@liquefy/basic-ui";

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

themeTest();