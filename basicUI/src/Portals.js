import { extractAttributes } from "@liquefy/flow";
import { Component } from "@liquefy/flow";
import { getTarget } from "@liquefy/flow";
import { readFlowProperties, findKeyInProperties } from "@liquefy/flow";
const log = console.log;


/**
 * Portals
 */
export function portalEntrance(...parameters) {
  const properties = readFlowProperties(parameters);
  findKeyInProperties(properties);
  return new PortalEntrance(properties);
}

export class PortalEntrance extends Component {
  setProperties({portalContent, portalExit}) {
    this.portalExit = portalExit; 
    this.portalContent = portalContent;
    this.derriveAtBuild(() => {
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
    // Just render into nothing.
    return null;
  }
}

export function portalExit(...parameters) {
  const properties = readFlowProperties(parameters);
  findKeyInProperties(properties);
  const attributes = extractAttributes(properties);

  // Return just a plain div (with portalExit debug info.)
  return getTarget().create(properties.key, 
    { 
      type: "dom.elementNode",
      classNameOverride: "portalExit", 
      tagName: "div", 
      attributes, 
    }
  );
}
