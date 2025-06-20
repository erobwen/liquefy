import { Component } from "@liquefy/flow.core";
import { getRenderContext } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";

import { text, div, elementNode } from "@liquefy/flow.DOM";

const log = console.log;


/**
 * Portals
 */
export const portalContents = (...parameters) =>
  new PortalContents(...parameters);

export class PortalContents extends Component {
  receive({children, portalExit}) {
    this.portalExit = portalExit; 
    this.portalChildren = children;
  }

  initialize() {
    this.ensureAtRenderTime(() => {
      if (this.isVisible) {
        // Note: check if children already set will cause infinite loop. This is unnecessary since it is built in to causality anyway. 
        this.portalExit.children = this.portalChildren;
      } else {
        // Note that we need to check not to remove content put in place by other portals!
        if (this.portalExit.children && this.portalExit.children === this.portalChildren) {
          this.portalExit.children = null;
        }
      }
    });
  }

  render() {
    return div({style: {display: "none"}});
  }
}

export function portalExit(...parameters) {
  // Return just a plain div (with portalExit debug info.)
  return elementNode(
    { 
      tagName: "div", 
      componentTypeName: "portalExit", 
      ...toProperties(parameters), 
    }
  )
}


// export function portalExit(...parameters) {
//   // Return just a plain div (with portalExit debug info.)
//   elementNode({
//     tagName: "div", 
//     componentTypeName: "portalExit", 
//     attributes: toProperties(parameters), 
//   });
// }
