import { div, text, DOMRenderContext } from "@liquefy/flow.dom";
import { Component } from "@liquefy/flow.core";
import { column, button } from "@liquefy/basic-ui";

const log = console.log;

/**
 * Minimalistic component used for experiments. 
 */
export class SimpleAddRemoveAnimation extends Component {
  initialize() {
    this.showText = false;
    this.color = "green"; 
  }

  // text("Some text", {animate: true, key: "my-text", style: {color: "green"}}).show(this.showText)

  onClick() {
    this.showText = !this.showText;
    // setTimeout(()=> {
    //   this.color = this.color === "green" ? "red" : "green"; 
    // },
    // 2500) 

  }

  render() {
    return column(
      button("foo", "Foo", this.onClick.bind(this), {style: flexAutoStyle}),
      column(
        div({key: "my-text", animate: true, style: {width: "200px", height: "40px", backgroundColor: this.color}}).show(this.showText),
        {style: {overflow: "visible", width: "400px", height: "400px"}}
      ),
      {style: {fontSize: "40px", padding: "20px", height: "150px"}}
    );
  }
}


export const flexAutoStyle = {
    overflow: "hidden",
    boxSizing: "border-box",
    flexGrow: "0",
    flexShrink: "0",
    flexBasis: 'auto'
  };
  
/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startSimpleAddRemoveAnimation() {
  const simple = new SimpleAddRemoveAnimation()  
  new DOMRenderContext(document.getElementById("root")).render(simple)
}
