import { draw, insertAfter, extractProperties, logMark } from "@liquefy/flow.core";

import { camelCase, changeType, componentChanges, freezeComponentChanges, sameBounds, unfreezeComponentChanges } from "./DOMAnimation";
// import { movedPrimitives } from "./DOMNode";
import { DOMTransitionAnimation } from "./DOMTransitionAnimation";

const log = console.log;

let animationTime = 1;

export function setAnimationTime(value) {
  animationTime = value; 
}

/**
 * Inherited style properties
 * 
 * Properties that might be dependent on the outer div, so we need to maintain them while inside a leader
 */
const inheritedProperties = ["fontSize", "lineHeight", "margin", "padding", "color"];

export class ZoomFlyDOMTransitionAnimation extends DOMTransitionAnimation {
  /**
   * Configuration
   */
  animateLeaderWidth = true; 
  animateLeaderHeight = true;

  /**
   * Default transitions
   */
  defaultTransition() {
    return `all ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(1, 0, 0.42, 0.93)`
  }

  addedTransition() {
    return `transform ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(1, 0, 0.42, 0.93)`
  }

  leaderTransition() {
    return `width ${animationTime}s ease-in-out, height ${animationTime}s ease-in-out`
  }

  removeTransition() {
    // return `all ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(0.33, 0.05, 0, 1)`
    return `all ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(.08,.72,.15,1.01)`
  }

  /**
   * Dimensions helper
   */

  getDimensionsIncludingMargin(node) {
    const bounds = node.getBoundingClientRect();
    const style = getComputedStyle(node); 
    return this.calculateDimensionsIncludingMargin(bounds, style);
  }
  
  calculateDimensionsIncludingMargin(bounds, style) {
    const dimensions = {
      marginTop: parseInt(style.marginTop, 10),
      marginBottom: parseInt(style.marginBottom, 10),
      marginLeft: parseInt(style.marginLeft, 10),
      marginRight: parseInt(style.marginRight, 10),
      width: bounds.width,
      height: bounds.height
    }
    dimensions.widthWithoutMargin = dimensions.width; 
    dimensions.heightWithoutMargin = dimensions.height; 
    dimensions.heightIncludingMargin = dimensions.height + dimensions.marginTop + dimensions.marginBottom;
    dimensions.widthIncludingMargin = dimensions.width + dimensions.marginLeft + dimensions.marginRight;
    return dimensions; 
  }

  
  /**
   * General helpers
   */



  repurposeOwnLeaderAsTrailer(node) {
    // log("repurposeOwnLeaderAsTrailer");
    const leader = node.leader; 
    
    delete node.leader;
    delete node.wrapper;
    // leader.removeEventListener("transitionend", leader.hasCleanupEventListener);
    delete leader.hasCleanupEventListener;
    
    // Disconnect previous trailer
    if (node.trailer) {
      delete node.trailer.owner;
      delete node.trailer;
    }

    const trailer = leader; 
    if (trailer.owner !== node) throw new Error("unexpected owner"); 
    node.trailer = trailer; 
    return trailer;
  }

  repurposeOwnTrailerWrapperAsLeader(node) {
    // log("repurposeOwnTrailerWrapperAsLeader");
    const trailer = node.trailer; 
    
    delete node.trailer;
    trailer.removeEventListener("transitionend", trailer.hasCleanupEventListener);
    delete trailer.hasCleanupEventListener;
    
    // Disconnect previous leader
    if (node.leader) {
      delete node.leader.owner;
      delete node.leader;
      delete node.wrapper;
    }

    const leader = trailer; 
    if (leader.owner !== node) throw new Error("unexpected owner"); 
    node.leader = leader; 
    node.wrapper = leader; 
    return leader;
  }

  repurposeTrailerAsLeader(trailer, node) {
    // log("repurposeTrailerAsLeader");
    
    // Dissconnect trailer (it could be from another node)
    if (trailer.owner)  {
      delete trailer.owner.trailer;
      delete trailer.owner; 
    }
    
    trailer.removeEventListener("transitionend", trailer.hasCleanupEventListener);
    delete trailer.hasCleanupEventListener;
    
    // Disconnect previous leader
    if (node.leader) {
      delete node.leader.owner;
      delete node.leader;
      delete node.wrapper;
    }

    const leader = trailer;
    leader.id = "leader";
    node.leader = leader; 
    node.wrapper = leader; 
    leader.owner = node;
    return leader;
  }

