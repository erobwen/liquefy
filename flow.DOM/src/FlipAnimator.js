import { configuration } from "@liquefy/flow.core";
import { Component } from "@liquefy/flow.core";
import { div } from "./HTMLTags";
import { onFinishRenderingComponents, onFinishReBuildingDOM } from "./DOMAnimation";

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
