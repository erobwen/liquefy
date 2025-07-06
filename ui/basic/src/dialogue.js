import { Component } from "@liquefy/flow.core";
import { text } from "@liquefy/flow.DOM";

import { row, rowStyle, filler, middle } from "./Layout";
import { buttonIcon } from "./buttons"
import { cardColumn, cardShadow4 } from "./card";


/**
 * Dialogue
 */
export const dialogue = (...parameters) => {
  return new Dialogue(...parameters);
}

export class Dialogue extends Component {
  receive({close, children, style, title, variant="filled"}) {
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
        buttonIcon({icon: "close", onClick: () => close()})
      );
    }
  }

  render() {
    // console.log("basic dialogue render", {children: this.children, style: this.style, variant: this.variant});
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