  createNewTrailer(node) {
    const trailer = this.createNewTrailerOrLeader();
    trailer.id = "trailer";
    if (node.trailer) throw new Error("should not have a trailer!")

    node.trailer = trailer; 
    trailer.owner = node;
    return trailer;      
  }
  
  createNewLeader(node) {
    const leader = this.createNewTrailerOrLeader();
    leader.id = "leader";
    if (node.leader) throw new Error("should not have a leader!")

    node.leader = leader;
    node.wrapper = leader; 
    leader.owner = node;
    return leader;      
  }

  createNewTrailerOrLeader(id) {
    // Create a new leader
    const trailerOrLeader = document.createElement("div");
    trailerOrLeader.isControlledByAnimation = true; 
    setStyleProperty(trailerOrLeader, "position", "relative");
    setStyleProperty(trailerOrLeader, "overflow", "visible");
    // trailerOrLeader.style.position = "relative";
    // trailerOrLeader.style.overflow = "visible";
    return trailerOrLeader; 
  }

  hide(node) {
    // node.style.display = "none"; // For now! this will be removed after measuring target bounds.
    setStyleProperty(node, "display", "none");  
  }

  show(node) {
    // node.style.display = ""; // For now! this will be removed after measuring target bounds.  
    setStyleProperty(node, "display", "");
  }

  /**
   * Debugging
   */
  changesChain(component) {
    let result = ""; 
    result += component.domNode.ongoingAnimation ? "[ongoing] " : "";
    let changes = component.changes; 
    while(changes) {
      const separator = (result === "" ? "" : ", "); 
      result += (separator + changes.type)
      changes = changes.previous;
    }
    return result; 
  }


  /**
   * -------------------------------------------------------------------------------------
   * 
   *                               Animation chain
   * 
   * -------------------------------------------------------------------------------------
   */

  startAnimationChain(node) {
    node.ongoingAnimation = this; 
    freezeComponentChanges();
  }

  endAnimationChain(node) {        
    // Remove changes.
    if (node.ongoingAnimation) {
      delete node.isControlledByAnimation;
      delete node.ongoingAnimation;
      if (node.changes) {
        node.changes.finished = true; 
        const component = node.equivalentCreator;
        component.changes = null;
        node.changes = null;
      }
      //if (node.changes.type !== changeType.resident) 
      requestAnimationFrame(() => {
        unfreezeComponentChanges();
      })
    }
  }


  /**
   * -------------------------------------------------------------------------------------
   * 
   *                               Record original bounds
   * 
   * -------------------------------------------------------------------------------------
   */

  /**
   * Record original bounds, before anything in the dome has changed
   * Bounds do not include margin. See this:  
   * https://stackoverflow.com/questions/50657526/does-getboundingclientrect-width-and-height-includes-paddings-and-borders-of-e
   * Also offset width and height do not include margin. 
   */
  recordOriginalBoundsAndStyle(component) {
    // console.group("Record original bounds and style for " + this.changesChain(component) + ": " + component.toString());
    const node = component.domNode; 

    // Bounds (excludes margins)
    node.changes.originalBounds = node.getBoundingClientRect();
  
    // Styles
    node.changes.originalStyle = {...node.style}
    node.changes.computedOriginalStyle = {...getComputedStyle(node)}; // TODO: Remove or optimize if not needed fully. 

    // Dimensions (with and without margins)
    node.changes.originalDimensions = this.calculateDimensionsIncludingMargin(node.changes.originalBounds, node.changes.computedOriginalStyle);
    console.groupEnd();

    // Note: Computed original style is not allways correct here. It might not reflect the current state of an ongoing animation. 
  }
  

  /**
   * -------------------------------------------------------------------------------------
   * 
   *                               Prepare for DOM building
   * 
   * -------------------------------------------------------------------------------------
   */

