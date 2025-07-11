import { Component, withoutRecording } from "@liquefy/flow.core";
import { getRenderContext } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";

import { text, div, elementNode } from "@liquefy/flow.dom";

const log = console.log;


/**
 * Portals
 */
export const portalContents = (...parameters) =>
  new PortalContents(...parameters);

export class PortalContents extends Component {
  receive({children, portal}) {
    this.portal = portal; 
    if (!this.portal) throw new Error("PortalContents must be given a portal to render into!");
    this.portalChildren = children;
  }

  initialize() {
    this.ensureAtRenderTime(() => {
      if (this.isVisible) {
        // Note: check if children already set will cause infinite loop. This is unnecessary since it is built in to causality anyway.
        this.portal.children = this.portalChildren;
      } else {
        // Note that we need to check not to remove content put in place by other portals!
        withoutRecording(() => {
          if (this.portal.children && this.portal.children === this.portalChildren) {
            this.portal.children = null;
          }
        })
      }
    });
  }

  render() {
    return div({style: {display: "none"}});
  }
}

export function portal(...parameters) {
  // Return just a plain div (with portal debug info.)
  return elementNode(
    { 
      tagName: "div", 
      componentTypeName: "portal", 
      ...toProperties(parameters), 
    }
  )
}


// export function portal(...parameters) {
//   // Return just a plain div (with portal debug info.)
//   elementNode({
//     tagName: "div", 
//     componentTypeName: "portal", 
//     attributes: toProperties(parameters), 
//   });
// }
