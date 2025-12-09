import { withoutRecording, buildComponentTime, finalize, invalidateOnChange, repeat, state, trace, traceWarnings } from "./Flow.js";
import { Component } from "./Component.js";
import { logMark } from "./utility.js";

const log = console.log;

/**
 * A Primitive component corresponds to a single entity in the target. Such as a node in a web-browser.
 * A primitive component is typically created by the RenderContext.primitive() function that act as a service
 * locator pattern that make it possible for different RenderContext objects to have different sets of primitive
 * components. 
 */
export class PrimitiveComponent extends Component { // Deprecated. To be deleted....
    
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

  buildPrimitive() {
    // const peekParentPrimitive = withoutRecording(() => this.renderParent); // It could be still the parent is expanding. We dont want parent dependent on child. This allows for change of parent without previous parent taking it back! 
    
    // // Setup parent primitive
    // if (renderParent && peekParentPrimitive !== renderParent) {
    //   if (peekParentPrimitive) {
    //     // log("PrimitiveComponent.getPrimitive");
    //     // TODO: Should this really be a warning? Normal behavior?
    //     if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + peekParentPrimitive.toString() + " --> " + renderParent.toString());
    //   }
      // this.renderParent = renderParent
    // }

    return this;
  }

  renderOnto(renderTarget, renderParent) {
    const name = this.toString(); // For chrome debugger
    // const peekParentPrimitive = withoutRecording(() => this.renderParent); // It could be still the parent is expanding. We dont want parent dependent on child. This allows for change of parent without previous parent taking it back! 
    
    if (renderTarget) this.visibleOnRenderContext = renderTarget;
    // if (renderParent && peekParentPrimitive !== renderParent) {
    //   if (peekParentPrimitive) {
    //     // log("PrimitiveComponent.renderOnto");
    //     if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + peekParentPrimitive.toString() + " --> " + renderParent.toString());
    //     if (renderParent === this) throw new Error("What the fuck just happened. ");
    //   }
      this.renderParent = renderParent
    // } 

    finalize(this); // Finalize might not work if no key was used, it might not call onEstablish.
    if (!this.renderRepeater) {
      this.renderRepeater = repeat(this.toString() + ".renderRepeater", repeater => {
        if (trace) console.group(repeater.causalityString());
        if (trace) console.log([...state.workOnPriorityLevel]);

        // Check visibility
        if (this.renderParent) {
          if (this.renderParent.childPrimitives && this.renderParent.childPrimitives.includes(this)) {
            this.visibleOnRenderContext = this.renderParent.visibleOnRenderContext;
            this.isVisible = !!this.visibleOnRenderContext
          } else {
            this.visibleOnRenderContext = null;
            this.previousParentPrimitive = this.renderParent;
            this.renderParent = null;
            this.isVisible = !!this.visibleOnRenderContext
          }
        }

        // Populate portals and stuff
        let scan = this.equivalentCreator; 
        while(scan) {
          if (scan.visibleOnRenderContext === this.visibleOnRenderContext) {
            scan = null; 
          } else {
            if (this.renderParent && this.renderParent !== scan.renderParent) {
              if (this.renderParent) {
                // log("PrimitiveComponent, scanning equivalent creators");
                if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.renderParent.toString() + " --> " + renderParent.toString());
              }
              scan.renderParent = this.renderParent
            }         
            scan.renderParent = this.renderParent; 
            scan.visibleOnRenderContext = this.visibleOnRenderContext;
            scan.isVisible = !!this.visibleOnRenderContext
            // scan.onVisibilityWillChange(scan.isVisible);
            scan = scan.equivalentCreator;
          }
        }

        // This will trigger getPrimitive on abstract child flows. 
        this.childPrimitives = this.getPrimitiveChildren();

        // Expand known children (do as much as possible before integration)
        for (let childPrimitive of this.childPrimitives) { 
          childPrimitive.renderOnto(renderTarget, this);
        }
      
        if (trace) console.groupEnd();
      }, {priority: buildComponentTime});
    }
    // return this; 
  }

  *iteratePrimitiveChildren() {
    for(let child of this.iterateChildren()) {
      let primitive = child.buildPrimitive();
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

  build() {
    throw new Error("Internal Error: A primitive should never be built!");
  }

  inheritAnimation() {
    let result = this.inheritFromEquivalentCreator("animate"); 
  
    if (!result && this.renderParent) {
      result = this.renderParent.inheritFromEquivalentCreator("animateChildren");   
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
  
