import { observable, Component, repeat } from "../flow/Flow";
import { DOMFlowTarget } from "../flow.DOM/DOMFlowTarget.js";
import { button } from "../components/basic/BasicWidgets";
import { column, row as basicRow } from "../components/basic/Layout";
import { text } from "../../flow.DOM/src/HTMLBuilding.js";


const log = console.log;

/**
 * Flow definitions
 */

// Parent flow
export class HelloWorld extends Component {
  setState() {
    this.name = "Hello World";
    this.helloText = observable({ value: "..." });
    this.emphasis = false;
    this.derrive(() => {
      // In setState you can establish reactive relations between different properties using this.derrive(). You could accomplish the same thing using causality/repeat but this.derrive takes care of disposing the repeater for your convenience. 
      // Note that this repeater even decorates the observable helloText object with additional data, but we could have added more properties to this as well, it would make no difference. 
      this.helloText.withComma = this.helloText.value.length > 4 ? this.helloText.value + "," : this.helloText.value;
    });
  }

  build() {
    return column(
      button("Start", {onClick:() => {asyncModifications(this)}}),
      myRow(
        hello(), // No need to pass parameters as it will be inherited.
        text(" "),
        new World("world", { exclamationCharacter: "!" }) // This is how we create child flow components with a key "world" and pass them properties.
      )
    )
  }
}

// Stateless child flow (compact definition)
const hello = component("hello", (flow) =>
  text({ key: "text", text: flow.inherit("helloText").withComma })
);
//

// Statefull child flow
class World extends Component {
  setProperties({ exclamationCharacter }) {
    // This life cycle function is optional, but can be used to set default values for properties.
    this.exclamationCharacter = exclamationCharacter ? exclamationCharacter : "?";
  }

  setState() {
    // In this lifecycle function you can setup state and obtain expensive resources. You can let go of these resources in disposeState().
    this.worldText = "";
  }

  build() {
    return myRow(
      text(this.worldText),
      exclamationMark({
        on: this.inherit("emphasis"),
        character: this.exclamationCharacter,
      })
    );
  }
}

// Another stateless child flow
const exclamationMark = component("exclamationMark", ({ on, character }) =>
  on ? text({ text: character }) : null
);

// My own dynamically/reactivley styled row
const myRow = component("myRow", (flow) => {
  let { style, children } = flow;
  if (!style) style = {};
  if (flow.inherit("emphasis")) style.fontSize = "20px"; 
  return basicRow({ children, style });
});

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startHelloWorld() {
  // Activate continous build/integration to DOMFlowTarget.
  const helloWorld = new HelloWorld();
  new DOMFlowTarget(document.getElementById("root")).setContent(helloWorld);
  asyncModifications(helloWorld);  
}


/**
 * Async modification
 */
function asyncModifications(helloWorld) {
  // Set "Hello" deep inside observable data structure
  setTimeout(() => {
    // log("----------------------------------");
    helloWorld.helloText.value = "Hello";
  }, 1000);

  // Set state property to "world!", using a component path to access child component.
  setTimeout(() => {
    // log("----------------------------------");
    // helloWorld.getChild("world").worldText = "world";
  }, 2000);
  
  // Exclamation mark!
  setTimeout(() => {
    // log("----------------------------------");
    helloWorld.emphasis = true;
  }, 3000);
}