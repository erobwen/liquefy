import { observable, transaction, repeat, trace, workOnPriorityLevel } from "@liquefy/flow.core";
import { toProperties, extractProperty } from "@liquefy/flow.core";
import { RenderContext, model } from "@liquefy/flow.core";
import { logMark } from "@liquefy/flow.core";
import { observePathChange } from "./pathobserver";
import { updateDOMTime } from "@liquefy/flow.core/src/Flow";

// import { clearNode } from "./DOMNode";

export const domNodeClassRegistry = {};
const log = console.log;

export function getDomRenderContexts() {
  return domRenderContexts;
}

export const domRenderContexts = [];

export function addDOMRenderContext(target) {
  domRenderContexts.push(target)
}

export function removeDOMRenderContext(target) {
  domRenderContexts.splice(domRenderContexts.indexOf(target), 1);
}

export class DOMRenderContext extends RenderContext {
  constructor(rootElement, configuration={}){
    if (!rootElement) throw new Error("No root element!");
    const {creator=null, fullWindow=true} = configuration;
    super();

    this.bounds = model({width: null, height: null})

    if (!this.key) this.key = configuration.key ? configuration.key : null;
    this.animate = typeof(configuration.animate) === "undefined" ? true : configuration.animate; 
    if (this.animate) addDOMRenderContext(this);
    this.creator = creator;
    this.rootElement = rootElement;

    this.cleanupPathObserver = observePathChange(newPath => {
      // console.log("New path: " + newPath)
      if (this.component) {
        this.component.receiveProperty("path", newPath.split("/").filter(item => item.length > 0))
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
    // setTimeout(()=> {
    //   log("DIMENSIONS");
    //   log(this.rootElement.offsetHeight);
    //   log(this.rootElement.offsetWidth);
    //   log("---")
    //   log(this.rootElement.scrollHeight);
    //   log(this.rootElement.scrollWidth);
    // }, 0);
    // this.state = observable({
    //   modalDiv: null
    // });

    return observable(this, this.key);
  }

  toString() {
    return "[target]" + (this.component ? this.component.toString() : "null");
  }

  // renderComponent(Component) {
  //   super.render(new Component({
  //     path: new URL(window.location.href).pathname.split("/"),
  //     bounds: {width: window.innerWidth, height: window.innerHeight}
  //   }))
  // }

  // DEPRECATED
  render(component) {
    console.log("Render...")
    // console.warn("DOMRenderContext.render is deprecated. Use renderComponent instead (will be renamed to render once all deprecations are removed)")
    component.bounds = {width: window.innerWidth, height: window.innerHeight}
    component.receive({
      bounds: {width: window.innerWidth, height: window.innerHeight},
      path: window.location.pathname.split("/").filter(item => item.length > 0),
    }) 
    super.render(component);
  }

	ensureContentInPlace() {
		this.contentPlacementRepeater = repeat(this.toString() + ".contentPlacementRepeater", repeater => {
			if (trace) console.group(repeater.causalityString());

			// clearNode(this.rootElement);
			this.component.getPrimitive().givenDomNode = this.rootElement;
			workOnPriorityLevel(updateDOMTime, () => this.component.getPrimitive().ensureDomNodeBuilt());
			
			if (trace) console.groupEnd();
		}, {priority: updateDOMTime}); 
	}

  dispose() {
    super.dispose();
    this.cleanupPathObserver();
    if (this.animate) removeDOMRenderContext(this);
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
  //   this.modalRenderContext = new DOMRenderContext(modalDiv, {creator: this});
  //   this.modalRenderContext.render(this.modalFlow);

  //   // Display modal component
  //   this.state.modalDiv = modalDiv;
  // }

  // removeModalFlow(component) {
  //   if (this.modalFlow === component) {
  //     // Remove new component target, hide modal panel
  //     this.modalFlow = null;
  //     this.modalFlowClose = null;
  //     this.modalRenderContext.dispose();
  //     this.modalRenderContext = null;
  //     this.state.modalDiv = null;
  //   }
  // }
