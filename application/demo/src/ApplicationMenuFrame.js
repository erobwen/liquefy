import { Component, toProperties, log, logMark } from "@liquefy/flow.core"
import { div } from "@liquefy/flow.DOM";

import { centerMiddle, column, filler, fillerStyle, fitContainerStyle, row, rowStyle } from "@liquefy/basic-ui";
import { modal, modalFrame, icon, zStackElementStyle, zStack, overflowVisibleStyle } from "@liquefy/basic-ui";


import { hardPaperShadow, paperShadow } from "@liquefy/modern-ui";

import { button, buttonIcon } from "@liquefy/ui-material";


export function applicationMenuFrame(...parameters) {
  return new ApplicationMenuFrame(toProperties(parameters));
}

class ApplicationMenuFrame extends Component {
  receive(properties) {
    Object.assign(this, properties)
    const {appplicationMenu, applicationContent, topPanelContent, bounds} = properties;
    this.appplicationMenu = appplicationMenu;
    this.applicationContent = applicationContent;
    this.topPanelContent = topPanelContent;
    this.bounds = bounds; 
  }

  initialize() {
    this.menuOpen = false; 
    this.menuIsModalOverride = null; 
  }

  // closeMenu() {
  //   this.menuOpen = false; 
  // }

  setApplicationContent(content) {
    this.applicationContent = content;
  } 

  buildModalMenuDrawer() {
    const background = div({
      key: "background", 
      style: {
        ...zStackElementStyle, 
        ...overflowVisibleStyle, 
        transition: "background-color 1000ms linear", 
        backgroundColor: this.backgroundColor
      }});
    const domNode = background.getPrimitive().getDomNode();

    return zStack(
      background,
      row(
        column(
          button("Close", () => this.menuOpen = false), 
          this.appplicationMenu,
          {style: {backgroundColor: "white", boxShadow: paperShadow, ...overflowVisibleStyle}, animateChildrenWhenThisAppears: true}
        ),
        filler(),
        {style: {...zStackElementStyle, ...overflowVisibleStyle, height: "100%", pointerEvents: "auto"}}
      ),
      {style: {...fitContainerStyle, ...overflowVisibleStyle}}
    )
  }


  render() {
    const menuWidth = this.appplicationMenu.dimensions().width;
    console.log(menuWidth)
    const { menuIsModalOverride } = this;
    const menuIsModal = menuIsModalOverride !== null ? menuIsModalOverride : this.bounds.width < menuWidth * 3;

    this.applicationContent.bounds = { 
      width: menuIsModal ? this.bounds.width : this.bounds.width - menuWidth, 
      height: this.bounds.height
    };

    const modalButton = centerMiddle(
      buttonIcon("modalButton", 
        () => {
          this.menuOpen = true;
        }, 
        {icon: "menu"}
      ), 
      {style: {width: "64px"}}
    );

    const topApplicationBar = row("modalMenu",
      modalButton.show(menuIsModal),
      ...this.topPanelContent,      
      {style: {height: menuIsModal ? "64px" : "32px", boxShadow: paperShadow, justifyContent: "space-between"}} //, animate: flyFromTopAnimation
    );

    const overflowVisibleStyle = this.applicationContent.usesExternalAnimations ? { overflow: "visible"} : null;
    const leftMenuDrawer = column("leftMenu", 
      this.appplicationMenu.show(!menuIsModal),
      {style: {zIndex: 2,boxShadow: paperShadow, ...overflowVisibleStyle}} //, animate: flyFromLeftAnimation
    );

    return modalFrame("modalFrame",
      leftMenuDrawer.show(!menuIsModal),
      column("column",
        topApplicationBar,
        filler(this.applicationContent, {style: {backgroundColor: "light-gray", paddingTop: "5px", paddingLeft: "5px", ...overflowVisibleStyle}}),
        // centerMiddle("content", toggleButton,{style: fillerStyle}),
        {style: {...fillerStyle, ...overflowVisibleStyle}}
      ),
      {
        modalContent: menuIsModal && this.menuOpen ? this.buildModalMenuDrawer() : null,
        style: {...rowStyle, ...fitContainerStyle}
      }
    )
  }
}


