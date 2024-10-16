import { extractProperty, getFlowPropertiesIncludingChildren, getRenderContext } from "@liquefy/flow.core";
import { DOMNode } from "./DOMNode";  
import { domNodeClassRegistry } from "./DOMRenderContext";
import { extractAttributes } from "./domNodeAttributes";
  
const log = console.log;


/**
 * Element Node
 */
export function elementNode(...parameters) {
  let properties = getFlowPropertiesIncludingChildren(parameters); 
  extractAttributes(properties);
  return getRenderContext().create({type: "elementNode", ...properties});
}


/**
 * DOM Flow RenderContext Primitive
 */
 export class DOMElementNode extends DOMNode {
  setProperties(properties) {
    this.attributes = extractProperty(properties, "attributes");
    this.children = extractProperty(properties, "children");
    this.animation = extractProperty(properties, "animation");

    const redundantProperties = Object.keys(properties);  
    if (redundantProperties.length > 0) 
      throw new Error("Unexpected keys in DOMNode properties: " + redundantProperties.join(", "));
  }

  initialUnobservables() {
    let result = super.initialUnobservables();
    result.previouslySetStyles = {};
    result.previouslySetAttributes = {};
    return result;
  }

  setProperties({children, tagName, attributes}) {
    this.children = children;
    this.tagName =  tagName ? tagName : "div";
    this.attributes = attributes ? attributes : {};
  }
  
  createEmptyDomNode() {
    const result = document.createElement(this.tagName);
    // console.log(this.toString() + ".createEmptyDomNode:");
    // console.log(result);
    return result;
  }
  
  ensureDomNodeAttributesSet() {
    const element = this.domNode;
    // console.log(this.toString() + ".ensureDomNodeAttributesSet:");
    // console.log(element);

    const newAttributes = this.attributes;
    const newPreviouslySetAttributes = {};
    if (this.tagName.toUpperCase() !== element.tagName) {
      throw new Error("Too high expectations error. Cannot change tagName of existing HTML element. Please do not change the tagName property once set!");
    }

    // Clear out styles that will no longer be modified
    for (let property in this.unobservable.previouslySetAttributes) {
      if (typeof(newAttributes[property]) === "undefined") {
        if (property === "style") {
          this.updateStyle(element, {}); // Clear style
        } else {
          element[property] = "";
        }
      }
    }

    // Set styles if changed
    for (let property in newAttributes) {
      const newValue = newAttributes[property];
      if (property === "style") {
        this.updateStyle(element, newValue);
      } else {
        // Note, only change if we have a new value. Alow for animation kit to set the value to something else while this code is unaware.  
        if (this.unobservable.previouslySetAttributes[property] !== newValue) {
          if (property === "class") {
            // TODO: Investigate why we had to use the setAttribute function for it to work with "class", is it the same with more attributes?
            element.setAttribute('class', newValue);
          } else {
            element[property] = newValue;
          }
        }
        newPreviouslySetAttributes[property] = newValue;  
      }
    }

    this.unobservable.previouslySetAttributes = newPreviouslySetAttributes; // Note: Causality will prevent this from self triggering repeater.
  }
  
  updateStyle(element, newStyle) {
    // console.group("update style...");
    const elementStyle = element.style;
    const newPreviouslySetStyles = {};
    // log({...this.unobservable.previouslySetStyles});
    // log({...newStyle})

    // Clear out styles that will no longer be modified
    for (let property in this.unobservable.previouslySetStyles) {
      if (typeof(newStyle[property]) === "undefined") {
        // log(this.toString() + " clear style: " + property);
        elementStyle[property] = "";
      }
    }

    // Set styles if changed
    for (let property in newStyle) {
      const newValue = newStyle[property];
      // Note, only change if we have a new value. Alow for animation kit to set the value to something else while this code is unaware.  
      if (this.unobservable.previouslySetStyles[property] !== newValue) {
        // log(this.toString() + " set style: " + property + " = " + newValue);
        elementStyle[property] = newValue;
      }
      newPreviouslySetStyles[property] = newValue;
    }
    // console.groupEnd();


    this.unobservable.previouslySetStyles = newPreviouslySetStyles; // Note: Causality will prevent this from self triggering repeater.     
  }

  // getAnimatedFinishStyles() {
  //   const style = (this.attributes && this.attributes.style) ? this.attributes.style : {};
  //   const animation = this.animation ? this.animation : this.getAnimation();
  //   return extractProperties(style, animation.animatedProperties);
  // }

  synchronizeDomNodeStyle(properties) {
    if (!properties) {
      properties = Object.keys(this.unobservable.previouslySetAttributes);
      log(properties);
    }
    if (!(properties instanceof Array)) properties = [properties];
    // log("synchronizeDomNodeStyle");
    const style = (this.attributes && this.attributes.style) ? this.attributes.style : {}; 

    const same = (styleValueA, styleValueB) => 
      (typeof(styleValueA) === "undefined" && typeof(styleValueB) === "undefined")
      || styleValueA === styleValueB; 

    for (let property of properties) {
      // log(property)
      if (typeof property === "string") {
        if (!same(style[property], this.domNode.style[property])) {
          // log("Synchronizing: " + this.toString() + ", style " + property + " mismatch, resetting: " + this.domNode.style[property] + " --> " + style[property]);
          this.domNode.style[property] = style[property] ? style[property] : "";
        }
      } else {
        const propertyCompoundValue = style[property.compound];

        if (propertyCompoundValue) {
          if (!same(propertyCompoundValue, this.domNode.style[property.compound])) {
            // log("Synchronizing: " + this.toString() + ", style " + property.compound + " mismatch, resetting: " + this.domNode.style[property.compound] + " --> " + propertyCompoundValue);
            this.domNode.style[property.compound] = propertyCompoundValue ? propertyCompoundValue : "";
          }
        } else {
          const propertyPartialValues = {}
          property.partial.forEach(property => {
            if (style[property]) {
              propertyPartialValues[property] = style[property];  
            }
          });

          if (Object.keys(propertyPartialValues).length > 0) {
            Object.assign(this.domNode.style, propertyPartialValues);
          } else {
            this.domNode.style[property.compound] = "";
          }
        }
      }
    }
  }
}

domNodeClassRegistry["elementNode"] = DOMElementNode;
