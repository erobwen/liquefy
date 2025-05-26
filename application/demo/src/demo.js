import { observable, Component, repeat, creators, logMark } from "@liquefy/flow.core";
import { DOMRenderContext, span, text } from "@liquefy/flow.DOM";

import { button, assignGlobalTheme } from "@liquefy/themed-ui";

import { modernTheme } from "@liquefy/modern-ui";

import { materialTheme } from "@liquefy/ui-material";

import { basicTheme, checkboxInputField, fitContainerStyle } from "@liquefy/basic-ui";
import { portalExit } from "@liquefy/basic-ui";
import { column, columnStyle, filler, naturalSizeStyle, row } from "@liquefy/basic-ui";
import { applicationMenuFrame, svgImage } from "@liquefy/basic-ui";

import { RecursiveExample } from "./pages/recursiveDemoApplication";
import { ReactiveForm, initialData } from "./pages/reactiveFormApplication";
import { AnimationExample } from "./pages/animationExample";
import { ProgrammaticReactiveLayout } from "./pages/programmaticReactiveLayout";
import { PortalExample } from "./pages/portalDemo";
import { ModalExample } from "./pages/modalDemo";

import flowImage from "../resources/flow.svg"

const log = console.log;

/**
 * Demo
 */
export class Demo extends Component {
  initialize() {
    this.selectedTheme = materialTheme;
    assignGlobalTheme(this.selectedTheme);

    this.leftColumnPortal = portalExit({key: "portal", style: {...columnStyle, overflow: "visible"}});

    // Example of building static child-flow components in the setState. Remember to add them to onEstablish/onDispose
    this.items = [
      new RecursiveExample({key: "recursiveDemo", name: "Recursive Components", style: fitContainerStyle}),
      new ReactiveForm({key: "reactiveForm", initialData, style: fitContainerStyle}),
      new AnimationExample({key: "animationExample", items: ["Foo", "Fie", "Fum", "Bar", "Foobar", "Fiebar", "Fumbar"], style: fitContainerStyle}),
      new ProgrammaticReactiveLayout({key: "programmaticReactiveLayout", name: "Programmatic Responsiveness", style: fitContainerStyle}),
      new ModalExample({key: "modalExample", style: fitContainerStyle}),
      new PortalExample({key: "portalExample", portal: this.leftColumnPortal, style: fitContainerStyle})
    ];
    
    for (let item of this.items) {
      item.onEstablish();
    }

    // this.choosen = this.items.find(item => item.key === "reactiveForm");
    // this.choosen = this.items.find(item => item.key === "portalExample");
    this.choosen = this.items.find(item => item.key === "animationExample");
    // this.choosen = this.items.find(item => item.key === "programmaticReactiveLayout");
    // this.choosen = this.items.find(item => item.key === "modalExample");
    // this.choosen = this.items.find(item => item.key === "recursiveDemo");
  }
  
  teardown() {
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
    buttons.push(button(
      this.selectedTheme === basicTheme ? "Material Theme" : "Basic Theme", 
      () => {
        this.selectedTheme = (this.selectedTheme === basicTheme) ? materialTheme : basicTheme
        assignGlobalTheme(
          this.selectedTheme
        )
      } 
    ));
    // buttons.push(button({text: "Experiment", onClick: () => {
    //   startExperiment();
    // }}));

    return column(
      buttons,
      {
        key: "left-column", 
        style: {
          ...naturalSizeStyle, 
          borderRight: "2px",
          height: "100%",
          borderRightStyle: "solid", 
          backgroundColor: "lightgray", 
          overflow: "visible"
        }
      }
    );
  }

  render() {
    // return text("Foo");
    // logMark("build demo")
    return applicationMenuFrame({
      appplicationMenu: this.buildMenu(),
      applicationContent: this.choosen,
      topPanelContent: [filler(), text("by Robert Renbris")],
      // topPanelContent: [filler({key: "filler"}), text("by Robert Renbris", {key: "name"})],
      bounds: this.bounds
    })
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startDemo() {
  new DOMRenderContext(document.getElementById("root")).render(
    new Demo()
  );
}