  /**
   * Prepare for DOM building. 
   */
  prepareForDOMBuilding(component) {

    // Attempt to halt transition animation by setting the end style. 
    // if (component.changes.changeType !== changeType.resident) component.domNode.style = component.changes.originalStyle;

    // console.group("Prepare for DOM building for " + this.changesChain(component) + ": " + component.toString());
    const node = component.domNode;
    // log("trailer: " + node.trailer);

    // Add trailers for removed to keep a reference of their position, since dom building will remove them. 
    switch (component.changes.type) {
      case changeType.moved:
      case changeType.removed:
        delete node.isControlledByAnimation; // Make sure dom building removes these nodes
        this.addTrailersForMovedAndRemovedBeforeDomBuilding(node, component.changes.type);
        if (changeType.moved) node.trailer.canBeRepurposed = true;         
        // log(`trailer: `);
        // log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
        break;
    }

    // Prepare added and moved for correct target size measurement (in case they are in a chained animation) 
    switch (component.changes.type) {
      case changeType.added:
      case changeType.moved:
        delete node.isControlledByAnimation; // Make sure dom building adds and moves these nodes
        this.neutralizeTransformationsAndPosition(component, node);
        component.synchronizeDomNodeStyle(inheritedProperties);
        break;
    }

    // Prevent DOM building from touching resident nodes that are inside leaders, moving towards their target.
    // They might have started their movement in a previous animation frame. 
    if (component.changes.type === changeType.resident) {
      if (node.leader) {
        node.isControlledByAnimation = true; 
      }
    }
    console.groupEnd();    
  }

  addTrailersForMovedAndRemovedBeforeDomBuilding(node, changeType) {
    let trailer; 
    
    if (node.leader && node.leader === node.parentNode && node.parentNode.isControlledByAnimation) {
      // Repurpose existing leader as trailer.
      trailer = this.repurposeOwnLeaderAsTrailer(node);
      fixateWidthAndHeight(trailer);
    } else {
      // Create new trailer.
      trailer = this.createNewTrailer(node);

      // Note: We set width/height at this point because here we know if the leader was reused or not. If we do it later, we wont know that.  
      // trailer.style.width = node.changes.originalDimensions.widthIncludingMargin + "px"; // This will not be in effect until display != none  
      // trailer.style.height = node.changes.originalDimensions.heightIncludingMargin + "px";
      setStyleProperty(trailer, "width", node.changes.originalDimensions.widthIncludingMargin + "px");
      setStyleProperty(trailer, "height", node.changes.originalDimensions.heightIncludingMargin + "px");
      insertAfter(trailer, node);
    }

    // We hide it for now, to get more accurate target measures, as if removed and moved nodes has already moved out of their place
    this.hide(trailer);

    // Set wrapper
    switch (changeType) {
      case changeType.removed:
        node.wrapper = trailer
        break;
      case changeType.moved:
        delete node.wrapper
        break;
    }

    // Debugging
    // trailer.style.backgroundColor = "rgba(170, 170, 255, 0.5)";
  }
  
  neutralizeTransformationsAndPosition(component) {
    component.synchronizeDomNodeStyle(["position", "transform", "width", "height"]);
  }


  /**
   * -------------------------------------------------------------------------------------
   * 
   *                               Measure target sizes for leaders
   *                               (should include final size and margins)
   * 
   * -------------------------------------------------------------------------------------
   */

