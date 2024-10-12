import { div, text } from "../flow.DOM/BasicHtml";
import { button } from "../components/basic/BasicWidgets";
import { column } from "../components/basic/Layout";
import { DOMRenderContext } from "../flow.DOM/DOMRenderContext";
import { Component } from "../flow/Flow";

const log = console.log;

/**
 * Minimalistic component used for experiments. 
 */
export class SimpleAddRemoveAnimation extends Component {
  setState() {
    this.showText = false;
    this.color = "green"; 
  }

  // text("Some text", {animate: true, key: "my-text", style: {color: "green"}}).show(this.showText)

  onClick() {
    this.showText = !this.showText;
    setTimeout(()=> {
      this.color = this.color === "green" ? "red" : "green"; 
    },
    2500) 

  }

  build() {
    return column(
      button("foo", "Foo", this.onClick.bind(this)),
      column(
        div({key: "my-text", animate: true, style: {width: "200px", height: "40px", backgroundColor: this.color}}).show(this.showText),
        {style: {overflow: "visible", width: "400px", height: "400px"}}
      ),
      {style: {fontSize: "40px", padding: "20px"}}
    );
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startSimpleAddRemoveAnimation() {
  const simple = new SimpleAddRemoveAnimation()  
  new DOMRenderContext(document.getElementById("root")).setContent(simple)
}
