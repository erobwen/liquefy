import { DOMNode } from "./DOMNode";    
import { domNodeClassRegistry } from "./DOMFlowTarget";
const log = console.log;


export class DOMTextNode extends DOMNode {
  setProperties({text}) {
    this.text = text;
  }
  
  createEmptyDomNode() {
    return document.createTextNode("");
  }

  ensureDomNodeAttributesSet() {
    // console.log(this.toString() + ".ensureDomNodeAttributesSet:");
    // console.log(element);
    this.domNode.nodeValue = this.text; // toString()
  }

  synchronizeDomNodeStyle(properties) {
    // for (let property of properties) {
    //   this.domNode.style[property] = "";
    // }
  }
}

domNodeClassRegistry["textNode"] = DOMTextNode;