  /**
   * DOM just rebuilt, it could be a good idea to measure target sizes at this stage, 
   * since it is the closest we will be to the actual end result. 
   * However, removed nodes are still present at this point... maybe we should ensure added leaders for removed ones start out minimized?
   * Trailers should also be minimized at this point.
   */
  domJustRebuiltMeasureTargetSizes(component) {
    // console.group("Measure target size for " + this.changesChain(component) + ": " + component.toString());
    const node = component.domNode;
    // log("trailer: " + node.trailer);
    
    switch (component.changes.type) {
      case changeType.added:
        if (component.changes.previous && component.changes.previous.type === changeType.removed) {
          const removeChange = component.changes.previous; 
          node.changes.targetBounds = removeChange.originalBounds;
          node.changes.targetStyle = removeChange.originalStyle;
          node.changes.computedRenderContextStyle = removeChange.computedOriginalStyle; 
          node.changes.targetDimensions = removeChange.originalDimensions;
          break;
        }

      case changeType.resident:
      case changeType.moved:
        // Bounds (excludes margins)
        node.changes.targetBounds = node.getBoundingClientRect();

        // if (node.trailer) {
        //   log(`trailer: `);
        //   logProperties(node.trailer.style, this.typicalAnimatedProperties);
        // }        
      
        // Styles
        node.changes.targetStyle = {...node.style}
        node.changes.computedRenderContextStyle = {...getComputedStyle(node)}; // TODO: Remove or optimize if not needed fully. 

        // Dimensions (with and without margins)
        node.changes.targetDimensions = this.calculateDimensionsIncludingMargin(node.changes.targetBounds, node.changes.computedRenderContextStyle);
    }
    console.groupEnd();
  }

  // Note: There could be resident nodes moving around and changing size. We cant do anything about it. Shoulw we try to emulate their end state?
  // But then again, their end state might occur at a different point in time from the end of this target. So... 
  // It might be impossible to get the correct target size for every situation. It just aims to be good enough.


  /**
   * -------------------------------------------------------------------------------------
   * 
   *                  Emulate original footprints and fixate animated style
   * 
   * -------------------------------------------------------------------------------------
   */


  /**
   * Emulate the original styles and footprints of all animated
   * nodes. This is for a smooth transition from their original position. 
   */
  emulateOriginalFootprintsAndFixateAnimatedStyle(component) {
    // console.group("Emulate original style and footprints for " + this.changesChain(component) + ": " + component.toString());
    const node = component.domNode;
    const trailer = node.trailer;
    // log("trailer: " + node.trailer);

    // Setup leaders, typically deflated unless an existing leader/trailer can be reused.
    switch (component.changes.type) {
      case changeType.added: 
      case changeType.moved: 
        this.setupALeaderForIncomingWithOriginalFootprint(node);
        break; 
    }

    // Make trailers visible, they should already have original sizes.
    switch (component.changes.type) {
      case changeType.removed:
        // Add back to trailer if not already here
        if (node.parentNode !== trailer) {
          trailer.appendChild(node); 
        }
        if (trailer) this.show(trailer);
        break; 
      case changeType.moved: 
        if (trailer) this.show(trailer);
        break;
    }

    // Set original styles
    // log("ongoingAnimation: " + node.ongoingAnimation)
    if (node.ongoingAnimation) {
      // log("ongoing animation...");
      this.fixateOriginalInheritedStyles(node);
      switch (component.changes.type) {
        case changeType.resident:
          break;
        case changeType.added: 
          this.fixateOriginalTransformAndOpacity(node);
          break; 
        case changeType.removed: 
          this.fixateOriginalTransformAndOpacity(node);
          break;
        case changeType.moved: 
          this.fixateOriginalTransformAndOpacity(node);
          break;
      }
    } else {
      // log("new animation...");
      switch (component.changes.type) {
        case changeType.resident:
          break;
        case changeType.added: 
          this.originalPositionForZoomIn(node);
          break; 
        case changeType.removed: 
          this.originalPositionForZoomOut(node);
          break;
        case changeType.moved: 
          this.fixateOriginalInheritedStyles(node);
          this.originalPositionForMoveAndResize(node);
          break;
      }
    }
    console.groupEnd();
  }

  fixateOriginalInheritedStyles(node) {
    if ([changeType.added, changeType.removed, changeType.moved].includes(node.changes.type)) {
      setStyleProperty(node, "transition", "")
      for (let property of inheritedProperties) {
        setStyleProperty(node, property, node.changes.computedOriginalStyle[property])
      }
    }
  }

