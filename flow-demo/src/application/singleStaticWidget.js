import { observable, Component, component, repeat } from "../flow/Flow";
import { DOMFlowTarget } from "../flow.DOMTarget/DOMFlowTarget.js";
import { panel, text } from "../components/basic/BasicWidgets";
import { column, filler, row, centerMiddle, columnStyle} from "../components/basic/Layout";
import { modernButton } from "../components/modern/ModernButton";
import { animatedContainerStyle, borderStyle, panelStyle } from "../components/modern/Style";
import { div, span } from "../flow.DOMTarget/BasicHtml"
;
import { button } from "../components/themed/Theme";
import { suitcaseIcon } from "../components/basic/Icons";


const log = console.log;

/**
 * Minimalistic component used for experiments. 
 */
export class SingleStaticWidget extends Component {
  setState() {}

  build() {
  
    const singleWidget = text("Hello");

    // const singleWidget = button(
    //   suitcaseIcon(), 
    //   span("Add luggage", {style: {marginLeft: "5px"}}),
    //   () => { log("Pressed!") }
    // );

    // const singleWidget = panel(text("in a panel"));
  
    return centerMiddle(singleWidget);
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startSingleStaticWidget() {
  const singleWidget = new SingleStaticWidget()  
  new DOMFlowTarget(document.getElementById("flow-root")).setContent(singleWidget)
}
