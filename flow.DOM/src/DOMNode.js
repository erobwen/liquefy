import { repeat, trace, finalize, traceWarnings } from "@liquefy/flow.core";
import { PrimitiveComponent } from "@liquefy/flow.core";
import { logMark } from "@liquefy/flow.core";

import { standardAnimation } from "./ZoomFlyDOMTransitionAnimation";
import { updateTargetTime } from "../../flow.core/src/Flow";

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
      // Dont display render context primitive.       
      id.unshift(scan.toString());
    // }
    scan = scan.equivalentCreator;
  }
  return id.join(" | ");
}

// export const movedPrimitives = [];
// window.moved = movedPrimitives;

export function clearNode(node) {
  while (node.childNodes.length > 0) {
    node.removeChild(node.lastChild);
  }
}


function updateChildren(parent, newChildren) {
  const oldChildren = Array.from(parent.childNodes);
  const commonLength = Math.min(oldChildren.length, newChildren.length);

  // Step 1: Update existing positions
  for (let i = 0; i < commonLength; i++) {
    const oldNode = oldChildren[i];
    const newNode = newChildren[i];

    if (oldNode !== newNode) {
      parent.insertBefore(newNode, oldNode);
    }
  }

  // Step 2: Append any new nodes
  for (let i = commonLength; i < newChildren.length; i++) {
    parent.appendChild(newChildren[i]);
  }

  // Step 3: Remove extra old nodes
  for (let i = commonLength; i < oldChildren.length; i++) {
    parent.removeChild(oldChildren[i]);
  }
}

function removeSuccessors(container, node) {
  let next = node.nextSibling;
  while (next) {
    const toRemove = next;
    next = next.nextSibling;
    container.removeChild(toRemove);
  }
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

  observeableRender(renderContext) { finalize(this);

    this.setContext(renderContext);
 
    if (!this.renderDOMRepeater) {
      //                       repeat(mostAbstractComponent(this).toString() + ".renderDOMRepeater", (repeater) => {
      this.renderDOMRepeater = repeat("[" + aggregateToString(this) + "].renderDOMRepeater", (repeater) => {
        // if (trace) console.group(repeater.causalityString());

        this.verifyVisibility(this.renderContext.primitiveContainer);
        
        const { renderTarget, givenDOMNode } = this.renderContext;
        this.givenDOMNode = givenDOMNode;
        let domNode = this.ensureDomNodeExists();
        this.ensureDomNodeAttributesSet();

        // Render first pass.
        let childDOMNodes = [].concat(...this.children.map(
          child => child.observeableRender({ firstPass: true, renderTarget, primitiveContainer: this }).domNode
        ));

        // Update children, some domNodes are dummys.
        updateChildren(domNode, childDOMNodes);

        // More passes to complete incomplete children.
        while (this.children.reduce((result, child) => result || child.renderResult.renderingDelayed, false)) {
          // Render second pass. Note: Some children fully renders only on second pass, so they can measure their bounds.
          this.children.map(child => child.observeableRender({ firstPass: false, renderTarget, primitiveContainer: this }));
        }

        // Just return a DOM node. 
        this.renderResult = { domNode };
        // if (trace) console.groupEnd();  

      }, {priority: updateTargetTime});
    }

    return this.renderResult;
  }

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
    try {

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
    } catch (error) {
      if (traceWarnings) console.warn("Error in dimensions: " + error.message);
      // console.error(error);
      return {width: 0, height: 0, widthIncludingMargin: 0, heightIncludingMargin: 0, widthWithoutMargin: 0, heightWithoutMargin: 0};
    }
  }
  
  reactiveBoundingClientRect() {
    if (!this.key && traceWarnings) console.warn("It is considered unsafe to use dimensions on a flow without a key. The reason is that a call to dimensions from a parent build function will finalize the flow early, and without a key, causality cannot send proper onEstablish event to your flow component before it is built");
    const unobservable = this.unobservable; 
    const domNode = this.observeableDomNode();

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

  observeableDomNode() {
    this.ensureDomNodeBuilt();
    return this.domNode; 
  }
  
  createEmptyDomNode() {
    throw new Error("Not implemented yet!");
  }


  getChildNodes() {
    return this.getPrimitiveChildren().map(child => child.ensureDomNodeBuilt())
  }

  ensureDomNodesExists() {
    return [this.ensureDomNodeExists()];
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
      }, {priority: updateTargetTime});
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



