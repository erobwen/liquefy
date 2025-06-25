import { Component, toProperties, log, logMark } from "@liquefy/flow.core"
import { div, text } from "@liquefy/flow.DOM";

import { centerMiddle, column, filler, fillerStyle, fitContainerStyle, row, rowStyle } from "@liquefy/basic-ui";
import { overlayFrame, icon, zStackElementStyle, zStack, overflowVisibleStyle } from "@liquefy/basic-ui";

import { cardShadow } from "@liquefy/modern-ui";
import { button, buttonIcon } from "@liquefy/ui-material";


export function applicationMenuFrame(...parameters) {
  return new ApplicationMenuFrame(toProperties(parameters));
}

class ApplicationMenuFrame extends Component {
  receive({appplicationMenu, applicationContent, topPanelContent, bounds}) {
    this.appplicationMenu = appplicationMenu;
    this.applicationContent = applicationContent;
    this.topPanelContent = topPanelContent;
    this.bounds = bounds; 
  }

  initialize() {
    this.menuOpen = false; 
    this.menuIsModalOverride = null; 
    this.modalButton = centerMiddle(
      buttonIcon("modalButton", 
        () => {
          this.menuOpen = !this.menuOpen;
        }, 
        {icon: "menu"}
      ), 
      {style: {width: "64px"}}
    ).onEstablish()
  }

  terminate() {
    this.modalButton.onDispose();
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
      onClick: () => this.menuOpen = false, 
      style: {
        ...zStackElementStyle, 
        ...overflowVisibleStyle,
        pointerEvents: "auto",
        transition: "background-color 1000ms linear", 
        backgroundColor: "rgba(0, 0, 0, 0.2)"
      }});
    const domNode = background.getPrimitive().getDomNode();

    return zStack(
      background,
      row(
        column(
          centerMiddle(this.modalButton, {style: {height: "64px", width: "64px"}}),
          this.appplicationMenu,
          {style: {backgroundColor: "white", boxShadow: cardShadow, pointerEvents: "auto", ...overflowVisibleStyle}, animateChildrenWhenThisAppears: true}
        ),
        filler(),
        {style: {...zStackElementStyle, ...overflowVisibleStyle, height: "100%"}}
      ),
      {style: {...fitContainerStyle, ...overflowVisibleStyle}}
    )
  }


  render() {
    // console.log("RENDER");
    // console.log(this)
    const menuWidth = this.appplicationMenu.dimensions().width;

    // console.log("ApplicationMenuFrame.bounds");
    // console.log(this.bounds);
    // console.log(menuWidth);

    const { menuIsModalOverride } = this;
    const menuIsModal = menuIsModalOverride !== null ? menuIsModalOverride : this.bounds.width < menuWidth * 3;

    const overflowVisibleStyle = this.applicationContent.usesExternalAnimations ? { overflow: "visible"} : null;
    const leftMenuDrawer = column("leftMenu", 
      this.appplicationMenu.show(!menuIsModal),
      {style: {zIndex: 2,boxShadow: cardShadow, ...overflowVisibleStyle}} //, animate: flyFromLeftAnimation
    );

    const topApplicationBar = row("modalMenu",
      this.modalButton.show(menuIsModal && !this.menuOpen),
      ...this.topPanelContent,      
      {style: {height: menuIsModal ? "64px" : "40px", boxShadow: cardShadow, justifyContent: "space-between"}} //, animate: flyFromTopAnimation
    );

    this.applicationContent.bounds = { 
      width: menuIsModal ? this.bounds.width : this.bounds.width - menuWidth - 10, 
      height: this.bounds.height - topApplicationBar.dimensions().height - 5
    };

    return overlayFrame("overlayFrame",
      leftMenuDrawer.show(!menuIsModal),
      column("column",
        topApplicationBar,
        filler(this.applicationContent, {style: {backgroundColor: "light-gray", paddingTop: 5, paddingLeft: 5, paddingRight: 5, ...overflowVisibleStyle}}),
        // centerMiddle("content", toggleButton,{style: fillerStyle}),
        {style: {...fillerStyle, ...overflowVisibleStyle}}
      ),
      {
        overlayContent: this.menuOpen && menuIsModal ? this.buildModalMenuDrawer() : null,
        style: {...rowStyle, ...fitContainerStyle}
      }
    )
  }
}


