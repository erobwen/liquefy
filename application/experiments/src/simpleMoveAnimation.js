import { observable, Component, repeat, transaction } from "../flow/Flow";
import { DOMRenderContext } from "../flow.DOM/DOMRenderContext.js";
import { text } from "../components/basic/BasicWidgets";
import { column, filler, fillerStyle, row } from "../components/basic/Layout";
import { modernButton } from "../components/modern/ModernButton";
import { overflowVisibleStyle, borderStyle, panelStyle } from "../components/modern/Style";
import { button as basicButton } from "../components/basic/BasicWidgets";
import { button } from "../components/themed/Theme";
// import { startExperiment, inExperiment } from "..";
import { div, text } from "../flow.DOM/BasicHtml";
import { logMark } from "../flow/utility";


const log = console.log;

/**
 * Minimalistic component used for experiments. 
 */
export class SimpleMoveAnimation extends Component {
  initialize() {
    this.left = false;
    this.showButton = false;
    this.color = "green"; 
    this.text = "Text"
  }

  onDispose() {
    this.button.onDispose();
  }

  move() {
    logMark("move"); 
    transaction(() => {
      console.log(this.findKey("button"));
      this.findKey("button").animate = true;
      this.findKey("button").foo = "bar";
      console.log(this.findKey("button").animate);
      this.left = !this.left;
    });
    console.log(this.findKey("button"));

    // setTimeout(() => {
    //   startExperiment();
    // }, 1000);

    // setTimeout(() => {
    //   log("SETTING TEXT");
    //   log(this.button);
    //   log(this.button);
    //   // this.backgroundColor = this.backgroundColor === "green" ? "red" : "green";  
    //   this.text = this.text === "Text" ? "Next" : "Text";  

    //   // let color = this.button.style.color;  
    //   // color = color === "red" ? "green" : "red"; 
    //   // log(this.button.style = {...this.button.style, color});
    //   // this.button.text = this.button.text + "!"       
    // }, 2500);
  }

  render() {
    logMark("build simple animation ");
    // const button = new modernButton(
    // const button = div("wrapper", this.button, {animate: true});
    if (window.idToComponent[14]) console.log(window.idToComponent[14].animate);
    const movingButton = button(
      "button", this.text, 
      this.move.bind(this),
      {
        ripple: true,
        style: {
          margin: "10px",
          // backgroundColor: this.backgroundColor,
          width: "150px"
        }
      }
    );
    console.log(movingButton.animate);
    if (window.idToComponent[14]) console.log(window.idToComponent[14].animate);
    // movingButton.animate = true; // Force property...  

    return column(
      row(
        basicButton("Move", this.move.bind(this)),
        // basicButton("Experiment", () => startExperiment()),
        filler(),
        {style: {...overflowVisibleStyle}}
      ),
      div({style: {height: "200px"}}),
      row(
        column(
          movingButton.show(this.left),
          {style: {...overflowVisibleStyle, width: "150px"}}
        ),
        div({style: {width: "200px"}}),
        column(
          // text("Some Text", {animate: true, style: borderStyle}).show(!this.left),
          movingButton.show(!this.left),
          {style: {...overflowVisibleStyle, width: "150px"}}
        ),
        {style: overflowVisibleStyle}
      ),
      filler(),
      {style: {...overflowVisibleStyle, fontSize: "40px", padding: "20px"}}
    );
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startSimpleMoveAnimation() {
  const simple = new SimpleMoveAnimation()  
  new DOMRenderContext(document.getElementById("root")).render(simple)
}
