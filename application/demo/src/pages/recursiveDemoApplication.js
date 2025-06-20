import { Component, model, toProperties, toPropertiesWithChildren } from "@liquefy/flow.core";
import { DOMRenderContext, text, div, ul, li, p } from "@liquefy/flow.DOM";

import { filler, fitContainerStyle, column, row } from "@liquefy/basic-ui";
import { numberInputField, button, cardColumn } from "@liquefy/themed-ui";

import { informationButton, displayCodeButton } from "../components/information";

import file from './reactiveFormApplication?raw';

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
export class RecursiveExample extends Component {
  
  // Constructor: Normally do not override constructor!!! (unless modifying the framework itself)

  // Set properties from parent, suitable for default values etc.
  receive(properties) {
    Object.assign(this, properties)
  }

  // Create state, create model data and initilize external resources
  initialize() {
    this.count = 1
    this.myModel = model({
      value: 42 
    });
  }

  // Release external resources
  terminate() {}
  
  // Allow children to inherit data from this component 
  provide() {
    return {
      myModel: this.myModel
    };
  }

  // Build is run reactivley on any change, either in the model or in the view model. It reads data from anywhere in the model or view model, and the system automatically infers all dependencies.
  render() {
    return (
      column(
        "recursive column",
        new ControlRow("control-row", {demoComponent: this}),
        new List("root-list", {
          maxCount: this.count, 
          count: 1
        }),
        filler(),
        { style: fitContainerStyle }
      )
    );
  }
}

function alert(...parameters) {
  const properties = toPropertiesWithChildren(parameters);
  const { severity, children } = properties;
  return div({children})
}
  
export const controlRow = (...parameters) => 
  new ControlRow(...parameters);

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
      numberInputField("Shared state", this.inherit("myModel"), "value", {variant: "outlined"}),
      filler(),
      informationButton(
        column(
          p("A change of 'Depth' or 'Shared state' forces a rebiuld of all components in the hierarchy."),
          ul(
            li(" - Stable component identity and local state is demonstrated."), 
            li(" - Minimal DOM node updates is demonstrated (watch element vierw in debugger).")
          )
        )
      ),
      displayCodeButton({code: file}),
      {style: {padding: "10px", gap: "20px", alignItems: "baseline"}} // Reactive programmatic styling! 
    )
  }
}

export class List extends Component {
  // This is the function setProperties where you declare all properties that a parent can set on its child. This is optional, but is a good place to define default values, modify values given by parent, or document what properties that the component needs.   
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
      style: {
        gap: 10,
        marginLeft: 10, 
        marginBottom: 2, 
        marginRight: 2, 
        boxShadow: "var(--mdui-elevation-level3)",
        // backgroundColor: "rgb(var(--mdui-color-surface-container-highest))"
      }, 
      children
    });
  }
}

export class Item extends Component {
  receive({depth}) {
    this.depth = depth;
  }
  
  initialize() {
    // This is the place to define view model variables. In this case the "on" property is defined.
    this.value = 42;
  }
 
  render() {
    const me = this; 

    return row("item-row",  // row is a primitive flow that can be converted into a DOM element by the DomRenderContext module. However, a 1:1 mapping to HTML can also be possible, by using a Div flow for example. 
      text({ key: "item-text", text: "Depth " +  me.depth}),
      numberInputField("Local state", this, "value", {variant: "outlined", style: {"--mdui-text-field-label-floating-background": "red"}}),
      text(" Shared state: " + me.inherit("myModel").value, {}), 
      {
        style: {gap: "20px", alignItems: "baseline", overflow: "visible"},
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

  // Emulated user interaction.
  // console.log(root.getChild("control-row").getChild("more-button"));
  // console.log(root.getChild("control-row"));
  // root.getChild("control-row").getChild("more-button").onClick();
  // root.findChild("more-button").onClick();
  // root.findChild("more-button").onClick();
  // root.findChild("more-button").onClick();
}
