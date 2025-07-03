import { Component, logMark, transaction } from "@liquefy/flow.core";
import { DOMRenderContext, text, p, ul, li, div } from "@liquefy/flow.DOM";

import { button, assignGlobalTheme, listItem } from "@liquefy/themed-ui";

import { 
  materialTheme 
} from "@liquefy/ui-material";

import { basicTheme, center, fillerStyle, fitContainerStyle, middle, row, rowStyle } from "@liquefy/basic-ui";
import { portal } from "@liquefy/basic-ui";
import { column, columnStyle, filler } from "@liquefy/basic-ui";
import { svgImage, wrapper } from "@liquefy/basic-ui";

import { RecursiveExample } from "./pages/recursiveDemoApplication";
import { ReactiveForm, initialData } from "./pages/reactiveFormApplication";
import { AnimationExample } from "./pages/animationExample";
import { ProgrammaticReactiveLayout } from "./pages/programmaticReactiveLayout";
import { PortalExample } from "./pages/portalDemo";
import { ModalExample } from "./pages/modalDemo";

import flowImage from "../public/flow.svg"

import { applicationMenuFrame } from "./ApplicationMenuFrame"
import { IntroductionPage } from "./pages/introductionPage";
import { informationButton } from "./components/information";



/**
 * Demo
 */
export class Demo extends Component {

  receive({bounds, path}) {
    this.bounds = bounds;
    this.path = path; 
  }

  initialize() {
    const { bounds, path } = this; 
    this.selectedTheme = materialTheme;
    assignGlobalTheme(this.selectedTheme);

    this.leftColumnPortal = portal({key: "portal", style: {...columnStyle, overflow: "visible"}});
    this.topBarPortal = portal("topBarPortal", {style: {...rowStyle, alignItems: "center"}});

    this.introduction = new IntroductionPage("introductionPage", {topBarPortal: this.topBarPortal});

    // Example of building static child-flow components in the setState. Remember to add them to onEstablish/onDispose
    this.items = [
      new RecursiveExample({key: "recursive-demo", style: fitContainerStyle, topBarPortal: this.topBarPortal}),
      new ReactiveForm({key: "reactive-form", initialData, style: fitContainerStyle}),
      new AnimationExample({key: "animation-example", items: ["Foo", "Fie", "Fum", "Bar", "Foobar", "Fiebar", "Fumbar"], style: fitContainerStyle}),
      new ProgrammaticReactiveLayout({key: "programmatic-reactive-layout", name: "Programmatic Responsiveness", style: fitContainerStyle}),
      new ModalExample({key: "modal-example", style: fitContainerStyle}),
      new PortalExample({key: "portal-example", portal: this.leftColumnPortal, style: fitContainerStyle})
    ];
    
    for (let item of this.items) {
      item.onEstablish();
    }

    // if (path)

    // this.chosen = this.introduction;
    // this.chosen = this.items.find(item => item.key === "recursiveDemo");
    // this.chosen = this.items.find(item => item.key === "reactiveForm");
    // this.chosen = this.items.find(item => item.key === "portalExample");
    // this.chosen = this.items.find(item => item.key === "animationExample");
    // this.chosen = this.items.find(item => item.key === "programmaticReactiveLayout");
    // this.chosen = this.items.find(item => item.key === "modalExample");
  }
  
  terminate() {
    super.onDispose();
    for (let name in this.items) {
      this.items[name].onDispose();
    }
    this.leftColumnPortal.onDispose();
  }

  chose(page) {
    // inherit base path
    // add page path
    if (page === this.introduction) {
      window.history.pushState({}, "", "/liquefy/")
    } else {
      window.history.pushState({}, "", "/liquefy/" +page.key)
    }
  }

  buildMenu(chosen) {
    const listItems = [];
    listItems.push(
      center(
        svgImage({image: flowImage}),
        {
          style: {
            cursor: "pointer",
            height: "200px",
            backgroundColor: "white"
          },
          onClick: () => { this.chose(this.introduction) }
        }
      )
    );
    for (let item of this.items) {
      listItems.push(
        listItem(`item:${item.name}`, {
          children: [
            text(item.name)
          ], 
          onClick: () => { 
            transaction(() => {
              this.getChild("menuFrame").menuOpen = false;
              this.chose(item);
            })
          },
          rounded: true, 
          active: item === chosen
        })
      )
    }
    listItems.push(this.leftColumnPortal);
    listItems.push(filler());
    listItems.push(
      row(
        button(
          this.selectedTheme === basicTheme ? "Material Theme" : "Basic Theme", 
          () => {
            this.selectedTheme = (this.selectedTheme === basicTheme) ? materialTheme : basicTheme
            assignGlobalTheme(
              this.selectedTheme
            )
          }, { style: fillerStyle}
        ),
        informationButton(
          column(
            p("This is just to showcase the possibilities of reactive component themeing:"),
            ul(
              li("Because why not? "), 
              li("When we switch theme, we not just change style of componets, we replace entire components!"),
              li("Using the service locator pattern throughout an application, means anything can be configurable!")
            ),
            { style: {width: 800}}
          )
        )
      )
    );

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
          gap: 5,
          paddingLeft: 5,
          paddingRight: 5,
          paddingBottom: 5,
          overflow: "visible"
        }
      }
    );
  }

  render() {
    // Investigate: Why is this being re-rendered by changes made from overlay-frame? It changes Demo.parentPrimitive that cause a re-render of Demo? 
    const { path } = this; 
    let chosen;
    if (this.path.length === 1) {
      chosen = this.introduction;
    } else {
      const pathFirst = path[1];
      chosen = this.items.find(item => item.key === pathFirst);
      if (chosen) { 
        chosen.receiveProperty("path", path.slice(2))
      } else {
        setTimeout(() => {
          this.chose(this.introduction); 
        })
        // return div(); 
      }
    }

    return applicationMenuFrame(
      "menuFrame", {
        appplicationMenu: this.buildMenu(chosen),
        applicationContent: chosen,
        topPanelContent: [filler(), this.topBarPortal],
        bounds: this.bounds
      }
    )

    // const mainBounds = {
    //   width: (this.bounds.width <= 855) ? this.bounds.width : this.bounds.width - 300,
    //   height: this.bounds.height - 64  
    // }
    // console.log(mainBounds);
    // this.chosen.bounds = mainBounds;
    // return overlayFrame(
    //   layout(
    //     topAppBar(filler(), text("by Robert Renbris"), {style: {color: "white", backgroundColor: "rgb(var(--mdui-color-primary))"}}),
    //     navigationDrawer(this.buildMenu(), {open: true, style: {}}),
    //     layoutMain(this.chosen),          
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
