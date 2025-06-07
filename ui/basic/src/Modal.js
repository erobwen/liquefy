import { Component, transaction, creators, getRenderContext } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";

import { div, elementNode } from "@liquefy/flow.DOM";
import { logMark } from "@liquefy/flow.core";
import { toPropertiesWithChildren } from "../../../flow.core/src/implicitProperties";
const log = console.log;

/**
 * Modal
 */
export function modal(...parameters) {
  return new Modal(toPropertiesWithChildren(parameters));
}

export class Modal extends Component {
  receive({children}) {
    if (children.length !== 1) throw new Error("Modal only accepts a single child!");
    this.content = children[0];
    children.length = 0;
  }

  initialize() {
    this.visibleOnFrame = null;
    this.ensure(() => {
      if (this.isVisible) {
        // Try to show
        const modalFrame = this.inherit("modalFrame");
        if (modalFrame) {
          this.visibleOnFrame = modalFrame;
          modalFrame.openModal(this.content);
        }
      } else if (this.visibleOnFrame) {
        // Try to hide
        this.visibleOnFrame.closeModal(this.content);
      }
    });
  }

  render() {
    return div({style: {display: "none"}});
  }
}

export function modalFrame(...parameters) {
  // debugger; 
  const properties = toPropertiesWithChildren(parameters);
  const result = new ModalFrame(properties);
  return result; 
}

export class ModalFrame extends Component {
  receive({style, children, modalContent}) {
    this.style = style; 
    this.children = children;  
    this.modalFrame = this;
    this.staticContent = children; 
    this.receivedModalContent = modalContent; 
  }

  initialize() {
    this.assignedModalContent = null;
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
      if (this.assignedModalContent && this.receivedModalContent) {
        throw new Error("Cannot both assign modal content and set it as a property for one single modal frame.")
      } else {
        const modalContent = this.assignedModalContent ? this.assignedModalContent : this.receivedModalContent 
         
        if (!modalContent) {
          // Remove modal
          this.disposeModalSubFrame();
        } else if (this.modalSubFrame) {
          // Replace content
          this.modalSubFrame.setStaticContent(modalContent)
          modalContent.modalFrame = this.modalSubFrame;
        } else {
          // New content
          this.ensureModalSubFrame(modalContent);
          modalContent.modalFrame = this.modalSubFrame;
        }
      }
    })
  }

  openModal(modalContent) {
    this.assignedModalContent = modalContent;
  }
  
  onDispose() {
    super.onDispose();
    this.assignedModalContent = null;
  }
  
  closeModal(modalContent) {
    if (this.assignedModalContent === modalContent) {
      this.assignedModalContent = null;
    }
  }

  setStaticContent(staticContent) {
    staticContent = staticContent instanceof Array ? staticContent : [staticContent]
    this.staticContent = staticContent;
  }

  ensureModalSubFrame(content) {
    if (!this.modalSubFrame) {
      creators.push(this);
      this.modalSubFrame = new ModalFrame(
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
    return new modalFrameDiv({style: this.style, children: this.childrenWithPossibleModal});
  }
}

function modalFrameDiv(...parameters) {
  let properties = toProperties(parameters);
  return elementNode({tagName: "div", componentTypeName: "modal-frame", ...properties});
}