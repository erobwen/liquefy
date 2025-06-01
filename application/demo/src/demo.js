import { observable, Component, repeat, creators, logMark, transaction } from "@liquefy/flow.core";
import { DOMRenderContext, span, text } from "@liquefy/flow.DOM";

import { button, assignGlobalTheme } from "@liquefy/themed-ui";

import { modernTheme } from "@liquefy/modern-ui";

import { 
  layout,
  topAppBar, 
  navigationDrawer,
  layoutMain,
  list, 
  listItem, 
  materialTheme 
} from "@liquefy/ui-material";

import { basicTheme, center, checkboxInputField, fillerStyle, fitContainerStyle, middle, modalFrame } from "@liquefy/basic-ui";
import { portalExit } from "@liquefy/basic-ui";
import { column, columnStyle, filler, naturalSizeStyle, row } from "@liquefy/basic-ui";
import { svgImage, wrapper } from "@liquefy/basic-ui";

import { RecursiveExample } from "./pages/recursiveDemoApplication";
import { ReactiveForm, initialData } from "./pages/reactiveFormApplication";
import { AnimationExample } from "./pages/animationExample";
import { ProgrammaticReactiveLayout } from "./pages/programmaticReactiveLayout";
import { PortalExample } from "./pages/portalDemo";
import { ModalExample } from "./pages/modalDemo";

import flowImage from "../resources/flow.svg"

import { applicationMenuFrame } from "./ApplicationMenuFrame"

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
  
  terminate() {
    super.onDispose();
    for (let name in this.items) {
      this.items[name].onDispose();
    }
    this.leftColumnPortal.onDispose();
  }

  buildMenu() {
    const listItems = [];
    listItems.push(
      center(
        svgImage({image: flowImage}),
        {
          style: {
            height: "200px",
            backgroundColor: "white"
          }
        }
      )
    );
    for (let item of this.items) {
      listItems.push(
        listItem({
          children: [
            text(item.name)
          ], 
          onClick: () => { 
            transaction(() => {
              console.log(this.getChild("menuFrame"));
              // console.log(this)
              this.getChild("menuFrame").menuOpen = false;
              this.choosen = item;
            })
          },
          rounded: true, 
          active: this.choosen === item
        })
      )
    }
    listItems.push(this.leftColumnPortal);
    listItems.push(filler());
    listItems.push(button(
      this.selectedTheme === basicTheme ? "Material Theme" : "Basic Theme", 
      () => {
        this.selectedTheme = (this.selectedTheme === basicTheme) ? materialTheme : basicTheme
        assignGlobalTheme(
          this.selectedTheme
        )
      } 
    ));

    return column(
      listItems,
      {
        key: "left-column", 
        style: {
          ...columnStyle,
          // ...naturalSizeStyle, only in X direction!
          ...fillerStyle,
          height: "100%",
          width: "270px",
          overflow: "visible"
        }
      }
    );
  }

  render() {
    // return div("foobar");
    return applicationMenuFrame(
      "menuFrame", {
        appplicationMenu: this.buildMenu(),
        applicationContent: this.choosen,
        topPanelContent: [filler(), middle(text("by Robert Renbris"))],
        bounds: this.bounds
      }
    )

    // const mainBounds = {
    //   width: (this.bounds.width <= 855) ? this.bounds.width : this.bounds.width - 300,
    //   height: this.bounds.height - 64  
    // }
    // console.log(mainBounds);
    // this.choosen.bounds = mainBounds;
    // return modalFrame(
    //   layout(
    //     topAppBar(filler(), text("by Robert Renbris"), {style: {color: "white", backgroundColor: "rgb(var(--mdui-color-primary))"}}),
    //     navigationDrawer(this.buildMenu(), {open: true, style: {}}),
    //     layoutMain(this.choosen),          
    //     {
    //       style: fitContainerStyle
    //     }
    //   ), 
    //   {
    //     style: fitContainerStyle
    //   },
    // )

  }
}


/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startDemo() {
  new DOMRenderContext(document.getElementById("application")).render(
    new Demo()
  );
}
