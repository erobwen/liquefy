import { repeat, trace, finalize, traceWarnings } from "@liquefy/flow.core";
import { PrimitiveComponent } from "@liquefy/flow.core";
import { logMark } from "@liquefy/flow.core";

import { standardAnimation } from "./ZoomFlyDOMTransitionAnimation";
import { updateDOMTime } from "../../flow.core/src/Flow";

const log = console.log;

export function mostAbstractComponent(flow) {
  while (flow.equivalentCreator) flow = flow.equivalentCreator;
  return flow; 
}

export function aggregateToString(flow) {
  let id = [];
  let scan = flow;
  while (scan) {
    // if (!(scan instanceof RenderContextPrimitive)) {
      // Dont display flow target primitive.       
      id.unshift(scan.toString());
    // }
    scan = scan.equivalentCreator;
  }
  return id.join(" | ");
}

// export const movedPrimitives = [];
// window.moved = movedPrimitives;

export function clearNode(node, attributes) {
  while (node.childNodes.length > 0) {
    node.removeChild(node.lastChild);
  }
  // for (let attribute in attributes) {
  //   if (attribute === "style") {
  //     for () {

  //     }
  //     node.style
  //   }
  // }
}

export function getHeightIncludingMargin(node) {
  var styles = window.getComputedStyle(node);
  var margin = parseFloat(styles['marginTop']) +
               parseFloat(styles['marginBottom']);

  return Math.ceil(node.offsetHeight + margin);
}

export function getWidthIncludingMargin(node) {
  var styles = window.getComputedStyle(node);
  var margin = parseFloat(styles['marginLeft']) +
               parseFloat(styles['marginRight']);
  return Math.ceil(node.offsetWidth + margin);
}



