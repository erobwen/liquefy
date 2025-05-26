import { Component } from "@liquefy/flow.core";
import { getRenderContext } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";

import { text, div } from "@liquefy/flow.DOM";

const log = console.log;


/**
 * Portals
 */
export function portalEntrance(...parameters) {
  return new PortalEntrance(toProperties(parameters));
}

export class PortalEntrance extends Component {
  receive({portalChildren, portalExit}) {
    this.portalExit = portalExit; 
    this.portalChildren = portalChildren;
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
  return getRenderContext().primitive( 
    { 
      type: "elementNode",
      componentTypeName: "portalExit", 
      tagName: "div", 
      ...toProperties(parameters), 
    }
  );
}