  setupALeaderForIncomingWithOriginalFootprint(node) {
    // log("setupALeaderForIncomingWithOriginalFootprint")
    // Get a leader for the added, this is either a new one, or a reused one from a remove. 
    let leader = this.tryRepurposeTrailerAsLeader(node);

    if (!leader) {
      // Create new leader.
      // log("create a new leader ...")
      leader = this.createNewLeader(node);
      node.leader = leader;
      node.wrapper = leader; 
      // Note: We set width/height at this point because here we know if the leader was reused or not. If we do it later, we wont know that.  
      if (this.animateLeaderWidth) setStyleProperty(leader, "width", "0.0001px"); 
      if (this.animateLeaderHeight) setStyleProperty(leader, "height", "0.0001px");
      insertAfter(leader, node);
    }

    // Add node to leader and show
    leader.appendChild(node);
    this.show(leader);

    // Debugging
    // leader.style.backgroundColor = "rgba(255, 170, 170, 0.5)";

    // log(`leader: `);
    // log(extractProperties(node.leader.style, this.typicalAnimatedProperties));
  }

  tryRepurposeTrailerAsLeader(node) {
    if (node.trailer && node.parentNode === node.trailer) {
      // Reuse own trailer as leader. 
      // log("repurpose existing trailer ...")
      return this.repurposeOwnTrailerWrapperAsLeader(node);
    } else {
      // return null;

      // Find a leader for added, either borrow one, or create a new one.   
      let trailer; 
      let previous = node.previousSibling;
      // log(previous) 
      // log(previous && previous.isControlledByAnimation) 
      while (previous && previous.isControlledByAnimation && previous.canBeRepurposed) {
        trailer = previous; 
        previous = previous.previousSibling;
      }

      if (trailer) {  
        // log(node.trailer);
        // log(node.trailer.parentNode);
        // log(node.parentNode);
        // log(node.trailer === node.parentNode);
        delete trailer.canBeRepurposed;
        // Found an existing leader. 
        // log("repurpose existing trailer ...")
        return this.repurposeTrailerAsLeader(trailer, node);
      }
    }
    return null;
  }

  fixateOriginalTransformAndOpacity(node) {
    assignToStyle(node, {
      transform: node.changes.computedOriginalStyle.transform,
      opacity: node.changes.computedOriginalStyle.opacity,
    });
  }

  originalPositionForZoomIn(node) {
    assignToStyle(node, {
      position: "absolute", 
      transform: "matrix(0.0001, 0, 0, 0.0001, 0, 0)",//transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px", 
      height: node.changes.targetDimensions.heightWithoutMargin + "px", // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001",
    });
  }
    
  originalPositionForZoomOut(node) {
    assignToStyle(node, {
      transform: "matrix(1, 0, 0, 1, 0, 0)",
      position: "absolute", 
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.originalDimensions.widthWithoutMargin + "px", 
      height: node.changes.originalDimensions.heightWithoutMargin + "px",
      opacity: "1",
    });
  }

  originalPositionForMoveAndResize(node) {
    assignToStyle(node, {
      transform: "matrix(1, 0, 0, 1, 0, 0)",
      position: "absolute", 
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.originalDimensions.widthWithoutMargin + "px", 
      height: node.changes.originalDimensions.heightWithoutMargin + "px"
    });
  }

  
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                            Emulate original bounds using transformations
   * 
   * -------------------------------------------------------------------------------------
   */

  /**
   * Emulate original bounds
   */
  emulateOriginalBounds(component) {
    // console.group("Emulate original bounds for " + this.changesChain(component) + ": " + component.toString());
    const node = component.domNode; 
    // log("trailer: " + node.trailer);
    // Do the FLIP animation technique
    // Note: This will not happen for components being removed (in earlier componentChanges.number). Should we include those here as well?
    this.recordBoundsInNewStructure(component.domNode);
    switch(component.changes.type) {
      case changeType.moved:
      case changeType.resident:
        this.translateToOriginalBoundsIfNeeded(component);    
        break;
      default:
        break;  
    }
    console.groupEnd();
  }

  recordBoundsInNewStructure(node) {
    // node.style.transform = ""; // Cannot do here as some resident nodes will continue on same animation.
    node.newStructureBounds = node.getBoundingClientRect();
    // movedPrimitives.push(node)
    draw(node.newStructureBounds, "red");
  }

