import { Component, transaction, creators, getRenderContext } from "@liquefy/flow.core";
import { getFlowProperties } from "@liquefy/flow.core";

import { div, elementNode } from "@liquefy/flow.DOM";
import { logMark } from "@liquefy/flow.core";
import { getFlowPropertiesIncludingChildren } from "../../../flow.core/src/flowParameters";
const log = console.log;

/**
 * Modal
 */
export function modal(...parameters) {
  return new Modal(getFlowProperties(parameters));
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
  const properties = getFlowPropertiesIncludingChildren(parameters);
  const result = new ModalFrame(properties);
  return result; 
}

export class ModalFrame extends Component {
  receive({style, children}) {
    this.style = style; 
    this.children = children;  
    this.modalFrame = this;
    this.staticContent = children; 
  }

  initialize() {
    this.modalContent = null;
    this.modalSubFrame = null;
    this.childrenWithPossibleModal = [...this.children];
    this.ensure(() => {
      const newChildren = [...this.staticContent]
      if (this.modalSubFrame) newChildren.push(this.modalSubFrame);
      this.childrenWithPossibleModal = newChildren;
    })
  }

  openModal(modalContent) {
    this.setModalContent(modalContent)
  }
  
  onDispose() {
    // console.group("onDispose");
    super.onDispose();
    this.setModalContent(null);
    // console.groupEnd();
  }
  
  closeModal(modalContent) {
    if (this.modalContent === modalContent) {
      this.setModalContent(null);
    }
  }

  setStaticContent(staticContent) {
    staticContent = staticContent instanceof Array ? staticContent : [staticContent]
    this.staticContent = staticContent;
  }

  setModalContent(modalContent) {

    const previousContent = this.modalContent;

    transaction(() => {
      if (previousContent !== modalContent) {
        this.modalContent = modalContent;

        if (!modalContent) {
          // Remove modal
          this.disposeModalSubFrame();
        } else if (previousContent) {
          // Replace content
          this.modalSubFrame.setStaticContent(modalContent)
          modalContent.modalFrame = this.modalSubFrame;
        } else {
          // New content
          this.ensureModalSubFrame(this.modalContent);
          modalContent.modalFrame = this.modalSubFrame;
        }
      }
    });
  }

  ensureModalSubFrame(content) {
    if (!this.modalSubFrame) {
      creators.push(this);
      this.modalSubFrame = new ModalFrame(
        content, 
        { 
          style: {
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
  let properties = getFlowProperties(parameters);
  return elementNode({type: "elementNode", tagName: "div", componentTypeName: "modal-frame", ...properties});
}