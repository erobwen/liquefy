import { observable, Component, component, repeat, transaction } from "../flow/Flow";
import { DOMFlowTarget } from "../flow.DOMTarget/DOMFlowTarget.js";
import { animationTime } from "../flow.DOMTarget/DOMNodeAnimation";
import { column, filler, row } from "../components/basic/Layout";
import { button, text } from "../components/basic/BasicWidgets";
import { div } from "../flow.DOMTarget/BasicHtml";
import { startExperiment } from "..";
import { standardAnimation } from "../flow.DOMTarget/ZoomFlyDOMNodeAnimation";

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

const panel = component("panel", ({ children, style }) =>
  column({key: "panel", 
    children, 
    style: {
      marginBottom: "0px", 
      borderRadius: "15px", 
      backgroundColor: "#eeeeee", 
      borderColor: "#cccccc", 
      borderStyle: "solid", 
      borderWidth: "1px", 
      padding: "10px", 
      ...style
    }
  })
);

// Items
function itemDisplay(item) {
  // return div(
  //   text(item, {style: {margin: "", lineHeight: ""}}),
  //   {key: item, animate: true, style: {width: "200px", height: "40px", backgroundColor: "green", textAlign: "center", lineHeight: "40px"}}
  // );
  return text({key: item, text: item, style: {display: "block", lineHeight: "", padding: "", margin: smallSpace, textAlign: "left"}})
}


// A very simple view component
export class AnimationExample extends Component {
  setProperties({items}) {
    this.name = "Animation Example"
    this.items = items; 
  }

  setState() {
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

  build() {
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
      row(
        button({text: "Randomize", onClick: () => transaction(() => randomize(this.listA))}),
        button({text: "Add random", disabled: this.store.length === 0, onClick: () => transaction(() => addRandomly(removeOneRandom(this.store), this.listA))}),
        button({text: "Remove random", disabled: this.listA.length === 0, onClick: () => transaction(() => this.store.push(removeOneRandom(this.listA)))}),
        button({text: "Juggle", onClick: () => this.juggle()}),
        button({text: "Experiment", onClick: () => {
          startExperiment();
        }})
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
        {style: {overflow: "visible", height: "100%"}}
      ),
      {style: {height: "100%", width: "100%"}},
    );
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startAnimationExample() {
  new DOMFlowTarget(
    document.getElementById("flow-root")
  ).setContent(
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