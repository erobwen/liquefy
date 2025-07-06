import { Component, model, toProperties, toPropertiesWithChildren } from "@liquefy/flow.core";
import { DOMRenderContext, text, div, ul, li, p } from "@liquefy/flow.DOM";

import { filler, fitContainerStyle, column, row, middle, portalContents } from "@liquefy/basic-ui";
import { numberInput, button, cardColumn } from "@liquefy/themed-ui";

import { informationButton, displayCodeButton } from "../components/information";

import file from './recursiveDemoApplication?raw';

export class RecursiveExample extends Component {
  
  receive({style, topBarPortal}) {
    this.name = "Recursive Components"
    this.topBarPortal = topBarPortal;
    this.style = style; 
  }

  initialize() {
    this.count = 1
    this.inheritedModel = model({
      value: 42 
    });
  }

  provide() {
    return {
      inheritedModel: this.inheritedModel
    };
  }

  render() {
    const { style, count, topBarPortal } = this; 
    return (
      column("recursiveColumn",
        new ControlRow("controlRow", {demoComponent: this}),
        new List("rootList", {
          maxCount: count, 
          count: 1
        }),
        filler(),
        topPortalContents(topBarPortal),
        { style }
      )
    );
  }
} 

export class ControlRow extends Component {
  receive({demoComponent}) {
      this.demoComponent = demoComponent;
  }
      
  render() {
    return row(
      text("Recursive Structure"),
      row(
        button("More", () => { this.demoComponent.count++ }), 
        button("Less", () => {this.demoComponent.count--}),
        {style: {alignItems: "baseline", gap: 5}}
      ),
      numberInput("Shared state", this.inherit("inheritedModel"), "value", {variant: "outlined", style: {height: 40}}),
      filler(),
      {style: {padding: 10, gap: 20, alignItems: "baseline"}} 
    )
  }
}

export class List extends Component {
  receive({maxCount, count}) {
    this.maxCount = maxCount;
    this.count = count;
  }

  render() {
    const children = [];
    children.push(new Item("first-item", {depth: this.count}));
    if (this.count < this.maxCount) {
      children.push(new List("rest-list", {maxCount: this.maxCount, count: this.count + 1}));
    }
    return cardColumn("list-column", {
      variant: "outlined",
      style: { gap: 10, marginLeft: 10, marginBottom: 2, marginRight: 2, boxShadow: "var(--mdui-elevation-level3)" }, 
      // backgroundColor: "rgb(var(--mdui-color-surface-container-highest))"
      children
    });
  }
}

export class Item extends Component {
  receive({depth}) {
    this.depth = depth;
  }
  
  initialize() {
    this.value = 42;
  }
 
  render() {
    const me = this; 

    return row("itemRow",
      text({key: "depthText", text: "Depth " +  me.depth}),
      middle(
        numberInput("Local state", this, "value", {variant: "outlined", style: {"--mdui-text-field-label-floating-background": "red", height: 40}}),
        {style: {overflow: "visible"}}
      ),
      text({key: "sharedStateText", text: " Shared state: " + me.inherit("inheritedModel").value}), 
      {
        style: {gap: 20, alignItems: "stretch", overflow: "visible", lineHeight: 40},
      }
    );
  }
}


/**
 * Start as standalone (useful for reactive debugging etc.)
 */ 
export function startRecursiveDemo() {
  const root = new RecursiveExample();
  new DOMRenderContext(document.getElementById("root")).render(root);
}


/**
 * Top portal content
 */
const topPortalContents = (topBarPortal) =>
  portalContents("recursiveDemoInformation", 
    informationButton(
      column(
        p("A simple recursive example, that demonstrates:"),
        ul(
          li("Minimal updates of the DOM while changes in depth forces complete re-render of all components (open debug console to see DOM elements flash upon change).  "), 
          li("Stable component identity during rebuild, allowing for the preservation of local state."),
          li("Component hierarchy inheritance, where all components inherit the same shared model.")
        ),
        { style: {width: 800, whiteSpace: "normal"}}
      )
    ),
    displayCodeButton({code: file, fileName: "src/pages/recursiveDemoApplication.js"}),
    {
      portal: topBarPortal
    }
  )