/**
 * DOM Node
 */
 export class DOMNode extends PrimitiveComponent {

  onDispose() {
    const unobservable = this.unobservable; 
    if (unobservable.resizeObserver && typeof(unobservable.resizeObserver.dissconnect) === "function") {
      unobservable.resizeObserver.dissconnect();
      unobservable.mutationObserver.dissconnect();
      window.removeEventListener('scroll', unobservable.updateBoundingClientRect, true);
      window.removeEventListener('scroll', unobservable.updateBoundingClientRect, true);
      delete unobservable.boundingClientRect;
      delete unobservable.resizeObserver;
      delete unobservable.mutationObserver;
      delete unobservable.updateBoundingClientRect; 
    }
    super.onDispose()
  }


  // TODO: Make this respond with observable dimensions, and set up DOM event listeners. 
  dimensions(contextNode) {
    //TODO: Research a way to isolate the reflow used in dimensions to a wecomponent?
    if (traceWarnings) console.warn("Calls to dimensions() could lead to performance issues as it forces a reflow to measure the size of a dom-node. Note that transition animations may use dimensions() for measuring the size of added nodes"); 
    let domNode = this.ensureDomNodeBuilt();
    let alreadyInContext;
    if (contextNode) { 
      alreadyInContext = domNode.parentNode === contextNode;
      if (!alreadyInContext) {
        // log("Deep cloing and appending child to context... ");
        domNode = domNode.cloneNode(true);
        contextNode.appendChild(domNode);
      } else {
        // log("No need for cloning, node already in context")
      }
    } else {
      domNode = domNode.cloneNode(true);
      domNode.style.position = "absolute"; 
      domNode.style.top = "0";
      domNode.style.left = "0";
      if (domNode.style.width === "") {
        domNode.style.width = "auto";
      }
      if (domNode.style.height === "") {
        domNode.style.height = "auto";
      }
      document.body.appendChild(domNode); 
      // Consider: Will this disconnect the dom node if done on an already placed domNode? 
      // log("No context, deep cloing and appending child to document... ");
    }
  
    // domNode.offsetWidth 
    const result = {
      width: getWidthIncludingMargin(domNode), 
      height: getHeightIncludingMargin(domNode),

      widthIncludingMargin: getWidthIncludingMargin(domNode), 
      heightIncludingMargin: getHeightIncludingMargin(domNode),
      
      widthWithoutMargin: domNode.offsetWidth,
      heightWithoutMargin: domNode.offsetHeight
    }; 

    // const original = this.ensureDomNodeBuilt()
    // log("dimensions " + this.toString() + " : " +  result.width + " x " +  result.height);
    // log(original);
    // debugger;
    // log("dimensions clone")
    // log(domNode);
    // log(domNode.offsetWidth);
    // log(domNode.parentNode);
    // log(domNode.parentNode.offsetWidth);

    if (contextNode) {
      if (!alreadyInContext) {
        contextNode.removeChild(domNode);
      }
    } else {
      document.body.removeChild(domNode);
    }
    return result; 
  }
  
  reactiveBoundingClientRect() {
    if (!this.key && traceWarnings) console.warn("It is considered unsafe to use dimensions on a flow without a key. The reason is that a call to dimensions from a parent build function will finalize the flow early, and without a key, causality cannot send proper onEstablish event to your flow component before it is built");
    const unobservable = this.unobservable; 
    const domNode = this.getDomNode();

    function updateBoundingClientRect() {
      // console.log("updateBoundingClientRect");
      const clientRect = domNode.getBoundingClientRect();
      // console.log(clientRect);
      // Object.assign(unobservable.boundingClientRect, clientRect);
      unobservable.boundingClientRect.x = clientRect.x;
      unobservable.boundingClientRect.y = clientRect.y;
      unobservable.boundingClientRect.top = clientRect.top;
      unobservable.boundingClientRect.left = clientRect.left;
      unobservable.boundingClientRect.bottom = clientRect.bottom;
      unobservable.boundingClientRect.right = clientRect.right;
      unobservable.boundingClientRect.width = clientRect.width;
      unobservable.boundingClientRect.height = clientRect.height;
    }

    if (!unobservable.boundingClientRect) {
      // console.log("INITIALIZE")
      // Initialize bounding client rect.
      const clientRect = domNode.getBoundingClientRect();
      unobservable.boundingClientRect = model({
        x: clientRect.x,
        y: clientRect.y,
        top: clientRect.top,
        left: clientRect.left,
        right: clientRect.right,
        bottom: clientRect.bottom,
        width: clientRect.width,
        height: clientRect.height
      })

      // Resize observer
      unobservable.resizeObserver = new ResizeObserver(updateBoundingClientRect);
      unobservable.resizeObserver.observe(domNode)

      // MutationObserver for layout-affecting DOM changes
      unobservable.mutationObserver = new MutationObserver(updateBoundingClientRect);
      unobservable.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });

      // Scroll and resize listeners
      unobservable.windowScrollListener = window.addEventListener('scroll', updateBoundingClientRect, true);
      unobservable.windowResizeListener = window.addEventListener('resize', updateBoundingClientRect);
    }

    return unobservable.boundingClientRect; 
  }

  getDomNode() {
    this.ensureDomNodeBuilt();
    return this.domNode; 
  }
  
  ensureDomNodeBuilt() {
    finalize(this);
    if (!this.buildDOMRepeater) {
      // this.buildDOMRepeater = repeat(mostAbstractComponent(this).toString() + ".buildDOMRepeater", (repeater) => {
      this.buildDOMRepeater = repeat("[" + aggregateToString(this) + "].buildDOMRepeater", (repeater) => {
        // if (trace) console.group(repeater.causalityString());
        
        this.ensureDomNodeExists();
        this.ensureDomNodeAttributesSet();
        this.ensureDomNodeChildrenInPlace();
        
        // if (trace) console.groupEnd();  
      }, {priority: updateDOMTime});
    }
    return this.domNode;
  }

  createEmptyDomNode() {
    throw new Error("Not implemented yet!");
  }

  ensureDomNodeChildrenInPlace() {// But do not change style for animated children!
    // log("ensureDomNodeChildrenInPlace " + this.toString());
    // Impose animation. CONSIDER: introduce this with more general mechanism?
    if (this.attributes && this.attributes.innerHTML) return; 
    const node = this.domNode;
    if (!(node instanceof Element)) return;
    
    // Get new children list, this is the target
    const newChildren = this.getPrimitiveChildren(node);
    const newChildNodes = newChildren.map(child => child.ensureDomNodeBuilt()).filter(child => !!child);


    // Nodes wrapped in a leader or trailer, should maintain their wrapper during this operation. 
    // Note: trailer, leader and isControlledByAnimation is actually support for DOMAnimation, but this support is needed here. Consider ways to factor this out to flow.DOMAnimation if possible?
    let index = 0;
    while (index < newChildNodes.length) {
      // log("scanning.....");
      const child = newChildNodes[index];
      // log(child.isControlledByAnimation);
      if (child.leader && child.parentNode === child.leader && child.leader.parentNode === node) {
        // logMark("wrapped in leader")
        newChildNodes[index] = child.leader;
      }
      if (child.trailer && child.parentNode === child.trailer && child.trailer.parentNode === node) {
        // logMark("wrapped in trailer")
        newChildNodes[index] = child.trailer;
      }
      index++;
    }
        
    // Recover other nodes
    const recoveredNodes = [];
    for(let existingChildNode of node.childNodes) {
      if (existingChildNode.isControlledByAnimation) {
        // Animation nodes are controlled by animations, leave them in.
        recoveredNodes.push(existingChildNode);
      } else {
        // Keep nodes that are in new children list
        if (newChildNodes.includes(existingChildNode)) {
          recoveredNodes.push(existingChildNode);
        } 
      }
    }

    // Link recovered nodes to get their relative positions:
    let anchor = null; 
    recoveredNodes.forEach(node => {node.anchor = anchor; anchor = node; });

    // Merge old with new
    function insertAfter(array, reference, element) {
      array.splice(array.indexOf(reference) + 1, 0, element);
    }
    recoveredNodes.forEach(node => {
      if (!newChildNodes.includes(node)) {
        let anchor = node.anchor;
        while (!newChildNodes.includes(anchor) && anchor) anchor = anchor.anchor; // Maybe not necessary. 
        if (!anchor) {
          newChildNodes.unshift(node);
        } else {
          insertAfter(newChildNodes, anchor, node);
        }
      }
    })

    // Removing pass, will also rearrange moved elements.
    index =  node.childNodes.length - 1;
    while(index >= 0) {
      const existingChildNode = node.childNodes[index];
      // Consider: Do we need test for Element and Text ?
      if ((existingChildNode instanceof Element || existingChildNode instanceof Text) && !newChildNodes.includes(existingChildNode)) {
        node.removeChild(existingChildNode);
      }
      index--;
    }

    // Adding pass, will also rearrange moved elements
    index = 0;
    while(index < newChildNodes.length) {
      const newChildNode = newChildNodes[index];
      const existingChildNode = node.childNodes[index]; 
      if (existingChildNode) {
        const existingWrappedNode = node.childNodes[index];
        if (newChildNode !== existingWrappedNode) {
          node.insertBefore(newChildNode, existingChildNode);
        }
      } else {
        node.appendChild(newChildNode);
      }
      index++;
    }
  }

  getChildNodes() {
    return this.getPrimitiveChildren().map(child => child.ensureDomNodeBuilt())
  }

  ensureDomNodeExists() { 
    if (!this.createElementRepeater) {
      this.createElementRepeater = repeat(mostAbstractComponent(this).toString() + ".createElementRepeater", (repeater) => {
        if (trace) log(repeater.causalityString());

        if (this.givenDomNode) {
          clearNode(this.givenDomNode);
          this.domNode = this.givenDomNode;
          this.domNode.setAttribute("class", aggregateToString(this));
          this.domNode.equivalentCreator = this; 
        } else {
          // Create empty dom node
          this.domNode = this.createEmptyDomNode();
          this.domNode.id = aggregateToString(this);
          this.domNode.equivalentCreator = this; 
          // this.domNode.id = mostAbstractComponent(this).toString()
          
          // Decorate all equivalent flows
          let scanFlow = this.equivalentCreator;
          while (scanFlow != null) {
            scanFlow.domNode = this.domNode;
            scanFlow = scanFlow.equivalentCreator;
          }
        }

        if (trace) log(this.domNode);
      }, {priority: updateDOMTime});
    }
    return this.domNode;
  }

  ensureDomNodeAttributesSet() {
    // Ensure dom node attributes set. This method assumes that no one else has messed with the dom node. 
    throw new Error("Not implemented yet!");
  }

  synchronizeDomNodeStyle(properties) {
    // Enforce writing of all dom node style to the dom. This is used when the dom node is out of sync with the flow, for example after a halted animation.  
    throw new Error("Not implemented yet!");
  }

  getStandardAnimation() {
    // return null;
    return standardAnimation; 
  }
}



