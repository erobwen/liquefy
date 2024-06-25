import { setFlowConfiguration, DOMFlowTarget, div, text } from "@liquefy/flow";

setFlowConfiguration({
  warnWhenNoKey: false,
  traceReactivity: false,
  autoAssignProperties: true
});

new DOMFlowTarget(document.getElementById("flow-root")).setContent(
  new HelloWorld()
);

class HelloWorld {
  render() {
    return div(text("Hello World"));
  }
}