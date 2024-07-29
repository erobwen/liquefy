import { findImplicitChildrenAndOnClick, getFlowProperties, Component } from "@liquefy/flow.core";
import { button } from "@liquefy/basic-ui";

import { adjustLightness, grayColor } from "./Color";
import { paperShadow2, paperShadow5 } from "./Paper";

const log = console.log; 

export function modernButton(...parameters) { 
  const properties = findImplicitChildrenAndOnClick(getFlowProperties(parameters));
  
  properties.hoverEffect = true; // Debug override
  properties.ripple = true; // Debug override 

  return new ModernButton(properties);
};

const boxShadowStyle = {
  boxShadow: paperShadow2
}

export class ModernButton extends Component {

  setProperties({
    style={},
    
    children, 
    
    onClick,
    
    disabled=false,

    pressed=false, 
    hoverAjust = -0.1, 
    ripple=true, 
    hoverEffect= true, 
    edge=true,
    square=false, 

    fixedSize=false
  }) {
    this.ripple = ripple;
    this.hoverEffect = hoverEffect;
    this.children = children; 
    this.onClick = onClick;
    this.disabled = disabled; 

    // New args: 
    this.lightenOnHoverAndPressed = true;  
    this.mouseoverEffectOnPressed = true;  

    if (fixedSize) style.width = "250px";

    if (!style.backgroundColor) {
      style.backgroundColor = grayColor(240);
    }
    
    this.backgroundColor = style.backgroundColor; 
    this.mouseOverBackgroundColor = adjustLightness(this.backgroundColor, hoverAjust);
    this.pressedBackgroundColor = adjustLightness(this.backgroundColor, -0.2)
    this.mouseOverPressedBackgroundColor = adjustLightness(this.pressedBackgroundColor, -0.1);
    this.style = {
      ...(edge ? boxShadowStyle : null), 
      // ...fitContainerStyle, 
      // ...panelStyle,
      boxSizing: "border-box",
      borderWidth: edge ? "1px" : "0px",
      borderColor: "rgba(0, 0, 0, 0.4)",
      borderRadius: "4px", // 2px
      borderStyle: "solid", 
      margin: "5px",
      overflow: "visible", 
      height: "35px",
      width: square ? "35px" : "", 
      position: "relative", 
      overflow: "hidden", 
      color: disabled ? "rgba(0,0,0,0.3)" : "black", 
      transition: "background 0.5s", 
      overflow: "hidden", 
      userSelect: "none", 
      fontSize: "20px",
      paddingLeft: "10px",
      paddingRight: "10px",
      ...style
    };
    if (ripple) style.position = "relative";

    this.pressed = pressed;  
    this.inAnimation = false;
    this.eventListenersSet = false; 
  }

  setState() {
    this.hover = false;
    this.ensure(() => {
      // log("ENSURE");
      // log(foo);
      // log("--")
      // Ensure event listeners
      const pannel = this.findChild("button").domNode;
      if (pannel !== this.eventListenersDomNode) {
        this.eventListenersDomNode = pannel;
        this.clearEventListeners();
        this.setEventListeners(this.onClick, this.mouseOverBackgroundColor);
      }

      // Ensure right background color
      // log(this.toString())
      // log("hover:" + thiover);
      if (this.pressed) {
        if (this.hover && this.hoverEffect) {
          this.style = {...this.style, backgroundColor: this.mouseOverPressedBackgroundColor};      
        } else {
          this.style = {...this.style, backgroundColor: this.pressedBackgroundColor};      
        }
      } else {
        if (this.hover  && this.hoverEffect) {
          this.style = {...this.style, backgroundColor: this.mouseOverBackgroundColor};      
        } else {
          this.style = {...this.style, backgroundColor: this.backgroundColor};      
        }
      }
    });
  }

  onDispose() {
    this.clearEventListeners();
  }

