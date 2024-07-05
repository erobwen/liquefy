// import { library } from '@fortawesome/fontawesome-svg-core';
// import { faCross, faPlus, faSuitcase, faXmark, faXmarkCircle } from '@fortawesome/free-solid-svg-icons';
// import { DOMElementNode } from '@liquefy/flow';
// import { finalize, repeat, trace } from '@liquefy/flow';
import { getFlowProperties, addDefaultStyleToProperties } from "@liquefy/flow.core";
import { logMark } from '@liquefy/flow.core';

import { extractProperty, span } from '@liquefy/flow.DOM';

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
  properties.iconName = "suitcase";
  return faIcon(properties);
}

export function plusIcon(...parameters) {
  const properties = getFlowProperties(parameters);
  properties.iconName = "plus";
  return faIcon(properties);
}

export function crossIcon(...parameters) {
  const properties = getFlowProperties(parameters);
  properties.iconName = "cross";
  return faIcon(properties);
}

export function icon(iconName, ...parameters) {
  const properties = getFlowProperties(parameters);
  properties.iconName = iconName;
  return faIcon(properties); 
}

export function faIcon(...parameters) {
  const properties = getFlowProperties(parameters);
  findPrefixAndIconNameInProperties(properties);
  const iconName = extractProperty(properties, "iconName");
  properties.className = "fa " + "fa-" + iconName;
  return span(properties)
  // return new DOMFaNode(properties);
}

export function findPrefixAndIconNameInProperties(properties) {
  if (!properties.stringsAndNumbers) return properties;
  if (properties.stringsAndNumbers.length >= 2) {
    properties.prefix = properties.stringsAndNumbers.pop();
  } else {
    properties.prefix = "far";
  }
  if (properties.stringsAndNumbers.length) {
    properties.iconName = properties.stringsAndNumbers.pop();
  }
  if (properties.stringsAndNumbers.length) {
    throw new Error("Found too many loose strings in flow parameters");
  }
  delete properties.stringsAndNumbers;
  return properties; 
}


// export class DOMFaNode extends DOMElementNode {
//   setProperties({prefix, iconName}) {
//     this.tagName = "span"
//     this.prefix = prefix;
//     this.iconName = iconName;
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
//         // this.domNode.innerHTML = icon(this.iconName).html;
//         this.ensureDomNodeAttributesSet();
//         if (trace) console.groupEnd();  
//       }, {priority: 2});
//     }
//     return this.domNode;
//   }
// }

// //window.FontAwesomeConfig.icon({ prefix: 'far', iconName: 'suitcase' });