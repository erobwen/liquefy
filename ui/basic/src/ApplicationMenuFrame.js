import { Component, getFlowProperties, log, logMark } from "@liquefy/flow.core"

import { button } from "./BasicWidgets";
import { icon } from "./Icons";
import { centerMiddle, column, filler, fillerStyle, fitContainerStyle, layoutBorderStyle, row, rowStyle } from "./Layout";
import { modal, modalFrame } from "./Modal";


export function applicationMenuFrame(...parameters) {
  return new ApplicationMenuFrame(getFlowProperties(parameters));
}

class ApplicationMenuFrame extends Component {
  setProperties({appplicationMenu, applicationContent, topPanelContent, bounds}) {
    this.appplicationMenu = appplicationMenu;
    this.applicationContent = applicationContent;
    this.topPanelContent = topPanelContent;
    this.bounds = bounds; 
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

    const modalButton = button("modalButton", icon("bars"), () => {});

    const topPanel = row("modalMenu",
      modalButton.show(menuIsModal),
      ...this.topPanelContent,      
      {style: {...layoutBorderStyle, justifyContent: "space-between"}} //, animate: flyFromTopAnimation
    );

    const overflowVisibleStyle = this.applicationContent.usesExternalAnimations ? { overflow: "visible"} : null;

    const leftPanel = column("leftMenu", 
      this.appplicationMenu,
      // text("Menu..."),
      {style: {...layoutBorderStyle, ...overflowVisibleStyle}} //, animate: flyFromLeftAnimation
    );

    return modalFrame("row",
      leftPanel.show(!menuIsModal),
      column("column",
        topPanel,
        filler(this.applicationContent, {style: overflowVisibleStyle}),
        // centerMiddle("content", toggleButton,{style: fillerStyle}),
        {style: {...fillerStyle, ...overflowVisibleStyle}}
      ),
      {style: {...rowStyle, ...fitContainerStyle}}
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