  clearEventListeners() {
    if (!this.eventListenersSet) return;

    // Clear old listeners
    const panel = this.findChild("button").domNode;
    if (this.setMouseoverColor) {
      panel.removeEventListener("mouseover", this.setMouseoverColor);  
      delete this.setMouseoverColor;
    }
    if (this.removeMouseoverColor) {
      panel.removeEventListener("mouseout", this.removeMouseoverColor);
      delete this.removeMouseoverColor;
    }
    if (this.rippleAndCallback) {
      panel.removeEventListener("click", this.rippleAndCallback);
      delete this.rippleAndCallback;
    }

    this.eventListenersSet = false; 
  }

  setEventListeners(onClick, mouseOverBackgroundColor) {
    const {ripple} = this; 
    const panel = this.findChild("button").domNode;
    // log("setEventListeners");
    // log(panel)

    this.rippleAndCallback = (event) => {
      event.stopPropagation();
      event.preventDefault();
      
      // log("TRY RIPPLE");


      event.stopPropagation();
      if (this.inAnimation) {
        onClick(); 
        return;
      }
      this.inAnimation = true; 
          
      if (ripple) { 
        // log("RIPPLE");
        // log(this)
        // log(this.findChild("text"));
        // log(this.findChild("text").domNode);

        // Fixate panel (it might grow otherwise... )
        panel.style.overflow = "hidden";
        const panelComputedStyle = window.getComputedStyle(panel, null);
        panel.style.maxWidth = panelComputedStyle.width;
        panel.style.maxHeight = panelComputedStyle.height;
        
        // Button size
        const diameter = Math.max(panel.clientWidth, panel.clientHeight);
        const radius = diameter / 2;
        
        // Create circle
        const circle = document.createElement('div');
        circle.isControlledByAnimation = true; 
        panel.appendChild(circle);
        circle.style.width = circle.style.height = diameter + "px";
        circle.style.left = (event.clientX - panel.offsetLeft) - radius + "px";
        circle.style.top = (event.clientY - panel.offsetTop) - radius + "px";
        
        Object.assign(circle.style, {
          pointerEvents: "none",
          borderRadius: "50%",
          backgroundColor: "white",
          position: "absolute",
          transform: "matrix(0.0001, 0, 0, 0.0001, 0, 0)",
          opacity: 0.5
        });

        requestAnimationFrame(() => {
          Object.assign(circle.style, {
            transition: "all 2s linear", 
            transform: "scale(10)",
            opacity: 0
          })
        });

        const restorePanelAfterDelay = (panel, circle) => {
          setTimeout(() => {
            if (circle.parentNode === panel) {
              panel.removeChild(circle);
            }
            setTimeout(() => {
              this.findChild("button").synchronizeDomNodeStyle(["maxWidth", "maxHeight", "overflow"]);
              this.inAnimation = false; 
            }, 0); 
          }, 300);
        }
        restorePanelAfterDelay(panel, circle);
      } else {
        this.inAnimation = false;
      }

      onClick(); 
    }

    // log(panel)

    if (onClick) {    
      panel.addEventListener("click", this.rippleAndCallback);
    }

    if (onClick && mouseOverBackgroundColor) {
      this.setMouseoverColor = () => {
        // log("<<setMouseoverColor>>");
        this.hover = true;
      }
      panel.addEventListener("mouseover", this.setMouseoverColor);

      this.removeMouseoverColor = () => {
        // log("<<removeMouseoverColor>>");
        this.hover = false;
      }
      panel.addEventListener("mouseout", this.removeMouseoverColor);
    }
  }
  
  build() {
    // log("REBUILDING BUTTON")
    const {style, onClick, disabled} = this;
    if (onClick) {
      style.cursor = "pointer";
    }
    let children; 
    
    if (this.children) {
      children = this.children;
    } else if (this.render) {
      children = this.render(); 
    }
    
    return button("button",
      children, 
      {
        disabled,
        style
      }
    );
  }
}
