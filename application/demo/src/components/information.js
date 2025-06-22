import { callback, Component } from "@liquefy/flow.core";
import { div, code, pre } from "@liquefy/flow.DOM";
// import hljs from 'highlight.js';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';

// Then register the languages you need
hljs.registerLanguage('javascript', javascript);

import { wrapper, overlay, modal, dialogue, fitContainerStyle } from "@liquefy/basic-ui";
import { numberInputField, button, cardColumn, buttonIcon } from "@liquefy/themed-ui";

export function informationButton(...parameters) {
  return new InformationButton(...parameters)
}

export class InformationButton extends Component {
  render() {
    return buttonIcon(
      {icon: "information", style: {color: "blue"}}, 
      () => { this.open = true } 
    ) 
  }
}

export function displayCodeButton(...parameters) {
  return new DisplayCodeButton(...parameters)
}

export class DisplayCodeButton extends Component {
  receive({code}) {
    this.code = code;
  }

  initialize() {
    this.open = false;
  }

  //   this.content = div(this.code)

  //   this.visibleOnFrame = null;

  //   this.ensure(() => {
  //     if (this.open && this.isVisible) {
  //       // Try to show
  //       const overlayFrame = this.inherit("overlayFrame");
  //       if (overlayFrame) {
  //         this.visibleOnFrame = overlayFrame;
  //         overlayFrame.showOverlay(this.content);
  //       }
  //     } else {
  //       // Try to hide
  //       this.visibleOnFrame.hideOverlay(this.content);
  //       this.visibleOnFrame = null;
  //     }
  //   }) 
  // }

  render() {
    const highlightedCode = hljs.highlight(
      this.code,
      { language: 'javascript' }
    ).value;
    const close = () => { this.open = false; }; // Consider: Provide/inherit instead?
    // console.log(highlightedCode);
    return wrapper(
      buttonIcon(
        {icon: "code", style: {color: "green"}}, 
        () => { this.open = true; console.log("open please... ") } 
      ),
      modal(
        dialogue(
          pre(
            code("codeBlock", 
              { 
                attributes: {
                  style: { fontSize: 14},
                  innerHTML: highlightedCode, 
                  class: "language-js hljs language-javascript"
                }
              }
            ),
            {
              style: {
                overflowX: "auto", overflowY: "auto", 
                width: 900, height: 600
              },
            }
          ),
          { close }
        ),
        { close }
      ).show(this.open)
    ) 
  }
}
  


function alert(...parameters) {
  const properties = toPropertiesWithChildren(parameters);
  const { severity, children } = properties;
  return div({children})
}