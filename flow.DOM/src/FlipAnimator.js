import { configuration } from "@liquefy/flow.core";
import { Component } from "@liquefy/flow.core";
import { div } from "./HTMLTags";
import { previousComponentChanges, componentChanges, onFinishRenderingComponents, onFinishReBuildingDOM, newComponentChanges } from "./DOMAnimation";
import { getDomRenderTargets } from "./DOMRenderTarget";

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

  initialize() {
    configuration.onFinishRenderingComponentsCallbacks.push(onFinishRenderingComponents);
    configuration.onFinishReBuildingDOMCallbacks.push(onFinishReBuildingDOM);
  } 


  resetDOMAnimation() {
    Object.assign(componentChanges, newComponentChanges());
    previousComponentChanges = {}
    counter = 0;
    getDomRenderTargets().length = 0;
  }

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
