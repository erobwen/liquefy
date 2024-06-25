import { setFlowConfiguration, DOMFlowTarget, div, text, Component } from "@liquefy/flow";

setFlowConfiguration({
  warnWhenNoKey: false,
  traceReactivity: false,
  autoAssignProperties: true
});

class HelloWorld extends Component {
  build() {
    return div(text("Hello World"));
  }
}

new DOMFlowTarget(document.getElementById("root")).setContent(
  new HelloWorld()
);

