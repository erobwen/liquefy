import { Component } from "@liquefy/flow.core";
import { text } from "@liquefy/flow.DOM";

import { row, rowStyle, filler, middle, cardShadow4 } from "@liquefy/basic-ui";
import { buttonIcon, cardColumn } from "./components"


/**
 * Dialogue
 */
export const dialogue = (...parameters) => {
  return new ModernDialogue(...parameters);
}

// Note: Had to prefix name with Modern so that pattern matching wont match it with basic dialogue. How to prevent? 
export class ModernDialogue extends Component {
  receive({close, children, style, title, variant="filled"}) {
    console.log("material dialogue receive", {close, children, style, title, variant});
    this.close = close;
    this.children = children;
    this.style = {
      ...{
        gap: 10,
        boxShadow: cardShadow4, 
        padding: 0, 
        pointerEvents: "auto"
      }, 
      ...style
    };
    this.title = title;
    this.variant = variant;
  }

  initialize() { // TODO: we get two calls to on-establish calls here, but not any longer. How to investigate? 
    this.isFullScreen = false; // This will be set by parent during render, but not recieved upon construction. 
  } 

  getTopBar() {
    const {isFullScreen, title, close} = this;
    if (isFullScreen) {
       return row(
        buttonIcon({icon: "arrow_back", onClick: () => close(), style: {width: 64, height: 64}}), 
        filler(title ? middle(text(title), {style: {marginLeft: 10, color: "white"}}) : null, {style: rowStyle}),
        {
          style: {height: 64}
        }
      );
    } else {
      return row(
        filler(title ? middle(text(title), {style: {marginLeft: 10, color: "white"}}) : null, {style: rowStyle}),
        buttonIcon({icon: "close", onClick: () => close()}), {
          style:{
            height: 48 
          }
        }
      );
    }
  }

  render() {
    const {children, style, variant} = this; 
    return (
      cardColumn("dialogue",
        this.getTopBar(),
        children,
        {
          variant,
          style
        }
      )
    );
  }
}
