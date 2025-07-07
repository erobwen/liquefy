import { setFlowConfiguration } from "@liquefy/flow.core";
import { installDOMAnimation } from "@liquefy/flow.dom";

setFlowConfiguration({
  traceReactivity: false,
  warnWhenNoKey: false,
  autoAssignProperties: true
});
installDOMAnimation();