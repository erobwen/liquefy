// import { library } from '@fortawesome/fontawesome-svg-core';
// import { faCross, faPlus, faSuitcase, faXmark, faXmarkCircle } from '@fortawesome/free-solid-svg-icons';
// import { DOMElementNode } from '@liquefy/flow';
// import { finalize, repeat, trace } from '@liquefy/flow';
import { extractProperty, getFlowProperties } from "@liquefy/flow.core";
import { logMark } from '@liquefy/flow.core';

import { span, addDefaultStyleToProperties } from '@liquefy/flow.DOM';

import "./Icons.css";

// "@fortawesome/fontawesome-svg-core": "^6.4.0",
// "@fortawesome/free-regular-svg-icons": "^6.4.0",
// "@fortawesome/free-solid-svg-icons": "^6.4.0",

// import { aggregateToString } from '@liquefy/flow';
// library.add(faSuitcase);
// library.add(faPlus);
// library.add(faCross);
// library.add(faXmark);
// library.add(faXmarkCircle);

const log = console.log; 



export function suitcaseIcon(...parameters) {
  const properties = getFlowProperties(parameters);
  properties.name = "suitcase";
  return faIcon(properties);
}

export function plusIcon(...parameters) {
  const properties = getFlowProperties(parameters);
  properties.name = "plus";
  return faIcon(properties);
}

export function crossIcon(...parameters) {
  const properties = getFlowProperties(parameters);
  properties.name = "cross";
  return faIcon(properties);
}

export function icon(...parameters) {
  const properties = getFlowProperties(parameters);
  return faIcon(properties); 
}

export function faIcon(...parameters) {
  const properties = getFlowProperties(parameters);
  const name = extractProperty(properties, "name");
  properties.class = "fa " + "fa-" + name;
  return span(properties)
  // return new DOMFaNode(properties);
}



// export class DOMFaNode extends DOMElementNode {
//   receive({prefix, name}) {
//     this.tagName = "span"
//     this.prefix = prefix;
//     this.name = name;
//   }
  
//   createEmptyDomNode() {
//     return document.createElement('span');
//   }

//   ensureDomNodeBuilt() {
//     finalize(this);
//     if (!this.buildDOMRepeater) {
//       this.buildDOMRepeater = repeat("[" + aggregateToString(this) + "].buildFaDOMRepeater", (repeater) => {
//         this.ensureDomNodeExists();
//         this.domNode.className = "fa fa-plus";
//         log(icon);
//         log(icon("plus"));
//         log(library);
//
//          This crap interface did not work!!! doing it the css way... 
//         // this.domNode.innerHTML = icon(this.name).html;
//         this.ensureDomNodeAttributesSet();
//         if (trace) console.groupEnd();  
//       }, {priority: 2});
//     }
//     return this.domNode;
//   }
// }

// //window.FontAwesomeConfig.icon({ prefix: 'far', name: 'suitcase' });