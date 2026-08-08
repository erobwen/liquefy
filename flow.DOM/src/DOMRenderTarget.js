import { observable, transaction, workOnPriorityLevel } from "@liquefy/flow.core";
import { toProperties, extractProperty } from "@liquefy/flow.core";
import { RenderTarget, model } from "@liquefy/flow.core";
import { logMark } from "@liquefy/flow.core";
import { observePathChange } from "./pathobserver";

// import { clearNode } from "./DOMNode";

export const domNodeClassRegistry = {};
const log = console.log;

export function getDomRenderTargets() {
  return domRenderTargets;
}

export const domRenderTargets = [];

export function addDOMRenderTarget(target) {
  domRenderTargets.push(target)
}

export function removeDOMRenderTarget(target) {
  domRenderTargets.splice(domRenderTargets.indexOf(target), 1);
}

export class DOMRenderTarget extends RenderTarget {
  constructor(rootElement, configuration={}){
    if (!rootElement) throw new Error("No root element!");
    const {creator=null, fullWindow=true} = configuration;
    super();

    this.bounds = model({width: null, height: null})

    if (!this.key) this.key = configuration.key ? configuration.key : null;
    this.animate = typeof(configuration.animate) === "undefined" ? true : configuration.animate; 
    if (this.animate) addDOMRenderTarget(this);
    this.creator = creator;
    this.rootElement = rootElement;

    this.cleanupPathObserver = observePathChange(newPath => {
      // console.log("New path: " + newPath)
      if (this.component) {
        this.component.setProperty("path", newPath.split("/").filter(item => item.length > 0))
      }
    })

    if (fullWindow) {
      document.body.style.margin = "0px"; 
      document.body.style.width = "100%"; //window.innerWidth + "px"; 
      document.body.style.height = window.innerHeight + "px";
      this.rootElement.style.width = "100%";
      this.rootElement.style.height = "100%";
      this.rootElement.style.overflow = "hidden";
      this.bounds.width = window.innerWidth;
      this.bounds.height = window.innerHeight;
      window.addEventListener("resize", () => {
        if (document.body.style.height != window.innerHeight + "px")
          document.body.style.height = window.innerHeight + "px";
          transaction(() => {
            if (this.component) {
              this.component.bounds = {width: window.innerWidth, height: window.innerHeight}
              this.bounds.width = window.innerWidth;
              this.bounds.height = window.innerHeight;
            }
          });
      });
    }

    return observable(this, this.key);
  }

  toString() {
    return "[target]" + (this.component ? this.component.toString() : "null");
  }

  // renderComponent() {
  //   if (this.component) {
  //     component.setProperties({
  //       bounds: {width: window.innerWidth, height: window.innerHeight},
  //       path: window.location.pathname.split("/").filter(item => item.length > 0),
  //     })
  //     this.component.reactiveRender({renderTarget: this, givenDomNode: this.rootElement});
  //   }
  // }
  
  setContent(component) {
    // console.log("Render...")
    // console.warn("DOMRenderTarget.render is deprecated. Use buildComponent instead (will be renamed to render once all deprecations are removed)")
    component.bounds = {width: window.innerWidth, height: window.innerHeight}
    component.setProperties({
      bounds: {width: window.innerWidth, height: window.innerHeight},
      path: window.location.pathname.split("/").filter(item => item.length > 0),
    });
    this.component = component;
		component.reactiveRenderToTarget(this);
  }

  dispose() {
    super.dispose();
    this.cleanupPathObserver();
    if (this.animate) removeDOMRenderTarget(this);
  }

  primitive(properties) {
    const type = extractProperty(properties, "type");
    const DOMNodeClass = domNodeClassRegistry[type];
    if (!DOMNodeClass) throw Error("Unknown primitive type: " + type);
    return new DOMNodeClass(properties)
  }
}





  // setupModalDiv() {
  //   const div = document.createElement("div");
  //   div.id = "modal-div";
  //   div.style.position = "absolute";
  //   div.style.top = 0;
  //   div.style.left = 0;
  //   div.style.width = "100%";
  //   div.style.height = "100%";
  //   // div.style.opacity = 0;
  //   div.style.pointerEvents = "none";
  //   return div;
  // }

  // setModalFlow(component, close) {
  //   // Close existing
  //   if (this.modalFlow) {
  //     this.modalFlowClose();
  //   }

  //   // Setup modal component
  //   this.modalFlow = component;
  //   this.modalFlowClose = close; 
  //   const modalDiv = this.setupModalDiv();
  //   this.modalRenderTarget = new DOMRenderTarget(modalDiv, {creator: this});
  //   this.modalRenderTarget.setContent(this.modalFlow);

  //   // Display modal component
  //   this.state.modalDiv = modalDiv;
  // }

  // removeModalFlow(component) {
  //   if (this.modalFlow === component) {
  //     // Remove new component target, hide modal panel
  //     this.modalFlow = null;
  //     this.modalFlowClose = null;
  //     this.modalRenderTarget.dispose();
  //     this.modalRenderTarget = null;
  //     this.state.modalDiv = null;
  //   }
  // }