  animatedProperties = [
    // "transform",
    // "maxHeight",
    // "maxWidth",
    {compound: "margin", partial: ["marginBottom", "marginBottom", "marginLeft", "marginRight"]},
    {compound: "padding", partial: ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]},
    "opacity",
    "color"
  ];

  translateToOriginalBoundsIfNeeded(component) {
    // TODO: Translate parents first in case of cascading moves? 
    
    if (!sameBounds(component.domNode.changes.originalBounds, component.domNode.newStructureBounds)) {
      component.outOfPosition = true; 

      // log("Not same bounds for " + component.toString());   
      // log(component.domNode.changes.originalBounds)
      // log(component.domNode.newStructureBounds);  
      const computedStyle = getComputedStyle(component.domNode);
      let currentTransform = getComputedStyle(component.domNode).transform;
      // log(currentTransform);
      // This is for resident that have a transform already. In an animation already.
      if (!["none", "", " "].includes(currentTransform)) {
        // log("Already have transform for " + component.toString());     
        // Freeze properties as we start a new animation.

        Object.assign(component.domNode.style, extractProperties(computedStyle, this.animatedProperties));

        // Reset transform 
        
        setStyleProperty(component.domNode, "transition", "");
        setStyleProperty(component.domNode, "transform", "");
        currentTransform = getComputedStyle(component.domNode).transform;
        this.recordBoundsInNewStructure(component.domNode);
      }

      component.animateInChanges = componentChanges.number; 
      this.translateFromNewToOriginalPosition(component.domNode);

      // Reflow
      component.domNode.getBoundingClientRect();
    }
  }

  translateFromNewToOriginalPosition(node) {
    setStyleProperty(node, "transition", "");

    // // Origin bouds... really use?
    // const defaultOrigin = {top: 0, left: 0};
    // // const animationOriginNode = node.animationOriginNode; //delete node.animationOriginNode;
    // const originOriginalBounds = defaultOrigin; //animationOriginNode.changes.originalBounds; //delete animationOriginNode.changes.originalBounds;
    // const originInitialBounds = defaultOrigin; //animationOriginNode.newStructureBounds; //delete animationOriginNode.newStructureBounds;
    
    // const originalBounds = node.changes.originalBounds; //delete node.changes.originalBounds;
    // const newStructureBounds = node.newStructureBounds; //delete node.newStructureBounds;
    // const deltaX = (newStructureBounds.left - originInitialBounds.left) - (originalBounds.left - originOriginalBounds.left) //- node.animationStartTotalHeight;
    // const deltaY = (newStructureBounds.top - originInitialBounds.top) - (originalBounds.top - originOriginalBounds.top) //-  node.animationStartTotalWidth;
    // node.style.transform = "";

    const originalBounds = node.changes.originalBounds; //delete node.changes.originalBounds;
    const newStructureBounds = node.newStructureBounds; //delete node.newStructureBounds;
    const deltaX = newStructureBounds.left - originalBounds.left;  //- node.animationStartTotalHeight;
    const deltaY = newStructureBounds.top - originalBounds.top; //-  node.animationStartTotalWidth;
    // node.style.transform = "";
 
    const transform = "matrix(1, 0, 0, 1, " + -deltaX + ", " + -deltaY + ")";
    // log(transform);
    setStyleProperty(node, "transform", transform);
    // log(node.style.transform)
    // log("transform:")
    // log(node.style.transform);
  }

 
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                           Activate animations
   * 
   * -------------------------------------------------------------------------------------
   */

  typicalAnimatedProperties = [
    "opacity",
    "display",
    "position",
    "transition", 
    "transform", 
    "width", 
    "height", 
    "maxWidth", 
    "maxHeight", 
    "margin", 
    "marginTop", 
    "padding", 
    "paddingTop"
  ]; 

  /**
   * Activate animation 
   */
  activateAnimation(component) {
    const node = component.domNode;
    const ongoingAnimation = node.ongoingAnimation;
    const changes = component.changes; 
    const trailer = node.trailer; 
    const leader = node.leader;
    
    // console.group("Activate for " + this.changesChain(component) + ": " + component.toString());
    // log(`original properties: `);
    // log(extractProperties(node.style, this.typicalAnimatedProperties));
    if (node.leader) {
      // log(`leader: `);
      // log(extractProperties(node.leader.style, this.typicalAnimatedProperties));
    }
    if (node.trailer) {
      // log(`trailer: `);
      // log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
    }

    // Animate node
    // log("ongoingAnimation: " + ongoingAnimation)
    if (ongoingAnimation) {
      switch(component.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          // log(trailer)
          // log(leader);
          // log(trailer === leader);
          //if (trailer) throw new Error("Internal error, should not happen!"); // TODO: Examine why happens in the portal demo. 
          break;
  
        case changeType.resident: 
          if (component.outOfPosition) {
            delete component.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
            // Might be a leader or not, should work in both cases?
          } 
          break;
  
        case changeType.moved:
          this.targetPositionForMoved(node);
          this.targetSizeForLeader(node, node.leader);
          if (node.trailer) this.targetSizeForTrailer(node.trailer);
          break; 
          
        case changeType.removed: 
          this.targetPositionForZoomOut(node);
          this.targetSizeForTrailer(node.trailer);
          break; 
      }
    } else {
      // Why was this needed?
      switch(component.changes.type) { // Note: Changes can be null
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          this.startAnimationChain(node);
          break;
  
        case changeType.resident: 
          // log("outOfPosition: " + component.outOfPosition);
          if (component.outOfPosition) {
            this.startAnimationChain(node);
            delete component.outOfPosition;            
            this.targetPositionForMovingInsideContainer(node);
            // Might be a leader or not, should work in both cases?
          } 
          break;
  
        case changeType.moved:
          this.targetPositionForMoved(node);
          this.targetSizeForLeader(node, node.leader);
          if (node.trailer) this.targetSizeForTrailer(node.trailer);
          this.startAnimationChain(node);
          break; 
          
        case changeType.removed: 
          this.targetPositionForZoomOut(node);
          this.targetSizeForTrailer(node.trailer);
          this.startAnimationChain(node);
          break; 
      }
    }

    // log("target properties: ");
    // log(extractProperties(component.domNode.style, this.typicalAnimatedProperties));
    if (leader) {
      // log(`leader: `);
      // log(extractProperties(leader.style, this.typicalAnimatedProperties));
    }
    if (node.trailer) {
      // log(`trailer: `);
      // log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
    }
    console.groupEnd();
  }

  targetSizeForLeader(node, leader) {
    setStyleProperty(leader, "transition", this.leaderTransition());
    const style = {};
    if (this.animateLeaderHeight) style.height = node.changes.targetDimensions.heightIncludingMargin + "px"; 
    if (this.animateLeaderWidth) style.width = node.changes.targetDimensions.widthIncludingMargin + "px"; 
    assignToStyle(leader, style);
  }

  targetSizeForTrailer(trailer) {
    trailer.style.transition = this.leaderTransition();
    assignToStyle(trailer, {
      width: "0.0001px",
      height: "0.0001px"
    });
  }

  targetPositionForZoomIn(node) {
    node.style.transition = this.addedTransition();
    assignToStyle(node, {
      transform: "matrix(1, 0, 0, 1, 0, 0)",
      opacity: "1"
    });
  }

  targetPositionForMovingInsideContainer(node) {
    // No leader or trailer that needs animation. Just ensure we want to move to a resting place in case we got translated. Should we check this?  
    node.style.transition = this.defaultTransition(node);
    assignToStyle(node, {
      transform: "matrix(1, 0, 0, 1, 0, 0)"
    });
  }
 
  targetPositionForMoved(node) {
    node.style.transition = this.defaultTransition();
    assignToStyle(node, {
      transform: "matrix(1, 0, 0, 1, 0, 0)"
    });
    this.setInheritedRenderContextStyles(node);
  }


  targetPositionForZoomOut(node) {
    node.style.transition = this.removeTransition();
    assignToStyle(node, {
      transform: "matrix(0.0001, 0, 0, 0.0001, 0, 0)",
      opacity: "0.001"
    });
  }
  
  setInheritedRenderContextStyles(node) {
    // Fixate environment dependent styles
    for (let property of inheritedProperties) {
      setStyleProperty(node, property, node.changes.computedRenderContextStyle[property]);
    }    
  }

  /**
   * -------------------------------------------------------------------------------------
   * 
   *                           Animation cleanup
   * 
   * -------------------------------------------------------------------------------------
   */


  /**
   * Setup animation cleanyp
   */
  setupAnimationCleanup(component) {
    const node = component.domNode;
    const cleanupNumber = componentChanges.number
    
    this.setupNodeAnimationCleanup(
      node,
      cleanupNumber,
      () => {
        node.equivalentCreator.synchronizeDomNodeStyle(Object.keys(getFixations(node))); //["transition", "transform", "width", "height", "position", "opacity", ...inheritedProperties]
        this.endAnimationChain(node);
      }
    );
  
    if (node.leader) {
      const leader = node.leader;
      this.setupNodeAnimationCleanup(leader,
        cleanupNumber,
        () => {
          if (leader.parentNode) {
            leader.removeChild(node);
            leader.parentNode.replaceChild(node, leader);
            // node.equivalentCreator.synchronizeDomNodeStyle(["position"]);
            delete leader.isControlledByAnimation;
            this.detatchLeaderOwner(leader)
            delete node.wrapper;
          }
        }
      )
    }
    
    if (node.trailer) {
      const trailer = node.trailer;
      if (trailer === node.wrapper) {
        // Wrapper trailer
        this.setupNodeAnimationCleanup(
          trailer,
          cleanupNumber, 
          () => {
            trailer.removeChild(node);
            if (trailer.parentNode) trailer.parentNode.removeChild(trailer);
            delete trailer.isControlledByAnimation;
            this.detatchTrailerOwner(trailer);
            delete node.wrapper;
          }
        )
      } else {
        // Separate trailer
        this.setupNodeAnimationCleanup(
          trailer,
          cleanupNumber, 
          () => {
            if (trailer.parentNode) trailer.parentNode.removeChild(trailer);
            delete trailer.isControlledByAnimation;
            this.detatchTrailerOwner(trailer);
          }
        )
      }
    }
  }

  detatchLeaderOwner(leader) {
    if (leader.owner) {
      if (leader.owner.leader === leader) {
        delete leader.owner.leader;
      }
      delete leader.owner; 
    }
  }

  detatchTrailerOwner(trailer) {
    if (trailer.owner) {
      if (trailer.owner.trailer === trailer) {
        delete trailer.owner.trailer;
      }
      delete trailer.owner; 
    }
  }

  setupNodeAnimationCleanup(node, cleanupNumber, endingAction) {
    node.cleanupNumber = cleanupNumber
    setTimeout(() => {
      if (node.cleanupNumber === cleanupNumber) {
        endingAction()
      }
    },animationTime*1000)
  }
}

// getAnimatedProperties(computedStyle) {
//   const result = {};
//   animatedProperties.forEach(property => {
//     if (typeof property === "string") {
//       result[property] = computedStyle[property]
//     } else {
//       property.partial.forEach(partialProperty => {
//         result[partialProperty] = computedStyle[partialProperty]
//       });
//     }
//   });
//   return result; 
// }

export const zoomFlyAnimation = new ZoomFlyDOMTransitionAnimation();
export const standardAnimation = zoomFlyAnimation;

function fixateWidthAndHeight(node) {
  const bounds = node.getBoundingClientRect();
  // Fixate size, it might get reset after setting display none?
  assignToStyle(node, {
    width: bounds.width + "px",
    height: bounds.height + "px"
  }) 
}

function setStyleProperty(node, style, value) {
  node.style[style] = value
  getFixations(node)[style] = value;
}

function assignToStyle(node, styles) {
  Object.assign(node.style, styles);
  const fixations = getFixations(node)
  for (let property in styles) {
    fixations[property] = true;
  }
}

function getFixations(node) {
  if (typeof(node.fixated) === "undefined") {
    node.fixated = {};
  }
  return node.fixated;
}
