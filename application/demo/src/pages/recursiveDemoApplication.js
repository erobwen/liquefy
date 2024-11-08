import { Component, trace, model, getFlowProperties } from "@liquefy/flow.core";
import { DOMRenderContext, text } from "@liquefy/flow.DOM";

import { numberInputField, filler } from "@liquefy/basic-ui";
import { centerMiddle, column, row, wrapper } from "@liquefy/basic-ui";
import { modal } from "@liquefy/basic-ui";
import { button, paper, paperColumn } from "@liquefy/themed-ui"

const log = console.log;
const loga = (action) => {
  if (trace) log("-----------" + action + "-----------");
}


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
  recieve(properties) {}

  // Create state, create model data and initilize external resources
  initialize() {
    this.count = 1
    this.myModel = model({
      value: 42 
    });
  }

  // Release external resources
  teardown() {}

  // Allow children to inherit data from this component 
  getContext() {
    return {
      myModel: this.myModel
    };
  }

  // Build is run reactivley on any change, either in the model or in the view model. It reads data from anywhere in the model or view model, and the system automatically infers all dependencies.
  build() {
    return (
      column(
        new ControlRow("control-row", {demoComponent: this}),
        new List("root-list", {
          maxCount: this.count, 
          count: 1
        }),
        filler(),
        // text("Info:"),
        // text("A change of 'Depth' or 'Shared state' forces a rebiuld of all components in the hierarchy."),
        // text(" - Stable component identity and local state is demonstrated."), 
        // text(" - Minimal DOM node updates is demonstrated (watch element vierw in debugger)."),
      )
    );
  }
}
  
export function controlRow(...parameters) {
  return new ControlRow(getFlowProperties(parameters));
}

export class ControlRow extends Component {
  recieve({demoComponent}) {
      this.demoComponent = demoComponent;
  }
      
  build() {
    const rootText = text({ key: "root-text", text: "Recursive Structure"});
    const moreButton = button(
      "More", 
      {
        key: "more-button", 
        onClick: () => { 
          this.demoComponent.count++ 
        },
      }
    );

    // Early finalization of sub-component, and dimension analysis of it while building 
    // console.log(moreButton.dimensions());

    return row(
      rootText,
      row(
        text("Depth:"),
        moreButton, 
        button("Less", {key: "less-button", disabled: this.demoComponent.count === 1, onClick: () => {this.demoComponent.count--}}),
        {style: {alignItems: "baseline"}}
      ),
      numberInputField("Shared state", this.inherit("myModel"), "value"),
      {style: {padding: "10px", gap: "20px", alignItems: "baseline"}} // Reactive programmatic styling! 
    )
  }
}

export class List extends Component {
  // This is the function setProperties where you declare all properties that a parent can set on its child. This is optional, but is a good place to define default values, modify values given by parent, or document what properties that the component needs.   
  recieve({maxCount, count}) {
    this.maxCount = maxCount;
    this.count = count;
  }

  build() {
    const children = [];
    children.push(new Item("first-item", {depth: this.count}));
    if (this.count < this.maxCount) {
      children.push(new List("rest-list", {maxCount: this.maxCount, count: this.count + 1}));
    }
    return paperColumn("list-column", {style: {marginLeft: "10px", marginBottom: "2px", marginRight: "2px", borderWidth: "1px", borderStyle: "solid"}, children: children});
  }
}

export class Item extends Component {
  recieve({depth}) {
    this.depth = depth;
  }
  
  initialize() {
    // This is the place to define view model variables. In this case the "on" property is defined.
    this.value = 42;
  }
 
  build() {
    const me = this; 

    return row("item-row",  // row is a primitive flow that can be converted into a DOM element by the DomRenderContext module. However, a 1:1 mapping to HTML can also be possible, by using a Div flow for example. 
      text({ key: "item-text", text: "Depth " +  me.depth}),
      numberInputField("Local state", this, "value"),
      text(" Shared state: " + me.inherit("myModel").value, {}), 
      {
        style: {gap: "20px", alignItems: "baseline"}
      }
    );
  }
}

// function shadePanel(close) {
//   const target = getRenderContext();
//   return target.create({type: "elementNode", 
//     tagName: "div", 
//     componentTypeName: "shadePanel",
//     attributes: {
//       onclick: () => {close();},
//       style:{
//         position: "absolute",
//         top: 0,
//         left: 0,
//         width: "100%", 
//         height: "100%", 
//         backgroundColor: "black", 
//         opacity: 0.2
//       }
//     }, 
//   });
// }


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
