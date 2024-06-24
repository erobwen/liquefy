import { flyFromLeftAnimation, flyFromTopAnimation } from "../../flow.DOMTarget/FlyDOMNodeAnimation";
import { Component } from "../../flow/Flow"
import { readFlowProperties } from "../../flow/flowParameters";
import { log, logMark } from "../../flow/utility";
import { button, text } from "./BasicWidgets";
import { icon } from "./Icons";
import { centerMiddle, column, filler, fillerStyle, layoutBorderStyle, row } from "./Layout";
import { animatedContainerStyle } from "../modern/Style"
import { modal, modalFrame } from "./Modal";


export function applicationMenuFrame(...parameters) {
  return new ApplicationMenuFrame(readFlowProperties(parameters));
}

class ApplicationMenuFrame extends Component {
  setProperties({appplicationMenu, applicationContent, topPanelContent}) {
    this.appplicationMenu = appplicationMenu;
    this.applicationContent = applicationContent;
    this.topPanelContent = topPanelContent;
  }

  setState() {
    this.menuOpen = false; 
    this.menuIsModalOverride = null; 
  }

  setApplicationContent(content) {
    this.applicationContent = content;
  } 

  build() {
    // logMark("build menu frame");
    // log(this.appplicationMenu)
    // log(this.topPanelContent)
    // log(this.appplicationMenu.getDomNode())
    // log(this.appplicationMenu.dimensions())
    const menuWidth = this.appplicationMenu.dimensions().width;
    // log("menuWidth " + menuWidth);
    // log("width " + this.bounds.width);
    const { menuIsModalOverride } = this;
    const menuIsModal = menuIsModalOverride !== null ? menuIsModalOverride : this.bounds.width < menuWidth * 3;
    // log(menuIsModal);

    this.applicationContent.bounds = { 
      width: menuIsModal ? this.bounds.width : this.bounds.width - menuWidth, 
      height: this.bounds.height
    };
    // if (menuIsModal) return text("Foo");

    // return centerMiddle(
    //   menuIsModal ? text("modal", "Modal") : text("nonmodal", "Non modal")
    // );
    
    // const toggleButton = button(menuIsModal ? "To Modal" : "To Nonmodal", () => this.menuIsModalOverride = !this.menuIsModalOverride);
    // return centerMiddle(toggleButton);

    const modalButton = button("modalButton", icon("bars"));

    const topPanel = row("modalMenu",
      modalButton.show(menuIsModal),
      ...this.topPanelContent,      
      {style: {...layoutBorderStyle, justifyContent: "space-between"}} //, animate: flyFromTopAnimation
    );

    const leftPanel = column("leftMenu", 
      this.appplicationMenu,
      // text("Menu..."),
      {style: {...layoutBorderStyle, ...animatedContainerStyle}} //, animate: flyFromLeftAnimation
    );

    // const animatedContainerStyle = {};

    return row("a",
      leftPanel.show(!menuIsModal),
      column("d",
        topPanel,
        this.applicationContent,
        // centerMiddle("content", toggleButton,{style: fillerStyle}),
        {style: {...fillerStyle, ...layoutBorderStyle, ...animatedContainerStyle}}
      ),
      {style: {...fillerStyle, ...layoutBorderStyle, ...animatedContainerStyle}}
    )


    return column("a",
      topPanel.show(menuIsModal),
      row("b",
        leftPanel.show(!menuIsModal),
        column(
          "d",
          leftSupportMenu.show(!menuIsModal),
          centerMiddle("content", toggleButton,{style: fillerStyle}),
          {style: {...fillerStyle, ...layoutBorderStyle}}
        ),
        {style: {...fillerStyle, ...layoutBorderStyle}}
      )
    );
    if (menuIsModal) {
      return column(
        centerMiddle(
          // toggleButton,
          topPanel,
          // text("Menu...x", {animate: flyFromTopAnimation}),
          {style: layoutBorderStyle}
        ),
        filler()
      );
    } else {
      return row(
        centerMiddle(
          // toggleButton,
          leftPanel,
          // text("Menu...x", {animate: flyFromLeftAnimation}),
          {style: layoutBorderStyle}
        ),
        filler()
      );
    }



    // return modalFrame( 
    //   (menuIsModal) ? 
    //     column(
    //       button("Menu", () => {this.menuOpen = true;}),
    //       modal(this.appplicationMenu).show(this.menuOpen),
    //       this.applicationContent, 
    //       {style: {width: "100%", overflow: "visible"}}
    //     )
    //     :
    //     row(
    //       this.appplicationMenu, 
    //       this.applicationContent, 
    //       {style: {height: "100%", overflow: "visible"}}
    //     )
    // )
  }
}