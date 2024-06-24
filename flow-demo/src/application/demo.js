import { observable, Component, component, repeat, creators } from "../flow/Flow";
import { DOMFlowTarget } from "../flow.DOMTarget/DOMFlowTarget.js";
import { AnimationExample } from "./animationExample";
import { ComplexForm, initialData } from "./complexFormApplication";
import { RecursiveExample } from "./recursiveDemoApplication";
import { ProgrammaticReactiveLayout } from "./programmaticReactiveLayout";
import { PortalExample } from "./portalDemo";
import { ModalExample } from "./modalDemo";
import { portalExit } from "../components/basic/Portals";
import { button } from "../components/themed/Theme";
import { column, columnStyle, filler, flexAutoStyle, row } from "../components/basic/Layout";
import { svgImage } from "./images";
import { startExperiment } from "..";
import flowImage from "../../resources/flow.svg"
import { applicationMenuFrame } from "../components/basic/ApplicationMenuFrame";
import { text } from "../components/basic/BasicWidgets";
import { logMark } from "../flow/utility";
import { span } from "../flow.DOMTarget/BasicHtml";

const log = console.log;

/**
 * Demo
 */

export class Demo extends Component {
  setState() {
    this.leftColumnPortal = portalExit({key: "portal", style: {...columnStyle, overflow: "visible"}});

    // Example of building static child-flow components in the setState. Remember to add them to onEstablish/onDispose
    this.items = [
      new RecursiveExample({key: "recursiveDemo", name: "Recursive Example"}),
      new ComplexForm({key: "complexForm", initialData}),
      new AnimationExample({key: "animationExample", items: ["Foo", "Fie", "Fum", "Bar", "Foobar", "Fiebar", "Fumbar"]}),
      new ProgrammaticReactiveLayout({key: "programmaticReactiveLayout", name: "Programmatic Responsiveness"}),
      new ModalExample({key: "modalExample", portal: this.leftColumnPortal}),
      new PortalExample({key: "portalExample", portal: this.leftColumnPortal})
    ];
    
    for (let item of this.items) {
      item.onEstablish();
    }

    // this.choosen = this.items.find(item => item.key === "complexForm");
    // this.choosen = this.items.find(item => item.key === "portalExample");
    // this.choosen = this.items.find(item => item.key === "programmaticReactiveLayout");
    // this.choosen = this.items.find(item => item.key === "modalExample");
    this.choosen = this.items.find(item => item.key === "recursiveDemo");
  }
  
  disposeState() {
    super.onDispose();
    for (let name in this.items) {
      this.items[name].onDispose();
    }
    this.leftColumnPortal.onDispose();
    this.leftColumnPortal.dispose();
  }

  buildButton(item) {
    return button(item.name, {onClick: () => { this.choosen = item }, pressed: this.choosen === item});
  }

  buildMenu() {
    const buttons = [];
    buttons.push(svgImage({image: flowImage}));
    for (let item of this.items) {
      buttons.push(
        this.buildButton(item)
      )
    }
    buttons.push(this.leftColumnPortal);
    buttons.push(filler());
    // buttons.push(button({text: "Experiment", onClick: () => {
    //   startExperiment();
    // }}));

    return column(
      buttons,
      {
        key: "left-column", 
        style: {
          ...flexAutoStyle, 
          borderRight: "2px", 
          borderRightStyle: "solid", 
          backgroundColor: "lightgray", 
          overflow: "visible"
        }
      }
    );
  }

  build() {
    // return text("Foo");
    // logMark("build demo")
    return applicationMenuFrame({
      appplicationMenu: this.buildMenu(),
      applicationContent: this.choosen,
      topPanelContent: [span(), text("by Robert Renbris")],
      bounds: this.bounds
    })
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startDemo() {
  new DOMFlowTarget(document.getElementById("flow-root")).setContent(
    new Demo()
  );
}
