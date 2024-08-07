import { findImplicitChildrenAndOnClick, getFlowProperties, Component } from "@liquefy/flow.core";
import { button } from "@liquefy/basic-ui";

import { adjustLightness, grayColor } from "./Color";

const log = console.log; 

export function input(...parameters) { 
  const properties = getFlowProperties(parameters);
  return new ModernButton(properties);
};

export class Input extends Component {

  setProperties({
    style={}
  }) {
    this.style = style;
  }

  setState() {
    this.hover = false;
    this.ensure(() => {
      const pannel = this.findChild("button").domNode;
      if (pannel !== this.eventListenersDomNode) {
        this.eventListenersDomNode = pannel;
        this.clearEventListeners();
        this.setEventListeners();
      }
    });

    this.ensure(() => {
    });
  }

  onDispose() {
    this.clearEventListeners();
  }

  clearEventListeners() {}

  setEventListeners() {}
  
  build() {
  }
}
