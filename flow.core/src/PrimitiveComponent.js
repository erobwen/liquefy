import { withoutRecording, renderComponentTime, finalize, invalidateOnChange, repeat, state, trace, traceWarnings } from "./Flow.js";
import { Component } from "./Component.js";
import { logMark } from "./utility.js";

const log = console.log;

/**
 * A Primitive component corresponds to a single entity in the target. Such as a node in a web-browser.
 * A primitive component is typically created by the RenderContext.primitive() function that act as a service
 * locator pattern that make it possible for different RenderContext objects to have different sets of primitive
 * components. 
 */
export class PrimitiveComponent extends Component {
    
  findKey(key) {
    if (this.key === key) return this;
    return this.findChild(key)
  }

  findChild(key) {
    // TODO: Use iterator!
    if (this.children) {
      for (let child of this.children) {
        if (child !== null) {
          let result = child.findKey(key);
          if (result !== null) return result;
        }
      }
    }
    return null;
  }

  getPrimitive(parentPrimitive) {
    const peekParentPrimitive = withoutRecording(() => this.parentPrimitive); // It could be still the parent is expanding. We dont want parent dependent on child. This allows for change of parent without previous parent taking it back! 
    
    // Setup parent primitive
    if (parentPrimitive && peekParentPrimitive !== parentPrimitive) {
      if (peekParentPrimitive) {
        // log("PrimitiveComponent.getPrimitive");
        // TODO: Should this really be a warning? Normal behavior?
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + peekParentPrimitive.toString() + " --> " + parentPrimitive.toString());
      }
      this.parentPrimitive = parentPrimitive
    }

    return this;
  }

  ensureBuiltRecursive(flowRenderContext, parentPrimitive) {
    const name = this.toString(); // For chrome debugger
    const peekParentPrimitive = withoutRecording(() => this.parentPrimitive); // It could be still the parent is expanding. We dont want parent dependent on child. This allows for change of parent without previous parent taking it back! 
    
    if (flowRenderContext) this.visibleOnRenderContext = flowRenderContext;
    if (parentPrimitive && peekParentPrimitive !== parentPrimitive) {
      if (peekParentPrimitive) {
        // log("PrimitiveComponent.ensureBuiltRecursive");
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + peekParentPrimitive.toString() + " --> " + parentPrimitive.toString());
        if (parentPrimitive === this) throw new Error("What the fuck just happened. ");
      }
      this.parentPrimitive = parentPrimitive
    } 

    finalize(this); // Finalize might not work if no key was used, it might not call onEstablish.
    if (!this.expandRepeater) {
      this.expandRepeater = repeat(this.toString() + ".expandRepeater", repeater => {
        if (trace) console.group(repeater.causalityString());
        if (trace) console.log([...state.workOnPriorityLevel]);

        // Check visibility
        if (this.parentPrimitive) {
          if (this.parentPrimitive.childPrimitives && this.parentPrimitive.childPrimitives.includes(this)) {
            this.visibleOnRenderContext = this.parentPrimitive.visibleOnRenderContext;
          } else {
            this.visibleOnRenderContext = null;
            this.previousParentPrimitive = this.parentPrimitive;
            this.parentPrimitive = null;
          }
        }

        // Populate portals and stuff
        let scan = this.equivalentCreator; 
        while(scan) {
          if (scan.visibleOnRenderContext === this.visibleOnRenderContext) {
            scan = null; 
          } else {
            if (this.parentPrimitive && this.parentPrimitive !== scan.parentPrimitive) {
              if (this.parentPrimitive) {
                // log("PrimitiveComponent, scanning equivalent creators");
                if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
              }
              scan.parentPrimitive = this.parentPrimitive
            }         
            scan.parentPrimitive = this.parentPrimitive; 
            scan.visibleOnRenderContext = this.visibleOnRenderContext;
            scan.isVisible = !!this.visibleOnRenderContext
            scan.onVisibilityWillChange(scan.isVisible);
            scan = scan.equivalentCreator;
          }
        }

        // This will trigger getPrimitive on abstract child flows. 
        this.childPrimitives = this.getPrimitiveChildren();

        // Expand known children (do as much as possible before integration)
        for (let childPrimitive of this.childPrimitives) { 
          childPrimitive.ensureBuiltRecursive(flowRenderContext, this);
        }
      
        if (trace) console.groupEnd();
      }, {priority: renderComponentTime});
    }
    return this; 
  }
  
  onVisibilityWillChange() {}


  *iteratePrimitiveChildren() {
    for(let child of this.iterateChildren()) {
      let primitive = child.getPrimitive(this);
      if (primitive instanceof Array) {
        for (let fragment of primitive) { 
          yield fragment; 
        }
      } else {
        if (primitive) yield primitive;
      }
    }
  }

  getChildren() {
    return [...this.iterateChildren()];
  }

  getPrimitiveChildren() {
    return [...this.iteratePrimitiveChildren()];
  }

  render() {
    throw new Error("Internal Error: A primitive should never be built!");
  }

  inheritAnimation() {
    let result = this.inheritFromEquivalentCreator("animate"); 
  
    if (!result && this.parentPrimitive) {
      result = this.parentPrimitive.inheritFromEquivalentCreator("animateChildren");   
    }      
    
    if (!result && this.previousParentPrimitive) {
      result = this.previousParentPrimitive.inheritFromEquivalentCreator("animateChildren");   
    }
    
    if (result === true) result = this.getStandardAnimation();
    return result;
  }

  getStandardAnimation() {
    throw new Error("Not implemented yet");
  }

  getAnimation() {
    if (!this.cachedAnimation) {
      invalidateOnChange(
        () => {
          this.cachedAnimation = this.inheritAnimation();
        },
        () => {
          // logMark("deleting cache!!!!")
          delete this.cachedAnimation;
        }
      )
    } 
    return this.cachedAnimation; 
  }
}
  
