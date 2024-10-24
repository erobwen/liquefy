import { Component } from "@liquefy/flow.core";
import { getRenderContext } from "@liquefy/flow.core";
import { getFlowProperties } from "@liquefy/flow.core";

import { extractAttributes, text, div } from "@liquefy/flow.DOM";

const log = console.log;


/**
 * Portals
 */
export function portalEntrance(...parameters) {
  return new PortalEntrance(getFlowProperties(parameters));
}

export class PortalEntrance extends Component {
  setProperties({portalContent, portalExit}) {
    this.portalExit = portalExit; 
    this.portalContent = portalContent;
    this.ensureAtBuild(() => {
      if (this.isVisible) {
        // Note: check if children already set will cause infinite loop. This is unnecessary since it is built in to causality anyway. 
        this.portalExit.children = this.portalContent;
      } else {
        // Note that we need to check not to remove content put in place by other portals!
        if (this.portalExit.children && this.portalExit.children === this.portalContent) {
          this.portalExit.children = null;
        }
      }
    });
  }

  build() {
    return div({style: {display: "none"}});
  }
}

export function portalExit(...parameters) {
  const properties = getFlowProperties(parameters);
  const attributes = extractAttributes(properties);

  // Return just a plain div (with portalExit debug info.)
  return getRenderContext().create( 
    { 
      key: properties.key,
      type: "elementNode",
      componentTypeName: "portalExit", 
      tagName: "div", 
      attributes, 
    }
  );
}
