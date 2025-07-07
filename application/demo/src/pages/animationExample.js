
import { model, Component, transaction, toProperties } from "@liquefy/flow.core";

import { text, div, p, ul, li, DOMRenderContext, standardAnimation, addDefaultStyle } from "@liquefy/flow.dom";

import { column, filler, fillerStyle, naturalSizeStyle, portalContents, row } from "@liquefy/basic-ui";
import { SimpleMoveAnimation } from "./animation/simpleMoveAnimation";
import { SimpleAddRemoveAnimation } from "./animation/simpleAddRemoveAnimation";

import { button } from "@liquefy/themed-ui";
import { codeDisplay, displayCodeButton, informationButton } from "../components/information";

import file from './animationExample?raw';
import moveComponentFile from './codeExamples/moveComponent?raw';

// Style constants
const smallSpace = "5px";
const largeSpace = "20px";

// Items
const items = [
    "Foo", 
    "Fie",
    "Fum",
    "Bar",
    "Foobar",
    "Fiebar",
    "Fumbar"
];


// Item panel
const panel = (...parameters) => 
  column(
    addDefaultStyle(
      toProperties(parameters),
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


/**
 * Animation Example
 */
export class AnimationExample extends Component {
  receive({items, style, topBarPortal}) {
    this.name = "DOM Transition Animation";
    this.topBarPortal = topBarPortal;
    this.style = style; 
    this.items = items; 
  }

  initialize() {
    this.store = model([...this.items]);
    this.listA = model([]);
    this.listB = model([]);
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
    return column(
      topPortalContents(this.topBarPortal),
      // new SimpleMoveAnimation(),
      // new SimpleAddRemoveAnimation(),
      column(
        row(
          row(
            button("Add random", () => transaction(() => addRandomly(removeOneRandom(this.store), this.listA)), {disabled: this.store.length === 0}),
            button("Remove random", () => transaction(() => this.store.push(removeOneRandom(this.listA))), {disabled: this.listA.length === 0}),
            { style: {gap: 5} }
          ),
          filler(),
          row(
            button("Randomize", () => transaction(() => randomize(this.listA))),
            button("Juggle", () => this.juggle()),
            { style: {gap: 5} }
          ),
        ),
        column(
          filler(),
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
            {style: {overflow: "visible", ...naturalSizeStyle}}
          ),
          filler(),
          {style: fillerStyle}
        ),
        {style: fillerStyle}
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


/**
 * Top portal content
 */
const topPortalContents = (topBarPortal) =>
  portalContents("animationExampleInformation", 
    informationButton(
      column(
        p("A demo of the DOM transition animation:"),
        ul(
          li("Try out: Add and remove, randomize and juggle"), 
          li("These animations are triggered when a Flow component moves place in the component hierarchy from one place to another. Study the following simple example: "),
        ),
        codeDisplay({code: moveComponentFile, style: {height: 300, ...naturalSizeStyle, overflow: "auto"}}),
        { style: {width: 800, whiteSpace: "normal"}}
      )
    ),
    displayCodeButton({code: file, fileName: "src/pages/animationExample.js"}),
    {
      portal: topBarPortal
    }
  )
