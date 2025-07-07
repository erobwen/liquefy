import { Component } from "@liquefy/flow.core";
import { p, DOMRenderContext } from "@liquefy/flow.DOM";
import { alert } from "@liquefy/themed-ui";

import { filler, wrapper, column, row, layoutBorderStyle, portalContents, cardShadow3, popover } from "@liquefy/basic-ui";
import { buttonIcon } from "@liquefy/ui-material";

import { displayCodeButton } from "../components/information";

import file from './toolbarEllipsisDemo?raw';


/**
 * Toolbar Ellipsis Demo
 */
export class ToolbarEllipsisDemo extends Component {
  
  receive({ style, bounds, topBarPortal }) {
    this.name = "Toolbar Ellipsis"; 
    this.topBarPortal = topBarPortal;
    this.bounds = bounds; 
    this.style = style;
  } 


  render() {
    const { topBarPortal, bounds, style } = this;

    return column(
      topPortalContents(topBarPortal),
      wrapper(informationPanel()),
      filler(),
      new EllipsisToolbar({bounds}),
      { style: { ...style, backgroundColor: "silver"} }
    );
  }
}


/**
 * Ellipsis Toolbar
 */
export class EllipsisToolbar extends Component {
  initialize() {
    this.menuOpen = false;
  }

  render() {
    // Create an array of mock tools
    const toolIcons = ["search", "home", "settings", "star", "key", "bolt"];
    let toolCount = 0;
    const totalTools = 20;
    const tools = [];
    while (toolCount++ < totalTools) {
      tools.push(buttonIcon("toolButton" + toolCount,
        () => { console.log("pushed tool"); },
        { icon: toolIcons[toolCount % toolIcons.length], style: { width: "40px" } }
      ));
    }

    // Create ellipsis button
    const menuButton = buttonIcon("menuButton",
      () => { this.menuOpen = true; },
      { icon: "more_horiz", style: { width: "40px" } }
    );

    // Split tools between toolbar and poup menu
    let toolbarWidthLeft = this.bounds.width;
    const toolbarContents = [];
    const popupMenuContents = [];
    let index = 0;
    for (const tool of tools) {
      const isLast = index === tools.length - 1;

      const widgetWidth = tool.dimensions().width;
      const ellipsisButtonWidth = menuButton.dimensions().width;
      const neededElipsisButtonWidth = isLast ? 0 : ellipsisButtonWidth; 
      if (widgetWidth + neededElipsisButtonWidth <= toolbarWidthLeft) {
        toolbarContents.push(tool);
        toolbarWidthLeft -= widgetWidth;
      } else {
        if (toolbarContents[toolbarContents.length - 1] !== menuButton) {
          toolbarContents.push(menuButton);
          toolbarWidthLeft -= ellipsisButtonWidth
        }
        popupMenuContents.push(tool);
      }

      index++;
    }

    // Toolbar / popup assembly
    return row(
      toolbarContents,
      popover("extraToolbarMenu",
        row("extraMenu", popupMenuContents, { style: { backgroundColor: "#fef7ff", boxShadow: cardShadow3, ...layoutBorderStyle } }),
        {
          bounds: this.bounds,
          reference: menuButton,
          close: () => { this.menuOpen = false; }, 
        }
      ).show(this.menuOpen),
      { style: { ...layoutBorderStyle, boxShadow: cardShadow3, marginBottom: 100, backgroundColor: "#fef7ff" } }
    );
  }
}


/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startToolbarEllipsisDemo() {
  new DOMRenderContext(document.getElementById("root")).render(
    new ToolbarEllipsisDemo()
  );
}


/**
 * Top portal content
 */
const topPortalContents = (topBarPortal) =>
  portalContents("toolbarEllipsisDemoInformation",
    displayCodeButton({code: file, fileName: "src/pages/toolbarEllipsisDemo.js"}),
    {
      portal: topBarPortal
    }
  )


/**
 * Information panel
 */  
function informationPanel() {
  return alert(
    column(
      p("Demonstrates the power of programmatic responsiveness. We can here see how a toolbar can adapt to the available space, and how it can show an ellipsis menu when there is not enough space for all tools."),
      p("This is not something that you would typically do with .css, container queries and breakpoints. If you ask AI to design this, it will give you a Javascript solution."),
      { style: { width: 800, whiteSpace: "normal" } }
    ),
    {
      severity: "info",
      style: { margin: 10 }
    }
  );
}
