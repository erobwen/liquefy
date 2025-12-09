import { Component } from "@liquefy/flow.core";
import { div } from "./HTMLTags";

/**
 * Dialogue
 */
export const flipAnimator = (...parameters) => {
  return new FlipAnimator(...parameters);
}

export class FlipAnimator extends Component {
  setProperties({children, style}) {
    this.children = children;
    this.style = style;
  }

  initialize() {} 

  build() {
    const {children, style} = this; 
    return (
      div("flip-animator",
        children,
        {
          style
        }
      )
    );
  }
}
