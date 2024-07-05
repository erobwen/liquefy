import { logMark, extractProperties } from "@liquefy/flow.core";
import { changeType } from "./DOMAnimation";
import { ZoomFlyDOMNodeAnimation } from "./ZoomFlyDOMNodeAnimation";

const log = console.log;


class FlyFromTopDOMNodeAnimation extends ZoomFlyDOMNodeAnimation {
  animateLeaderWidth = false; 
  animateLeaderHeight = true;

  emulateOriginalFootprintsAndFixateAnimatedStyle(flow) {
    console.group("Emulate original style and footprints for " + this.changesChain(flow) + ": " + flow.toString());
    const node = flow.domNode;
    const trailer = node.trailer;
    // log("trailer: " + node.trailer);

    // Setup leaders, typically deflated unless an existing leader/trailer can be reused.
    switch (flow.changes.type) {
      case changeType.added: 
      case changeType.moved: 
        this.setupALeaderForIncomingWithOriginalFootprint(node);
        break; 
    }

    // Make trailers visible, they should already have original sizes.
    switch (flow.changes.type) {
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
      switch (flow.changes.type) {
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
      switch (flow.changes.type) {
        case changeType.resident:
          break;
        case changeType.added: 
          this.originalPositionForFlyIn(node);
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

  originalPositionForFlyIn(node) {
    Object.assign(node.style, {
      position: "absolute", 
      transform: "matrix(1, 0, 0, 1, 0, -" + node.changes.targetDimensions.heightWithoutMargin + ")",//transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px", 
      height: node.changes.targetDimensions.heightWithoutMargin + "px", // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001",
    });
  }


  activateAnimation(flow) {
    const node = flow.domNode;
    const ongoingAnimation = node.ongoingAnimation;
    const changes = flow.changes; 
    const trailer = node.trailer; 
    const leader = node.leader;
    
    console.group("Activate for " + this.changesChain(flow) + ": " + flow.toString());
    // log(`original properties: `);
    log(extractProperties(node.style, this.typicalAnimatedProperties));
    if (node.leader) {
      // log(`leader: `);
      log(extractProperties(node.leader.style, this.typicalAnimatedProperties));
    }
    if (node.trailer) {
      // log(`trailer: `);
      log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
    }

    // Animate node
    // log("ongoingAnimation: " + ongoingAnimation)
    if (ongoingAnimation) {
      switch(flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          break;
  
        case changeType.resident: 
          if (flow.outOfPosition) {
            delete flow.outOfPosition;
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
          this.targetPositionForFlyOut(node);
          this.targetSizeForTrailer(node.trailer);
          break; 
      }
    } else {
      switch(flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          this.startAnimationChain(node);
          break;
  
        case changeType.resident: 
          // log("outOfPosition: " + flow.outOfPosition);
          if (flow.outOfPosition) {
            this.startAnimationChain(node);
            delete flow.outOfPosition;            
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
          this.targetPositionForFlyOut(node);
          this.targetSizeForTrailer(node.trailer);
          this.startAnimationChain(node);
          break; 
      }
    }
    // log("target properties: ");
    log(extractProperties(flow.domNode.style, this.typicalAnimatedProperties));
    if (leader) {
      // log(`leader: `);
      log(extractProperties(leader.style, this.typicalAnimatedProperties));
    }
    if (node.trailer) {
      // log(`trailer: `);
      log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
    }
    console.groupEnd();
  }
    

  targetPositionForFlyOut(node) {
    node.style.transition = this.removeTransition();
    // console.log("matrix(1, 0, 0, 1, 0, -" + node.changes.originalDimensions.heightWithoutMargin + ")");
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, -" + node.changes.originalDimensions.heightWithoutMargin + ")",
      opacity: "1"
    });
  }
}


class FlyFromLeftDOMNodeAnimation extends FlyFromTopDOMNodeAnimation {
  animateLeaderWidth = true; 
  animateLeaderHeight = false;

  originalPositionForFlyIn(node) {
    Object.assign(node.style, {
      position: "absolute", 
      transform: "matrix(1, 0, 0, 1, -" + node.changes.targetDimensions.widthWithoutMargin + ", 0)",//transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px", 
      height: node.changes.targetDimensions.heightWithoutMargin + "px", // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001",
    });
  }

  targetPositionForFlyOut(node) {
    node.style.transition = this.removeTransition();
    // console.log("matrix(1, 0, 0, 1, -" + node.changes.originalDimensions.widthWithoutMargin + ", 0)");
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, -" + node.changes.originalDimensions.widthWithoutMargin + ", 0)",
      opacity: "1"
    });
  }
}


export const flyFromTopAnimation = new FlyFromTopDOMNodeAnimation();
export const flyFromLeftAnimation = new FlyFromLeftDOMNodeAnimation();