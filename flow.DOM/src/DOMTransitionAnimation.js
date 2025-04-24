
export class DOMTransitionAnimation {

  /**
   * Foundation requirements
   */
  acceptUnstableFoundation(unstableAncestorFlow) {
    return false; 
  }


  /**
   * Foundation requirements
   */
  allwaysStableFoundationEvenWhenAdded() {
    return false;
  }

  
  /**
   * Record original bounds, before anything in the dome has changed
   * Bounds do not include margin. See this:  
   * https://stackoverflow.com/questions/50657526/does-getboundingclientrect-width-and-height-includes-paddings-and-borders-of-e
   * Also offset width and height do not include margin. 
   */
  recordOriginalBoundsAndStyle(flow) {
    throw new Error("Not implemented yet!");
  }


  /**
   * Prepare for DOM building. 
   */
  prepareForDOMBuilding(flow) {
    throw new Error("Not implemented yet!");
  }


  /**
   * DOM just rebuilt, it could be a good idea to measure target sizes at this stage, 
   * since it is the closest we will be to the actual end result. 
   * However, removed animated nodes are still present at this point... maybe we should ensure added leaders for removed ones start out minimized?
   * Trailers should also be minimized at this point.
   */
  domJustRebuiltMeasureTargetSizes(flow) {
    throw new Error("Not implemented yet!");
  }

  
  /**
   * Emulate the original styles and footprints of all animated
   * nodes. This is for a smooth transition from their original position. 
   */
  emulateOriginalFootprintsAndFixateAnimatedStyle(flow) {
    throw new Error("Not implemented yet!");
  }
  
  
  /**
   * Emulate original bounds
   */
  emulateOriginalBounds(flow) {
    throw new Error("Not implemented yet!");
  }


  /**
   * Activate animation 
   */
  activateAnimation(flow) {
    throw new Error("Not implemented yet!");
  }


  /**
   * Setup animation cleanyp
   */
  setupAnimationCleanup(flow) {
    throw new Error("Not implemented yet!");
  }
}




