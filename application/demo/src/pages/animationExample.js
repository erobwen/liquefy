
import { observable, Component, transaction, getFlowProperties } from "@liquefy/flow.core";

import { text, div, DOMRenderContext, standardAnimation, addDefaultStyleToProperties } from "@liquefy/flow.DOM";

import { button, column, filler, row } from "@liquefy/basic-ui";
import { SimpleMoveAnimation } from "./animation/simpleMoveAnimation";
import { SimpleAddRemoveAnimation } from "./animation/simpleAddRemoveAnimation";

const log = console.log;

/**
 * Flow definitions
 */
const smallSpace = "5px";
const largeSpace = "20px";
// const smallSpace = "0px";
// const largeSpace = "0px";


// A very simple model
const items = [
    "Foo", 
    "Fie",
    "Fum",
    "Bar",
    "Foobar",
    "Fiebar",
    "Fumbar"
];

const panel = (...parameters) => 
  column(
    addDefaultStyleToProperties(
      getFlowProperties(parameters),
      {
        marginBottom: "0px", 
        borderRadius: "15px", 
        backgroundColor: "#eeeeee", 
        borderColor: "#cccccc", 
        borderStyle: "solid", 
        borderWidth: "1px", 
        padding: "10px"
      }
    ) 
  );

// Items
function itemDisplay(item) {
  return div(
    text(item), 
    {
      key: item, 
      style: {
        display: "block", lineHeight: "", padding: "", margin: smallSpace, textAlign: "left"
      }
    }
  );
}


// A very simple view component
export class AnimationExample extends Component {
  receive(properties) {
    Object.assign(this, properties)
    const {items} = properties
    this.name = "DOM Transition Animation"
    this.items = items; 
  }

  initialize() {
    this.store = observable([...this.items]);
    this.listA = observable([]);
    this.listB = observable([]);
    transaction(() => {
      let count = 0; 
      while (count-- > 0) addRandomly(removeOneRandom(this.store), this.listA);
    });
  }

  juggle() {
    transaction(() => {
      const listALength = this.listA.length;
      const listBLength = this.listB.length;
      const aToB = (listALength + 1 >= listBLength && listALength) && removeOneRandom(this.listA);
      const bToA = (listBLength + 1 >= listALength && listBLength) && removeOneRandom(this.listB);
      if (aToB) addRandomly(aToB, this.listB);
      if (bToA) addRandomly(bToA, this.listA);
    });
  }

  render() {
    // return (
    //   column(  
    //       column(
    //         div({style: {width: "100px", height: "100px", borderWidth: "1px", borderStyle: "solid"}}),
    //         // div({style: {marginTop: "-100px"}}), // Interesting, this can collapse the parent container... 
    //         {style: {borderWidth: "1px", borderStyle: "solid"}}
    //       ), 
    //       filler()
    //     )
    // )  

    return column(

      new SimpleMoveAnimation(),
      new SimpleAddRemoveAnimation(),
      row(
        button("Randomize", () => transaction(() => randomize(this.listA))),
        button("Add random", () => transaction(() => addRandomly(removeOneRandom(this.store), this.listA)), {disabled: this.store.length === 0}),
        button("Remove random", () => transaction(() => this.store.push(removeOneRandom(this.listA))), {disabled: this.listA.length === 0}),
        button("Juggle", () => this.juggle()),
      ),
      row(
        column(
          filler(),
          panel({
            children: this.listA.map(item => itemDisplay(item)),
            style: {fontSize: "40px", lineHeight: "40px", margin: largeSpace, padding: largeSpace, overflow: "visible", borderStyle:"solid", borderWidth: "1px"}, 
            animateChildren: standardAnimation       
          }),
          filler(),
          {style: {overflow: "visible"}}
        ),
        filler(),
        column(
          filler(),
          panel({
            children: this.listB.map(item => itemDisplay(item)),
            style: {fontSize: "20px", lineHeight: "20px", color: "blue", margin: largeSpace, padding: largeSpace, overflow: "visible", borderStyle:"solid", borderWidth: "1px"},  
            animateChildren: standardAnimation       
          }),
          filler(),
          {style: {overflow: "visible"}}
        ),
        {style: {overflow: "visible", height: "200px"}}
      ),
      {style: {height: "100%", width: "100%"}},
    );
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startAnimationExample() {
  new DOMRenderContext(
    document.getElementById("root")
  ).render(
    new AnimationExample({items})
  )
}
   

/**
 * Random stuff
 */

function removeOneRandom(list) {
  const index = Math.floor(Math.random()*(list.length))
  // const index = 0;
  return list.splice(index, 1)[0]; 
}

function randomized(list) {
    const listCopy = [...list];
    const newList = [];
    while(listCopy.length > 0) {
      addRandomly(removeOneRandom(listCopy), newList);
    }
    return newList;
}

function randomize(list) {
  transaction(() => {
    const newContent = randomized(list);
    list.length = 0;
    list.push.apply(list, newContent);
  });
}

function addRandomly(item, list) {
  const insertIndex = Math.floor(Math.random()*(list.length));
  // const insertIndex = list.length;
  list.splice(insertIndex, 0, item);
}