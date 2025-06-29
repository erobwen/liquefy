import { callback, Component } from "@liquefy/flow.core";
import { div, code, pre } from "@liquefy/flow.DOM";
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';

import { alert, cardShadow3, popover } from "@liquefy/basic-ui";
import { wrapper, overlay, modal, dialogue, fitContainerStyle } from "@liquefy/basic-ui";

import { numberInputField, button, cardColumn, buttonIcon } from "@liquefy/themed-ui";

hljs.registerLanguage('javascript', javascript);

export function informationButton(...parameters) {
  return new InformationButton(...parameters)
}

export class InformationButton extends Component {
  receive({children}) {
    this.children = children;
  }

  initialize() {
    this.open = false;
  }

  render() {
    const button = buttonIcon("button",
      {icon: "info", style: {color: "blue"}}, 
      () => { this.open = true } 
    )
    return wrapper(
      popover(
        alert(this.children, {severity: "info", style: {boxShadow: cardShadow3}}), 
        { 
          direction: "bottom", 
          reference: button,
          close: () => { this.open = false }  
        }
      ).show(this.open),
      button 
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

  render() {
    const highlightedCode = hljs.highlight(
      this.code,
      { language: 'javascript' }
    ).value;
    const close = () => { this.open = false; }; // Consider: Provide/inherit instead?
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
  

