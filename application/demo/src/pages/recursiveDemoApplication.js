import { Component, model, toProperties, toPropertiesWithChildren } from "@liquefy/flow.core";
import { DOMRenderContext, text, div, ul, li, p } from "@liquefy/flow.DOM";

import { filler, fitContainerStyle, column, row, middle, portalContents } from "@liquefy/basic-ui";
import { numberInputField, button, cardColumn } from "@liquefy/themed-ui";

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
      numberInputField("Shared state", this.inherit("inheritedModel"), "value", {variant: "outlined"}),
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
        numberInputField("Local state", this, "value", {variant: "outlined", style: {"--mdui-text-field-label-floating-background": "red"}}),
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
 * Start the demo
 */  
export function startRecursiveDemo() {
  const root = new RecursiveExample();
  new DOMRenderContext(document.getElementById("root")).render(root);
}



/**
 * Top portal content
 */
const topPortalContents = (topBarPortal) =>
  portalContents("information", 
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

  
/**
 * This is a demo-application that showcases some of the principles of Flow. 
 * Please read the comments for a tour over what features exists and how they work.  
 * 
 * This simple program just demonstrates the recursive and state preserving capabilities 
 * of Flow. A number of components are created recursivley according to the "count" state.
 * And each component has its own state that can be toggled on/off. Note that the state of each individual 
 * component is maintained, while the whole recursive chain of components are re-built. 
 * Also, open and expand the view-elements debug panel in Chrome, to verify minimal updates
 * to the DOM when the UI is rebuilt.  
 */
