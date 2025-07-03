import { Component, transaction, creators, getRenderContext } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";

import { div, elementNode } from "@liquefy/flow.DOM";
import { logMark } from "@liquefy/flow.core";
import { toPropertiesWithChildren } from "@liquefy/flow.core/src/implicitProperties";
const log = console.log;

/**
 * Overlay
 */
export function overlay(...parameters) {
  return new Overlay(...parameters);
}

export class Overlay extends Component {
  receive({children}) {
    if (children && children.length > 1) throw new Error("Overlay accepts at most a single child!");
    this.children = children; 
    // this.content = children[0];
    // children.length = 0;
  }

  initialize() {
    this.visibleOnFrame = null;
    this.ensure(() => {
      if (this.isVisible) {
        // Try to show
        const overlayFrame = this.inherit("overlayFrame");
        if (overlayFrame) {
          this.visibleOnFrame = overlayFrame;
          overlayFrame.showOverlay(this, this.children ? this.children[0] : null);
        }
      } else if (this.visibleOnFrame) {
        // Try to hide
        this.visibleOnFrame.hideOverlay(this);
        this.visibleOnFrame = null;
      }
    });
  }

  render() {
    return div({style: {display: "none"}});
  }
}

export function overlayFrame(...parameters) {
  // debugger; 
  const properties = toPropertiesWithChildren(parameters);
  const result = new OverlayFrame(properties);
  return result; 
}


/**
 * Overlay frame
 */
export class OverlayFrame extends Component {
  receive({style, children, overlayContent}) {
    this.style = style; 
    this.children = children;  
    this.overlayFrame = this;
    this.staticContent = children; 
    this.receivedOverlayContent = overlayContent; 
  }

  initialize() {
    this.assignedOverlayContent = null;
    this.modalSubFrame = null;
    this.childrenWithPossibleModal = [...this.children];

    // Set children
    this.ensure(() => {
      const newChildren = [...this.staticContent]
      if (this.modalSubFrame) newChildren.push(this.modalSubFrame);
      this.childrenWithPossibleModal = newChildren;
    })

    // Setup modal sub frame
    this.ensure(() => {
      if (this.assignedOverlayContent && this.receivedOverlayContent) {
        throw new Error("Cannot both assign modal content and set it as a property for one single overlay frame.")
      } else {
        const overlayContent = this.assignedOverlayContent ? this.assignedOverlayContent : this.receivedOverlayContent 
         
        if (!overlayContent) {
          // Remove modal
          this.disposeModalSubFrame();
        } else if (this.modalSubFrame) {
          // Replace content
          this.modalSubFrame.setStaticContent(overlayContent)
          overlayContent.overlayFrame = this.modalSubFrame;
        } else {
          // New content
          this.ensureModalSubFrame(overlayContent);
          overlayContent.overlayFrame = this.modalSubFrame;
        }
      }
    })
  }

  showOverlay(contentProvider, overlayContent) {
    this.assigningContentProvider = contentProvider
    this.assignedOverlayContent = overlayContent;
  }
  
  onDispose() {
    super.onDispose();
    this.assignedOverlayContent = null;
  }
  
  hideOverlay(contentProvider) {
    if (this.assigningContentProvider === contentProvider) {
      this.assignedOverlayContent = null;
    }
  }

  setStaticContent(staticContent) {
    staticContent = staticContent instanceof Array ? staticContent : [staticContent]
    this.staticContent = staticContent;
  }

  ensureModalSubFrame(content) {
    if (!this.modalSubFrame) {
      creators.push(this);
      this.modalSubFrame = new OverlayFrame(
        content, 
        { 
          style: {
            zIndex: 10,
            position: "absolute", 
            top: 0, 
            left: 0, 
            width: "100%", 
            height: "100%", 
            pointerEvents: "none"
          }
        }
      ); 
      creators.pop();
    }
  }

  disposeModalSubFrame() {
    if (this.modalSubFrame) {
      transaction(() => {
        this.modalSubFrame.reallyDisposed = true;
        // This is to avoid the old sub frame holding on the the dialog, if we create a new one. 
        this.modalSubFrame.children = [];
        this.modalSubFrame.getPrimitive(this.modalSubFrame.causality.target.parentPrimitive).children = []; 
        this.modalSubFrame.onDispose();
        this.modalSubFrame = null;
      });
    }
  }

  render() {
    if (this.reallyDisposed) throw new Error("CANNOT REBUILD A DISPOSED ONE!!!");
    return new overlayFrameDiv({style: this.style, children: this.childrenWithPossibleModal});
  }
}

function overlayFrameDiv(...parameters) {
  let properties = toProperties(parameters);
  return elementNode({tagName: "div", componentTypeName: "overlay-frame", ...properties});
}