import { observable, transaction, repeat, trace, workOnPriorityLevel } from "@liquefy/flow.core";
import { getFlowProperties, extractProperty } from "@liquefy/flow.core";
import { FlowTarget } from "@liquefy/flow.core";
import { logMark } from "@liquefy/flow.core";

// import { clearNode } from "./DOMNode";

export const domNodeClassRegistry = {};
const log = console.log;

export function getDomFlowTargets() {
  return domFlowTargets;
}

export const domFlowTargets = [];

export function addDOMFlowTarget(target) {
  domFlowTargets.push(target)
}

export function removeDOMFlowTarget(target) {
  domFlowTargets.splice(domFlowTargets.indexOf(target), 1);
}

export class DOMFlowTarget extends FlowTarget {
  constructor(rootElement, configuration={}){
    if (!rootElement) throw new Error("No root element!");
    const {creator=null, fullWindow=true} = configuration;
    super();

    if (!this.key) this.key = configuration.key ? configuration.key : null;
    this.animate = typeof(configuration.animate) === "undefined" ? true : configuration.animate; 
    if (this.animate) addDOMFlowTarget(this);
    this.creator = creator;
    this.rootElement = rootElement;
    if (fullWindow) {
      document.body.style.margin = "0px"; 
      document.body.style.width = "100%"; //window.innerWidth + "px"; 
      document.body.style.height = window.innerHeight + "px";
      this.rootElement.style.width = "100%";
      this.rootElement.style.height = "100%";
      this.rootElement.style.overflow = "hidden";
      window.addEventListener("resize", () => {
        if (document.body.style.height != window.innerHeight + "px")
          document.body.style.height = window.innerHeight + "px";
          transaction(() => {
            if (this.flow) {
              this.flow.bounds = {width: window.innerWidth, height: window.innerHeight}
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
    return "[target]" + (this.flow ? this.flow.toString() : "null");
  }

  setContent(flow) {
    flow.bounds = {width: window.innerWidth, height: window.innerHeight}
    super.setContent(flow);
  }

	ensureContentInPlace() {
		this.contentPlacementRepeater = repeat(this.toString() + ".contentPlacementRepeater", repeater => {
			if (trace) console.group(repeater.causalityString());

			// clearNode(this.rootElement);
			this.flow.getPrimitive().givenDomNode = this.rootElement;
			workOnPriorityLevel(2, () => this.flow.getPrimitive().ensureDomNodeBuilt());
			
			if (trace) console.groupEnd();
		}, {priority: 2}); 
	}

  dispose() {
    super.dispose();
    if (this.animate) removeDOMFlowTarget(this);
  }

  create(properties) {
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

  // setModalFlow(flow, close) {
  //   // Close existing
  //   if (this.modalFlow) {
  //     this.modalFlowClose();
  //   }

  //   // Setup modal flow
  //   this.modalFlow = flow;
  //   this.modalFlowClose = close; 
  //   const modalDiv = this.setupModalDiv();
  //   this.modalTarget = new DOMFlowTarget(modalDiv, {creator: this});
  //   this.modalTarget.setContent(this.modalFlow);

  //   // Display modal flow
  //   this.state.modalDiv = modalDiv;
  // }

  // removeModalFlow(flow) {
  //   if (this.modalFlow === flow) {
  //     // Remove new flow target, hide modal panel
  //     this.modalFlow = null;
  //     this.modalFlowClose = null;
  //     this.modalTarget.dispose();
  //     this.modalTarget = null;
  //     this.state.modalDiv = null;
  //   }
  // }
