import { findImplicitChildrenAndOnClick, getFlowProperties, Component } from "@liquefy/flow.core";
import { text, div, label, fieldset, legend, span, input } from "@liquefy/flow.DOM";

import { adjustLightness, grayColor } from "./Color";
import { getInputFieldProperties } from "@liquefy/basic-ui";

const log = console.log; 

export function textInput(...arglist) { 
  const properties = getInputFieldProperties(arglist);
  console.log(properties);
  return new TextInput(properties);
};

export class TextInput extends Component {

  setProperties({
    style={}
  }) {
    this.style = style;
  }

  setState() {
    // this.ensure(() => {
    //   const pannel = this.findChild("button").domNode;
    //   if (pannel !== this.eventListenersDomNode) {
    //     this.eventListenersDomNode = pannel;
    //     this.clearEventListeners();
    //     this.setEventListeners();
    //   }
    // });

    this.ensure(() => {
    });
  }

  onDispose() {
    this.clearEventListeners();
  }

  clearEventListeners() {}

  setEventListeners() {}
  
  build() {
    const { labelText } = this;

    return div(
      label(labelText), 
      div(
        input({attributes: {type: "text", ariaInvalid: false}}),
        fieldset(
          legend(
            span()
          )
        )
      )
    )
  }
}
