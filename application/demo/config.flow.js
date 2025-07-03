import { setFlowConfiguration } from "@liquefy/flow.core";
import { installDOMAnimation } from "@liquefy/flow.DOM";

setFlowConfiguration({
  traceReactivity: false,
  warnWhenNoKey: false,
  autoAssignProperties: true
});
installDOMAnimation();