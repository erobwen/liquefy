import { callback, Component } from "@liquefy/flow.core";
import { div, code, pre } from "@liquefy/flow.DOM";
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';

import { cardShadow3, fillerStyle, modalContainer, popover } from "@liquefy/basic-ui";
import { wrapper, overlay, fitContainerStyle } from "@liquefy/basic-ui";

import { dialogue, buttonIcon, alert, cardColumn, card } from "@liquefy/themed-ui";

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
  receive({code, fileName}) {
    this.code = code;
    this.fileName = fileName; 
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
        () => { this.open = true; } 
      ),
      modalContainer({
        dialogue, 
        dialogueProperties: {
          title: this.fileName,
          children: pre(
            code("codeBlock", 
              { 
                attributes: {
                  style: { 
                    overflow: "hidden",
                    fontSize: 14, 
                    padding: 15, 
                    whiteSpace: "pre", 
                    display: "inline-block"
                  },
                  innerHTML: highlightedCode, 
                  class: "language-js hljs language-javascript",
                }
              }
            ),
            {
              style: {
                ...fillerStyle, // Consider: How to inject this by container?
                overflow: "auto", 
                margin: 0,
              },
            }
          ), 
          style: {
            maxWidth: 1000,
            minWidth: 700,
            height: "80%",
            width: "80%", 
          }
        },
        fullScreenTreshold: 900, 
        close 
      }).show(this.open)
    ) 
  }
}
  

export function codeDisplay(...parameters) {
  return new CodeDisplay(...parameters);
}

export class CodeDisplay extends Component {
  receive({code, style}) {
    this.code = code;
    this.style = style; 
  }

  render() {
    const { style } = this;

    const highlightedCode = hljs.highlight(
      this.code,
      { language: 'javascript' }
    ).value;

    return card(
      code("codeBlock", 
        { 
          attributes: {
            style: { 
              overflow: "hidden",
              fontSize: 14, 
              padding: 15, 
              whiteSpace: "pre", 
              display: "inline-block"
            },
            innerHTML: highlightedCode, 
            class: "language-js hljs language-javascript",
          }
        }
      ),
      {
        style: {
          whiteSpace: "pre",
          ...fillerStyle, // Consider: How to inject this by container?
          overflow: "auto", 
          margin: 0, 
          ...style, // Allow to override the style.
        },
      }
    )
  }
}
