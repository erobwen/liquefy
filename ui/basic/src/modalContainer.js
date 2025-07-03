
import { Component } from "@liquefy/flow.core";
import { div } from "@liquefy/flow.DOM";

import { centerMiddle,  fitContainerStyle,  zStack, zStackElementStyle, overflowVisibleStyle } from "./Layout";
import { overlay } from "./overlay";


/**
 * Modal container
 */
const shadeColor = "rgba(0, 0, 0, 0.4)";

export const modalContainer = (...parameters) => new ModalContainer(...parameters);

export class ModalContainer extends Component {
  receive({fullScreenTreshold, dialogue, dialogueProperties, close, content, children, backgroundColor=shadeColor}) {
    this.fullScreenTreshold = fullScreenTreshold;
    this.close = close; 

    this.dialogue = dialogue; 
    this.dialogueProperties = dialogueProperties; 
    this.content = content; 
    this.children = children;

    this.backgroundColor = backgroundColor;
    
    const sources = (dialogue ? 1 : 0) + (content ? 1 : 0) + (children ? 1 : 0)
    if (sources > 1) {
      throw new Error("Modal can only have one way to define the dialogue!")
    }  
  }
  
  render() {
    const isFullScreen = this.renderContext.bounds.width < this.fullScreenTreshold;
    if (isFullScreen) {
      return this.renderFullScreen();
    } else {
      return this.renderWindow();
    }
  }

  getDialogue() {
    if (this.dialogue) {
      return this.dialogue("dialogue", {
        ...this.dialogueProperties, 
        close: this.close
      });
    } else if (this.children && this.children.length > 0) {
      return this.children[0];
    } else if (this.content) {
      return this.content; 
    }
    return null; 
  }

  renderFullScreen() {
    let dialogue = this.getDialogue(); 
    
    if (dialogue) {
      if (dialogue.style) {        
        dialogue.style = {
          ...dialogue.style,
          width: "100%", 
          height: "100%",
          maxWidth: "default",
          minWidth: 0,
        }
      }      

      dialogue.isFullScreen = true;
    }

    return overlay("overlay", 
      dialogue
    );
  }
    
  renderWindow() {
    const dialogue = this.getDialogue()
    if(dialogue) dialogue.isFullScreen = false; 

    return ( 
      overlay("overlay",
        zStack("zStack",
          div("background", {
            onClick: () => { this.close() }, 
            style: {
              ...zStackElementStyle, 
              ...overflowVisibleStyle, 
              transition: "background-color 1000ms linear", 
              pointerEvents: "auto", 
              backgroundColor: this.backgroundColor
            }
          }),
          centerMiddle("centerMiddle",            
            dialogue,
            this.content,
            this.children,
            {style: {...zStackElementStyle}}
          ),
          {style: fitContainerStyle}
        )
      )
    )
  }
}