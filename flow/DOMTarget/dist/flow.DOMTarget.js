var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { findKeyInProperties, readFlowProperties, getTarget, findTextAndKeyInPropertiesUsingCase, insertAfter, draw, FlowPrimitive, traceWarnings, finalize, repeat as repeat$1, trace as trace$1, configuration, traceAnimation, logAnimationFrameGroup, logAnimationSeparator, postponeInvalidations, continueInvalidations, FlowTarget, transaction, observable } from "@liquefy/flow.core";
function extractAttributes(properties) {
  const attributes = {};
  if (!properties) return attributes;
  eventHandlerContentElementAttributes.forEach(
    (attribute) => {
      if (typeof properties[attribute.camelCase] !== "undefined") {
        attributes[attribute.lowerCase] = properties[attribute.camelCase];
        delete properties[attribute.camelCase];
      }
    }
  );
  globalElementAttributes.forEach(
    (attribute) => {
      if (typeof properties[attribute.camelCase] !== "undefined") {
        attributes[attribute.lowerCase] = properties[attribute.camelCase];
        delete properties[attribute.camelCase];
      }
    }
  );
  if (properties.className) attributes["class"] = properties.className;
  properties.attributes = attributes;
  return attributes;
}
const eventHandlerContentElementAttributesCamelCase = [
  "onAuxClick",
  "onBeforeMatch",
  "onBlur",
  "onCancel",
  "onCanPlay",
  "onCanPlaythrough",
  "onChange",
  "onClick",
  "onClose",
  "onContextLost",
  "onContextMenu",
  "onContextRestored",
  "onCopy",
  "onCueChange",
  "onCut",
  "onDblClick",
  "onDrag",
  "onDragEnd",
  "onDragEnter",
  "onDragLeave",
  "onDragOver",
  "onDragStart",
  "onDrop",
  "onDurationChange",
  "onEmptied",
  "onEnded",
  "onError",
  "onFocus",
  "onFormData",
  "onInput",
  "onInvalid",
  "onKeyDown",
  "onKeyPress",
  "onKeyUp",
  "onLoad",
  "onLoadedData",
  "onLoadedMetaData",
  "onLoadStart",
  "onMouseDown",
  "onMouseEnter",
  "onMouseLeave",
  "onMouseMove",
  "onMouseOut",
  "onMouseOver",
  "onMouseUp",
  "onPaste",
  "onPause",
  "onPlay",
  "onPlaying",
  "onProgress",
  "onRateChange",
  "onReset",
  "onResize",
  "onScroll",
  "onSecurityPolicyViolation",
  "onSeeked",
  "onSeeking",
  "onSelect",
  "onSlotChange",
  "onStalled",
  "onSubmit",
  "onSuspend",
  "onTimeUpdate",
  "onToggle",
  "onVolumeChange",
  "onWaiting",
  "onWheel"
];
const eventHandlerContentElementAttributes = eventHandlerContentElementAttributesCamelCase.map((camelCase2) => ({ camelCase: camelCase2, lowerCase: camelCase2.toLowerCase() }));
const globalElementAttributesCamelCase = [
  "accessKey",
  "autoCapitalize",
  "autoFocus",
  "contentEditable",
  "dir",
  "draggable",
  "enterKeyHint",
  "hidden",
  "inert",
  "inputmode",
  "is",
  "itemId",
  "itemProp",
  "itemRef",
  "itemScope",
  "itemType",
  "lang",
  "nonce",
  "spellCheck",
  "style",
  "tabIndex",
  "title",
  "translate"
];
const globalElementAttributes = globalElementAttributesCamelCase.map((camelCase2) => ({ camelCase: camelCase2, lowerCase: camelCase2.toLowerCase() }));
function extractChildStyles(style) {
  childStylePropertiesCamelCase.forEach((property) => {
    if (typeof style[property] !== "undefined") {
      style[property];
      delete style[property];
    }
  });
  return [childStyles, style];
}
const childStylePropertiesCamelCase = [
  "order",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "flex",
  // {
  //   compound: "flex", 
  //   partial: [
  //     "flex-grow",
  //     "flex-shrink",
  //     "flex-basis",
  //   ]
  // },
  "alignSelf"
];
childStylePropertiesCamelCase.map((camelCase2) => ({ camelCase: camelCase2, lowerCase: camelCase2.toLowerCase() }));
function extractProperty(object, property) {
  const result = object[property];
  delete object[property];
  return result;
}
const domNodeAttributes = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  eventHandlerContentElementAttributesCamelCase,
  extractAttributes,
  extractChildStyles,
  extractProperty,
  globalElementAttributesCamelCase
}, Symbol.toStringTag, { value: "Module" }));
function elemenNode(...parameters) {
  let properties = findKeyInProperties(readFlowProperties(parameters));
  const attributes = extractAttributes(properties);
  return getTarget().create({ type: "dom.elementNode", key: properties.key, attributes, children: properties.children });
}
function textNode(...parameters) {
  let properties = findKeyInProperties(readFlowProperties(parameters));
  const attributes = extractAttributes(properties);
  return getTarget().create({ type: "dom.textNode", key: properties.key, attributes, children: properties.children });
}
function span(...parameters) {
  let properties = findTextAndKeyInPropertiesUsingCase(readFlowProperties(parameters));
  const attributes = extractAttributes(properties);
  textToTextNode(properties);
  return getTarget().create({ type: "dom.elementNode", tagName: "span", key: properties.key, classNameOverride: "span", attributes, children: properties.children, animate: properties.animate });
}
function div(...parameters) {
  let properties = findKeyInProperties(readFlowProperties(parameters));
  const attributes = extractAttributes(properties);
  return getTarget().create({ type: "dom.elementNode", tagName: "div", key: properties.key, classNameOverride: "div", attributes, children: properties.children, animate: properties.animate });
}
function styledDiv(classNameOverride, style, parameters) {
  const properties = findKeyInProperties(readFlowProperties(parameters));
  const attributes = extractAttributes(properties);
  attributes.style = { ...style, ...attributes.style };
  return getTarget().create({ type: "dom.elementNode", key: properties.key, classNameOverride, tagName: "div", attributes, ...properties });
}
function textToTextNode(properties) {
  if (properties.text) {
    properties.children = // [
    getTarget().create({
      type: "dom.textNode",
      key: properties.key ? properties.key + ".text" : null,
      text: extractProperty(properties, "text")
    });
  }
}
const BasicHtml = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  div,
  elemenNode,
  span,
  styledDiv,
  textNode,
  textToTextNode
}, Symbol.toStringTag, { value: "Module" }));
class DOMNodeAnimation {
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
   * However, removed nodes are still present at this point... maybe we should ensure added leaders for removed ones start out minimized?
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
const DOMNodeAnimation$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  DOMNodeAnimation
}, Symbol.toStringTag, { value: "Module" }));
let animationTime = 1;
function setAnimationTime(value) {
  animationTime = value;
}
const inheritedProperties = ["fontSize", "lineHeight", "margin", "padding", "color"];
class ZoomFlyDOMNodeAnimation extends DOMNodeAnimation {
  constructor() {
    super(...arguments);
    /**
     * Configuration
     */
    __publicField(this, "animateLeaderWidth", true);
    __publicField(this, "animateLeaderHeight", true);
    __publicField(this, "animatedProperties", [
      // "transform",
      // "maxHeight",
      // "maxWidth",
      { compound: "margin", partial: ["marginBottom", "marginBottom", "marginLeft", "marginRight"] },
      { compound: "padding", partial: ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"] },
      "opacity",
      "color"
    ]);
    /**
     * -------------------------------------------------------------------------------------
     * 
     *                           Activate animations
     * 
     * -------------------------------------------------------------------------------------
     */
    __publicField(this, "typicalAnimatedProperties", [
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
    ]);
  }
  /**
   * Default transitions
   */
  defaultTransition() {
    return `all ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(1, 0, 0.42, 0.93)`;
  }
  addedTransition() {
    return `transform ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(1, 0, 0.42, 0.93)`;
  }
  leaderTransition() {
    return `width ${animationTime}s ease-in-out, height ${animationTime}s ease-in-out`;
  }
  removeTransition() {
    return `all ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(.08,.72,.15,1.01)`;
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
    };
    dimensions.widthWithoutMargin = dimensions.width;
    dimensions.heightWithoutMargin = dimensions.height;
    dimensions.heightIncludingMargin = dimensions.height + dimensions.marginTop + dimensions.marginBottom;
    dimensions.widthIncludingMargin = dimensions.width + dimensions.marginLeft + dimensions.marginRight;
    return dimensions;
  }
  /**
   * General helpers
   */
  fixateLeaderOrTrailer(leaderOrTrailer) {
    const bounds = leaderOrTrailer.getBoundingClientRect();
    leaderOrTrailer.style.width = bounds.width + "px";
    leaderOrTrailer.style.height = bounds.height + "px";
  }
  repurposeOwnLeaderAsTrailer(node) {
    const leader = node.leader;
    delete node.leader;
    leader.removeEventListener("transitionend", leader.hasCleanupEventListener);
    delete leader.hasCleanupEventListener;
    if (node.trailer) {
      delete node.trailer.owner;
      delete node.trailer;
    }
    const trailer = leader;
    if (trailer.owner !== node) throw new Error("unexpected owner");
    node.trailer = trailer;
    return trailer;
  }
  repurposeOwnTrailerAsLeader(node) {
    const trailer = node.trailer;
    delete node.trailer;
    trailer.removeEventListener("transitionend", trailer.hasCleanupEventListener);
    delete trailer.hasCleanupEventListener;
    if (node.leader) {
      delete node.leader.owner;
      delete node.leader;
    }
    const leader = trailer;
    if (leader.owner !== node) throw new Error("unexpected owner");
    node.leader = leader;
    return leader;
  }
  repurposeTrailerAsLeader(trailer, node) {
    if (trailer.owner) {
      delete trailer.owner.trailer;
      delete trailer.owner;
    }
    trailer.removeEventListener("transitionend", trailer.hasCleanupEventListener);
    delete trailer.hasCleanupEventListener;
    if (node.leader) {
      delete node.leader.owner;
      delete node.leader;
    }
    const leader = trailer;
    node.leader = leader;
    leader.owner = node;
    return leader;
  }
  createNewTrailer(node) {
    const trailer = this.createNewTrailerOrLeader();
    trailer.id = "trailer";
    if (node.trailer) throw new Error("should not have a trailer!");
    node.trailer = trailer;
    trailer.owner = node;
    return trailer;
  }
  createNewLeader(node) {
    const leader = this.createNewTrailerOrLeader();
    leader.id = "leader";
    if (node.leader) throw new Error("should not have a leader!");
    node.leader = leader;
    leader.owner = node;
    return leader;
  }
  createNewTrailerOrLeader(id) {
    const trailerOrLeader = document.createElement("div");
    trailerOrLeader.isControlledByAnimation = true;
    trailerOrLeader.style.position = "relative";
    trailerOrLeader.style.overflow = "visible";
    return trailerOrLeader;
  }
  hide(node) {
    node.style.display = "none";
  }
  show(node) {
    node.style.display = "";
  }
  /**
   * Debugging
   */
  changesChain(flow) {
    let result = "";
    result += flow.domNode.ongoingAnimation ? "[ongoing] " : "";
    let changes = flow.changes;
    while (changes) {
      const separator = result === "" ? "" : ", ";
      result += separator + changes.type;
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
    freezeFlowChanges();
  }
  endAnimationChain(node) {
    if (node.ongoingAnimation) {
      delete node.isControlledByAnimation;
      delete node.ongoingAnimation;
      if (node.changes) {
        node.changes.finished = true;
        const flow = node.equivalentCreator;
        flow.changes = null;
        node.changes = null;
      }
      requestAnimationFrame(() => {
        unfreezeFlowChanges();
      });
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
  recordOriginalBoundsAndStyle(flow) {
    const node = flow.domNode;
    node.changes.originalBounds = node.getBoundingClientRect();
    node.changes.originalStyle = { ...node.style };
    node.changes.computedOriginalStyle = { ...getComputedStyle(node) };
    node.changes.originalDimensions = this.calculateDimensionsIncludingMargin(node.changes.originalBounds, node.changes.computedOriginalStyle);
    console.groupEnd();
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
  prepareForDOMBuilding(flow) {
    const node = flow.domNode;
    switch (flow.changes.type) {
      case changeType.moved:
      case changeType.removed:
        delete node.isControlledByAnimation;
        this.addTrailersForMovedAndRemovedBeforeDomBuilding(node);
        if (changeType.moved) node.trailer.canBeRepurposed = true;
        break;
    }
    switch (flow.changes.type) {
      case changeType.added:
      case changeType.moved:
        delete node.isControlledByAnimation;
        this.neutralizeTransformationsAndPosition(flow, node);
        flow.synchronizeDomNodeStyle(inheritedProperties);
        break;
    }
    if (flow.changes.type === changeType.resident) {
      if (node.leader) {
        node.isControlledByAnimation = true;
      }
    }
    console.groupEnd();
  }
  addTrailersForMovedAndRemovedBeforeDomBuilding(node) {
    let trailer;
    if (node.leader && node.leader === node.parentNode && node.parentNode.isControlledByAnimation) {
      trailer = this.repurposeOwnLeaderAsTrailer(node);
      this.fixateLeaderOrTrailer(trailer);
    } else {
      trailer = this.createNewTrailer(node);
      trailer.style.width = node.changes.originalDimensions.widthIncludingMargin + "px";
      trailer.style.height = node.changes.originalDimensions.heightIncludingMargin + "px";
      insertAfter(trailer, node);
    }
    this.hide(trailer);
  }
  neutralizeTransformationsAndPosition(flow) {
    flow.synchronizeDomNodeStyle(["position", "transform", "width", "height"]);
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
  domJustRebuiltMeasureTargetSizes(flow) {
    const node = flow.domNode;
    switch (flow.changes.type) {
      case changeType.added:
        if (flow.changes.previous && flow.changes.previous.type === changeType.removed) {
          const removeChange = flow.changes.previous;
          node.changes.targetBounds = removeChange.originalBounds;
          node.changes.targetStyle = removeChange.originalStyle;
          node.changes.computedTargetStyle = removeChange.computedOriginalStyle;
          node.changes.targetDimensions = removeChange.originalDimensions;
          break;
        }
      case changeType.resident:
      case changeType.moved:
        node.changes.targetBounds = node.getBoundingClientRect();
        node.changes.targetStyle = { ...node.style };
        node.changes.computedTargetStyle = { ...getComputedStyle(node) };
        node.changes.targetDimensions = this.calculateDimensionsIncludingMargin(node.changes.targetBounds, node.changes.computedTargetStyle);
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
  emulateOriginalFootprintsAndFixateAnimatedStyle(flow) {
    const node = flow.domNode;
    const trailer = node.trailer;
    switch (flow.changes.type) {
      case changeType.added:
      case changeType.moved:
        this.setupALeaderForIncomingWithOriginalFootprint(node);
        break;
    }
    switch (flow.changes.type) {
      case changeType.removed:
        if (node.parentNode !== trailer) {
          trailer.appendChild(node);
        }
        if (trailer) this.show(trailer);
        break;
      case changeType.moved:
        if (trailer) this.show(trailer);
        break;
    }
    if (node.ongoingAnimation) {
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
      switch (flow.changes.type) {
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
      node.style.transition = "";
      for (let property of inheritedProperties) {
        node.style[property] = node.changes.computedOriginalStyle[property];
      }
    }
  }
  setupALeaderForIncomingWithOriginalFootprint(node) {
    let leader = this.tryRepurposeTrailerAsLeader(node);
    if (!leader) {
      leader = this.createNewLeader(node);
      node.leader = leader;
      if (this.animateLeaderWidth) leader.style.width = "0.0001px";
      if (this.animateLeaderHeight) leader.style.height = "0.0001px";
      insertAfter(leader, node);
    }
    leader.appendChild(node);
    this.show(leader);
  }
  tryRepurposeTrailerAsLeader(node) {
    if (node.trailer && node.parentNode === node.trailer) {
      return this.repurposeOwnTrailerAsLeader(node);
    } else {
      return null;
    }
  }
  fixateOriginalTransformAndOpacity(node) {
    Object.assign(node.style, {
      transform: node.changes.computedOriginalStyle.transform,
      opacity: node.changes.computedOriginalStyle.opacity
    });
  }
  originalPositionForZoomIn(node) {
    Object.assign(node.style, {
      position: "absolute",
      transform: "matrix(0.0001, 0, 0, 0.0001, 0, 0)",
      //transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px",
      height: node.changes.targetDimensions.heightWithoutMargin + "px",
      // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001"
    });
  }
  originalPositionForZoomOut(node) {
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)",
      position: "absolute",
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.originalDimensions.widthWithoutMargin + "px",
      height: node.changes.originalDimensions.heightWithoutMargin + "px",
      opacity: "1"
    });
  }
  originalPositionForMoveAndResize(node) {
    Object.assign(node.style, {
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
  emulateOriginalBounds(flow) {
    flow.domNode;
    this.recordBoundsInNewStructure(flow.domNode);
    switch (flow.changes.type) {
      case changeType.moved:
      case changeType.resident:
        this.translateToOriginalBoundsIfNeeded(flow);
        break;
    }
    console.groupEnd();
  }
  recordBoundsInNewStructure(node) {
    node.newStructureBounds = node.getBoundingClientRect();
    movedPrimitives.push(node);
    draw(node.newStructureBounds, "red");
  }
  translateToOriginalBoundsIfNeeded(flow) {
    if (!sameBounds(flow.domNode.changes.originalBounds, flow.domNode.newStructureBounds)) {
      flow.outOfPosition = true;
      const computedStyle = getComputedStyle(flow.domNode);
      let currentTransform = getComputedStyle(flow.domNode).transform;
      if (!["none", "", " "].includes(currentTransform)) {
        Object.assign(flow.domNode.style, extractProperties(computedStyle, this.animatedProperties));
        flow.domNode.style.transition = "";
        flow.domNode.style.transform = "";
        currentTransform = getComputedStyle(flow.domNode).transform;
        this.recordBoundsInNewStructure(flow.domNode);
      }
      flow.animateInChanges = flowChanges.number;
      this.translateFromNewToOriginalPosition(flow.domNode);
      flow.domNode.getBoundingClientRect();
    }
  }
  translateFromNewToOriginalPosition(node) {
    node.style.transition = "";
    const originalBounds = node.changes.originalBounds;
    const newStructureBounds = node.newStructureBounds;
    const deltaX = newStructureBounds.left - originalBounds.left;
    const deltaY = newStructureBounds.top - originalBounds.top;
    const transform = "matrix(1, 0, 0, 1, " + -deltaX + ", " + -deltaY + ")";
    node.style.transform = transform;
  }
  /**
   * Activate animation 
   */
  activateAnimation(flow) {
    const node = flow.domNode;
    const ongoingAnimation = node.ongoingAnimation;
    flow.changes;
    const trailer = node.trailer;
    node.leader;
    if (node.leader) ;
    if (node.trailer) ;
    if (ongoingAnimation) {
      switch (flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          break;
        case changeType.resident:
          if (flow.outOfPosition) {
            delete flow.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
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
      switch (flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          this.startAnimationChain(node);
          break;
        case changeType.resident:
          if (flow.outOfPosition) {
            this.startAnimationChain(node);
            delete flow.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
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
    if (node.trailer) ;
    console.groupEnd();
  }
  targetSizeForLeader(node, leader) {
    leader.style.transition = this.leaderTransition();
    const style = {};
    if (this.animateLeaderHeight) style.height = node.changes.targetDimensions.heightIncludingMargin + "px";
    if (this.animateLeaderWidth) style.width = node.changes.targetDimensions.widthIncludingMargin + "px";
    Object.assign(leader.style, style);
  }
  targetSizeForTrailer(trailer) {
    trailer.style.transition = this.leaderTransition();
    Object.assign(trailer.style, {
      width: "0.0001px",
      height: "0.0001px"
    });
  }
  targetPositionForZoomIn(node) {
    node.style.transition = this.addedTransition();
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)",
      opacity: "1"
    });
  }
  targetPositionForMovingInsideContainer(node) {
    node.style.transition = this.defaultTransition(node);
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)"
    });
  }
  targetPositionForMoved(node) {
    node.style.transition = this.defaultTransition();
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)"
    });
    this.setInheritedTargetStyles(node);
  }
  targetPositionForZoomOut(node) {
    node.style.transition = this.removeTransition();
    Object.assign(node.style, {
      transform: "matrix(0.0001, 0, 0, 0.0001, 0, 0)",
      opacity: "0.001"
    });
  }
  setInheritedTargetStyles(node) {
    for (let property of inheritedProperties) {
      node.style[property] = node.changes.computedTargetStyle[property];
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
  setupAnimationCleanup(flow) {
    const node = flow.domNode;
    this.setupNodeAnimationCleanup(node, {
      purpose: "node",
      endingAction: (propertyName) => {
        const leader = node.leader;
        const trailer = node.trailer;
        node.equivalentCreator.synchronizeDomNodeStyle([propertyName, "transition", "transform", "width", "height", "position", "opacity", ...inheritedProperties]);
        if (node.parentNode.isControlledByAnimation) {
          switch (node.changes.type) {
            case changeType.removed:
              if (trailer) {
                if (node.parentNode !== trailer) throw new Error("Internal error: Wrong trailer!");
                node.equivalentCreator.synchronizeDomNodeStyle(["position", "width", "height", "transform"]);
                trailer.removeChild(node);
                if (trailer.parentNode) trailer.parentNode.removeChild(trailer);
                delete trailer.owner;
                node.trailer.canBeRepurposed = true;
                delete node.trailer;
              }
              break;
            case changeType.added:
            case changeType.moved:
            case changeType.resident:
              if (leader) {
                if (node.parentNode !== leader) throw new Error("Internal error: Wrong leader!");
                node.equivalentCreator.synchronizeDomNodeStyle(["position", "width", "height", "transform"]);
                leader.removeChild(node);
                if (leader.parentNode) leader.parentNode.replaceChild(node, leader);
                delete leader.owner;
                delete node.leader;
              }
              if (trailer) {
                delete trailer.owner;
                node.trailer.canBeRepurposed = true;
                delete node.trailer;
              }
              break;
          }
        }
        this.endAnimationChain(node);
      }
    });
    if (node.trailer) {
      this.setupTrailerAnimationCleanup(node.trailer);
    }
  }
  setupTrailerAnimationCleanup(trailer) {
    this.setupNodeAnimationCleanup(trailer, {
      purpose: "trailer",
      endingProperties: ["width", "height"],
      endingAction: () => {
        delete trailer.isControlledByAnimation;
        if (trailer.parentNode) trailer.parentNode.removeChild(trailer);
        if (trailer.owner) {
          delete trailer.owner.trailer;
        }
        delete trailer.owner;
      }
    });
  }
  setupNodeAnimationCleanup(node, { endingProperties, endingAction, purpose }) {
    if (node.hasCleanupEventListener) return;
    function onTransitionEnd(event) {
      event.stopPropagation();
      event.preventDefault();
      if (!node.changes || !node.changes.activated) return;
      const propertyName = camelCase(event.propertyName);
      node.changes ? " in " + node.changes.type + " animation" : "";
      console.groupEnd();
      if (!endingProperties || endingProperties.includes(propertyName)) {
        endingAction(propertyName);
        node.removeEventListener("transitionend", onTransitionEnd);
        delete node.hasCleanupEventListener;
      }
    }
    node.addEventListener("transitionend", onTransitionEnd, true);
    node.hasCleanupEventListener = onTransitionEnd;
  }
}
const zoomFlyAnimation = new ZoomFlyDOMNodeAnimation();
const standardAnimation = zoomFlyAnimation;
const ZoomFlyDOMNodeAnimation$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ZoomFlyDOMNodeAnimation,
  setAnimationTime,
  standardAnimation,
  zoomFlyAnimation
}, Symbol.toStringTag, { value: "Module" }));
const log$3 = console.log;
function mostAbstractFlow(flow) {
  while (flow.equivalentCreator) flow = flow.equivalentCreator;
  return flow;
}
function aggregateToString(flow) {
  let id = [];
  let scan = flow;
  while (scan) {
    id.unshift(scan.toString());
    scan = scan.equivalentCreator;
  }
  return id.join(" | ");
}
const movedPrimitives = [];
window.moved = movedPrimitives;
function clearNode$1(node, attributes) {
  while (node.childNodes.length > 0) {
    node.removeChild(node.lastChild);
  }
}
const flexAutoStyle = {
  overflow: "hidden",
  boxSizing: "border-box",
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: "auto"
};
class DOMNode extends FlowPrimitive {
  dimensions(contextNode) {
    if (traceWarnings) console.warn("Calls to dimensions() could lead to performance issues as it forces a reflow to measure the size of a dom-node. Note that transition animations may use dimensions() for measuring the size of added nodes");
    let domNode = this.ensureDomNodeBuilt();
    let alreadyInContext;
    if (contextNode) {
      alreadyInContext = domNode.parentNode === contextNode;
      if (!alreadyInContext) {
        domNode = domNode.cloneNode(true);
        contextNode.appendChild(domNode);
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
    }
    const result = {
      width: getWidthIncludingMargin(domNode),
      height: getHeightIncludingMargin(domNode),
      widthIncludingMargin: getWidthIncludingMargin(domNode),
      heightIncludingMargin: getHeightIncludingMargin(domNode),
      widthWithoutMargin: domNode.offsetWidth,
      heightWithoutMargin: domNode.offsetHeight
    };
    if (contextNode) {
      if (!alreadyInContext) {
        contextNode.removeChild(domNode);
      }
    } else {
      document.body.removeChild(domNode);
    }
    return result;
  }
  getDomNode() {
    this.ensureDomNodeBuilt();
    return this.domNode;
  }
  ensureDomNodeBuilt() {
    finalize(this);
    if (!this.buildDOMRepeater) {
      this.buildDOMRepeater = repeat$1("[" + aggregateToString(this) + "].buildDOMRepeater", (repeater) => {
        if (trace$1) console.group(repeater.causalityString());
        this.ensureDomNodeExists();
        this.ensureDomNodeAttributesSet();
        this.ensureDomNodeChildrenInPlace();
        if (trace$1) console.groupEnd();
      }, { priority: 2 });
    }
    return this.domNode;
  }
  createEmptyDomNode() {
    throw new Error("Not implemented yet!");
  }
  ensureDomNodeChildrenInPlace() {
    const node = this.domNode;
    if (!(node instanceof Element)) return;
    const newChildren = this.getPrimitiveChildren(node);
    const newChildNodes = newChildren.map((child) => child.ensureDomNodeBuilt()).filter((child) => !!child);
    let index2 = 0;
    while (index2 < newChildNodes.length) {
      const child = newChildNodes[index2];
      if (child.leader && child.parentNode === child.leader && child.leader.parentNode === node) {
        newChildNodes[index2] = child.leader;
      }
      if (child.trailer && child.parentNode === child.trailer && child.trailer.parentNode === node) {
        newChildNodes[index2] = child.trailer;
      }
      index2++;
    }
    const recoveredNodes = [];
    for (let existingChildNode of node.childNodes) {
      if (existingChildNode.isControlledByAnimation) {
        recoveredNodes.push(existingChildNode);
      } else {
        if (newChildNodes.includes(existingChildNode)) {
          recoveredNodes.push(existingChildNode);
        }
      }
    }
    let anchor = null;
    recoveredNodes.forEach((node2) => {
      node2.anchor = anchor;
      anchor = node2;
    });
    function insertAfter2(array, reference, element) {
      array.splice(array.indexOf(reference) + 1, 0, element);
    }
    recoveredNodes.forEach((node2) => {
      if (!newChildNodes.includes(node2)) {
        let anchor2 = node2.anchor;
        while (!newChildNodes.includes(anchor2) && anchor2) anchor2 = anchor2.anchor;
        if (!anchor2) {
          newChildNodes.unshift(node2);
        } else {
          insertAfter2(newChildNodes, anchor2, node2);
        }
      }
    });
    index2 = node.childNodes.length - 1;
    while (index2 >= 0) {
      const existingChildNode = node.childNodes[index2];
      if (existingChildNode instanceof Element && !newChildNodes.includes(existingChildNode)) {
        node.removeChild(existingChildNode);
      }
      index2--;
    }
    index2 = 0;
    while (index2 < newChildNodes.length) {
      const newChildNode = newChildNodes[index2];
      const existingChildNode = node.childNodes[index2];
      if (existingChildNode) {
        const existingWrappedNode = node.childNodes[index2];
        if (newChildNode !== existingWrappedNode) {
          node.insertBefore(newChildNode, existingChildNode);
        }
      } else {
        node.appendChild(newChildNode);
      }
      index2++;
    }
  }
  getChildNodes() {
    return this.getPrimitiveChildren().map((child) => child.ensureDomNodeBuilt());
  }
  ensureDomNodeExists() {
    if (this.givenDomNode) {
      this.domNode = this.givenDomNode;
      this.domNode.className = aggregateToString(this);
      this.domNode.equivalentCreator = this;
    } else if (!this.createElementRepeater) {
      this.createElementRepeater = repeat$1(mostAbstractFlow(this).toString() + ".createElementRepeater", (repeater) => {
        if (trace$1) log$3(repeater.causalityString());
        this.domNode = this.createEmptyDomNode();
        this.domNode.id = aggregateToString(this);
        this.domNode.equivalentCreator = this;
        let scanFlow = this.equivalentCreator;
        while (scanFlow != null) {
          scanFlow.domNode = this.domNode;
          scanFlow = scanFlow.equivalentCreator;
        }
        if (trace$1) log$3(this.domNode);
      }, { priority: 2 });
    }
    return this.domNode;
  }
  ensureDomNodeAttributesSet() {
    throw new Error("Not implemented yet!");
  }
  synchronizeDomNodeStyle(properties) {
    throw new Error("Not implemented yet!");
  }
  getStandardAnimation() {
    return standardAnimation;
  }
}
const DOMNode$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  DOMNode,
  aggregateToString,
  clearNode: clearNode$1,
  flexAutoStyle,
  mostAbstractFlow,
  movedPrimitives
}, Symbol.toStringTag, { value: "Module" }));
const log$2 = console.log;
function installDOMAnimation() {
  configuration.onFinishReBuildingFlowCallbacks.push(onFinishReBuildingFlow);
  configuration.onFinishReBuildingDOMCallbacks.push(onFinishReBuildingDOM);
}
function resetDOMAnimation() {
  Object.assign(flowChanges, newFlowChanges());
  previousFlowChanges = {};
  counter = 0;
  domFlowTargets = [];
}
let count = 0;
function freezeFlowChanges() {
  count++;
  if (traceAnimation && traceWarnings) console.warn("Risky to use freeze " + count);
}
function unfreezeFlowChanges() {
  count--;
  if (traceAnimation && traceWarnings) console.warn("Unfreeze... " + count);
}
let domFlowTargets = [];
function addDOMFlowTarget(target) {
  domFlowTargets.push(target);
}
function removeDOMFlowTarget(target) {
  domFlowTargets.splice(domFlowTargets.indexOf(target), 1);
}
function logProperties(object, properties) {
  log$2(extractProperties(object, properties));
}
function extractProperties(object, properties) {
  const condensed = {};
  properties.forEach((property) => {
    if (typeof property !== "string") {
      property.partial.forEach((part) => {
        if (object[part]) {
          condensed[part] = object[part];
        }
      });
      if (object[property.compound]) {
        condensed[property.compound] = object[property.compound];
      }
    } else {
      if (object[property]) {
        condensed[property] = object[property];
      }
    }
  });
  return condensed;
}
const flowChanges = newFlowChanges();
function newFlowChanges() {
  return {
    number: 0,
    idPrimitiveMap: {},
    idParentIdMap: {},
    globallyAdded: {},
    globallyRemoved: {},
    globallyResident: {},
    globallyMoved: {},
    globallyAddedAnimated: {},
    globallyRemovedAnimated: {},
    globallyResidentAnimated: {},
    globallyMovedAnimated: {},
    *allAnimatedFlows() {
      for (let flow of Object.values(this.globallyAddedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyRemovedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyResidentAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
    },
    *allAddedFlows() {
      for (let flow of Object.values(this.globallyAdded)) {
        yield flow;
      }
    },
    *allAnimatedAddedFlows() {
      for (let flow of Object.values(this.globallyAddedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedRemovedFlows() {
      for (let flow of Object.values(this.globallyRemovedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedResidentFlows() {
      for (let flow of Object.values(this.globallyResidentAnimated)) {
        yield flow;
      }
    },
    *allAnimatedMovedFlows() {
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedMovedResidentAndRemovedFlows() {
      for (let flow of Object.values(this.globallyResidentAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyRemovedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedMovedResidentFlows() {
      for (let flow of Object.values(this.globallyResidentAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedMovedAddedAndRemovedFlows() {
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyAddedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyRemovedAnimated)) {
        yield flow;
      }
    }
  };
}
let previousFlowChanges = {};
window.flowChanges = flowChanges;
let counter = 0;
const changeType = {
  resident: "resident",
  added: "added",
  removed: "removed",
  moved: "moved"
};
function onFinishReBuildingFlow() {
  counter++;
  if (traceAnimation) {
    logAnimationFrameGroup(counter);
    logAnimationSeparator("---------------------------------------- Flow rebuilt, DOM untouched, calculate changes... -------------------");
    console.groupCollapsed("Potentially start DOM building for new flows here ...");
  }
  Object.assign(previousFlowChanges, flowChanges);
  flowChanges.number++;
  flowChanges.idPrimitiveMap = {};
  flowChanges.idParentIdMap = {};
  flowChanges.globallyAdded = {};
  flowChanges.globallyResident = {};
  flowChanges.globallyMoved = {};
  flowChanges.globallyRemoved = {};
  const idPrimitiveMap = flowChanges.idPrimitiveMap;
  const idParentIdMap = flowChanges.idParentIdMap;
  function analyzePrimitives(idPrimitiveMap2, primitiveFlow) {
    idPrimitiveMap2[primitiveFlow.id] = primitiveFlow;
    idParentIdMap[primitiveFlow.id] = primitiveFlow.parentPrimitive;
    for (let child of primitiveFlow.iteratePrimitiveChildren()) {
      analyzePrimitives(idPrimitiveMap2, child);
    }
  }
  for (let target of domFlowTargets) {
    analyzePrimitives(idPrimitiveMap, target.flow.getPrimitive());
  }
  for (let id in idPrimitiveMap) {
    const primitive = idPrimitiveMap[id];
    const inPreviousMap = previousFlowChanges ? !!previousFlowChanges.idPrimitiveMap[id] : false;
    if (inPreviousMap) {
      if (!previousFlowChanges.idParentIdMap || previousFlowChanges.idParentIdMap[id] === idParentIdMap[id]) {
        flowChanges.globallyResident[id] = primitive;
      } else {
        flowChanges.globallyMoved[id] = primitive;
      }
    } else {
      flowChanges.globallyAdded[id] = primitive;
    }
  }
  for (let id in previousFlowChanges.idPrimitiveMap) {
    const inPreviousMap = previousFlowChanges.idPrimitiveMap[id];
    if (typeof idPrimitiveMap[id] === "undefined" && !inPreviousMap.parentPrimitive) {
      flowChanges.globallyRemoved[id] = inPreviousMap;
    }
  }
  function filterAnimatedInMap(map) {
    return Object.values(map).reduce((result, flow) => {
      if (flow.animation) {
        let stableFoundation = true;
        let scan = flow.parentPrimitive;
        while (scan) {
          if (flowChanges.globallyAdded[scan.id] && (!scan.animation || !scan.animation.allwaysStableFoundationEvenWhenAdded())) {
            stableFoundation = false;
            break;
          }
          scan = scan.parentPrimitive;
        }
        if (stableFoundation || flow.animation.acceptUnstableFoundation(scan)) {
          result[flow.id] = flow;
        }
      }
      return result;
    }, {});
  }
  flowChanges.globallyAddedAnimated = filterAnimatedInMap(flowChanges.globallyAdded);
  flowChanges.globallyResidentAnimated = filterAnimatedInMap(flowChanges.globallyResident);
  flowChanges.globallyMovedAnimated = filterAnimatedInMap(flowChanges.globallyMoved);
  flowChanges.globallyRemovedAnimated = filterAnimatedInMap(flowChanges.globallyRemoved);
  function toStrings(changes) {
    return {
      addedIncludingNonAnimated: Object.values(changes.globallyAdded).map((flow) => flow.toString()),
      added: Object.values(changes.globallyAddedAnimated).map((flow) => flow.toString()),
      resident: Object.values(changes.globallyResidentAnimated).map((flow) => flow.toString()),
      moved: Object.values(changes.globallyMovedAnimated).map((flow) => flow.toString()),
      movedIncludingNonAnimated: Object.values(changes.globallyMoved).map((flow) => flow.toString()),
      removed: Object.values(changes.globallyRemovedAnimated).map((flow) => flow.toString()),
      removedIncludingNonAnimated: Object.values(changes.globallyRemoved).map((flow) => flow.toString())
    };
  }
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.getDomNode()) {
      const changes = {
        number: flowChanges.number,
        activated: false,
        type: changeType.resident,
        previous: flow.changes,
        transitioningProperties: flow.changes && flow.changes.transitioningProperties ? flow.changes.transitioningProperties : {}
      };
      flow.changes = changes;
      flow.domNode.changes = changes;
    }
  }
  for (let flow of flowChanges.allAnimatedMovedFlows()) {
    if (flow.domNode) {
      flow.domNode.changes.type = changeType.moved;
    }
  }
  for (let flow of flowChanges.allAnimatedAddedFlows()) {
    if (flow.getDomNode()) {
      flow.domNode.changes.type = changeType.added;
    }
  }
  for (let flow of flowChanges.allAnimatedRemovedFlows()) {
    if (flow.domNode) {
      flow.domNode.changes.type = changeType.removed;
      flow.domNode.changes.targetDimensions = { width: flow.domNode.offsetWidth, height: flow.domNode.offsetHeight };
    }
  }
  if (traceAnimation) {
    console.groupEnd();
    console.log("New animated changes:");
    log$2(toStrings(flowChanges));
  }
  logAnimationSeparator("---------------------------------------- Measure original bounds... ------------------------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.getDomNode()) {
      flow.animation.recordOriginalBoundsAndStyle(flow);
    }
  }
  logAnimationSeparator("---------------------------------------- Prepare for DOM building... -----------------------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.prepareForDOMBuilding(flow);
    }
  }
  logAnimationSeparator("---------------------------------------- Rebuilding DOM... ----------------------------------------------------");
  if (traceAnimation) console.groupCollapsed("...");
  flowChanges.onFinishReBuildingFlowDone = true;
}
function onFinishReBuildingDOM() {
  if (!flowChanges.onFinishReBuildingFlowDone) return;
  delete flowChanges.onFinishReBuildingFlowDone;
  if (traceAnimation) console.groupEnd();
  logAnimationSeparator("---------------------------------------- DOM rebuilt, measure target sizes ... -------------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.domJustRebuiltMeasureTargetSizes(flow);
    }
  }
  logAnimationSeparator("---------------------------------------- Emulate original footprints and styles ------------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.emulateOriginalFootprintsAndFixateAnimatedStyle(flow);
    }
  }
  logAnimationSeparator("---------------------------------------- Emulate original bounds for FLIP animations -------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.emulateOriginalBounds(flow);
    }
  }
  activateAnimationAfterFirstRender({ ...flowChanges });
}
function activateAnimationAfterFirstRender(currentFlowChanges) {
  postponeInvalidations();
  requestAnimationFrame(() => {
    logAnimationSeparator("---------------------------------------- Rendered first frame, activate animations...  ---------------------");
    for (let flow of currentFlowChanges.allAnimatedFlows()) {
      if (flow.domNode) {
        if (traceAnimation) {
          console.group();
          console.log(flow.domNode);
        }
        flow.animation.activateAnimation(flow, currentFlowChanges);
        if (traceAnimation) {
          console.groupEnd();
        }
      }
      flow.changes.activated = true;
    }
    logAnimationSeparator("---------------------------------------- Setup animation cleanup...  ---------------------");
    for (let flow of currentFlowChanges.allAnimatedFlows()) {
      if (flow.domNode) {
        flow.animation.setupAnimationCleanup(flow);
      }
    }
    logAnimationSeparator(counter + "------------------------------------------------------------------------------------------------------------");
    console.groupEnd();
    continueInvalidations();
  });
}
function sameBounds(b1, b2) {
  return b1.top === b2.top && b1.left === b2.left && b1.width === b2.width && b1.height === b2.height;
}
const camelCase = /* @__PURE__ */ function() {
  var DEFAULT_REGEX = /[-_]+(.)?/g;
  function toUpper(match, group1) {
    return group1 ? group1.toUpperCase() : "";
  }
  return function(str, delimiters) {
    return str.replace(delimiters ? new RegExp("[" + delimiters + "]+(.)?", "g") : DEFAULT_REGEX, toUpper);
  };
}();
function getHeightIncludingMargin(node) {
  var styles = window.getComputedStyle(node);
  var margin = parseFloat(styles["marginTop"]) + parseFloat(styles["marginBottom"]);
  return Math.ceil(node.offsetHeight + margin);
}
function getWidthIncludingMargin(node) {
  var styles = window.getComputedStyle(node);
  var margin = parseFloat(styles["marginLeft"]) + parseFloat(styles["marginRight"]);
  return Math.ceil(node.offsetWidth + margin);
}
function parseMatrix(matrix) {
  function extractScaleTranslate(matrix2) {
    return {
      scaleX: matrix2[0],
      scaleY: matrix2[3],
      translateX: matrix2[4],
      translateY: matrix2[5]
    };
  }
  let matrixPattern = /^\w*\((-?((\d+)|(\d*\.\d+)),\s*)*(-?(\d+)|(\d*\.\d+))\)/i;
  if (matrixPattern.test(matrix)) {
    let matrixCopy = matrix.replace(/^\w*\(/, "").replace(")", "");
    let matrixValue = matrixCopy.split(/\s*,\s*/).map((value) => parseFloat(value));
    return extractScaleTranslate(matrixValue);
  }
  return extractScaleTranslate([1, 0, 0, 1, 0, 0]);
}
const DOMAnimation = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  addDOMFlowTarget,
  camelCase,
  changeType,
  extractProperties,
  flowChanges,
  freezeFlowChanges,
  getHeightIncludingMargin,
  getWidthIncludingMargin,
  installDOMAnimation,
  logProperties,
  onFinishReBuildingDOM,
  onFinishReBuildingFlow,
  parseMatrix,
  get previousFlowChanges() {
    return previousFlowChanges;
  },
  removeDOMFlowTarget,
  resetDOMAnimation,
  sameBounds,
  unfreezeFlowChanges
}, Symbol.toStringTag, { value: "Module" }));
const log$1 = console.log;
class DOMElementNode extends DOMNode {
  initialUnobservables() {
    let result = super.initialUnobservables();
    result.previouslySetStyles = {};
    result.previouslySetAttributes = {};
    return result;
  }
  setProperties({ children, tagName, attributes }) {
    this.children = children;
    this.tagName = tagName ? tagName : "div";
    this.attributes = attributes ? attributes : {};
  }
  createEmptyDomNode() {
    const result = document.createElement(this.tagName);
    return result;
  }
  ensureDomNodeAttributesSet() {
    const element = this.domNode;
    const newAttributes = this.attributes;
    const newPreviouslySetAttributes = {};
    if (this.tagName.toUpperCase() !== element.tagName) {
      throw new Error("Too high expectations error. Cannot change tagName of existing HTML element. Please do not change the tagName property once set!");
    }
    for (let property in this.unobservable.previouslySetAttributes) {
      if (typeof newAttributes[property] === "undefined") {
        if (property === "style") {
          this.updateStyle(element, {});
        } else {
          element[property] = "";
        }
      }
    }
    for (let property in newAttributes) {
      const newValue = newAttributes[property];
      if (property === "style") {
        this.updateStyle(element, newValue);
      } else {
        if (this.unobservable.previouslySetAttributes[property] !== newValue) {
          if (property === "class") {
            element.setAttribute("class", newValue);
          } else {
            element[property] = newValue;
          }
        }
        newPreviouslySetAttributes[property] = newValue;
      }
    }
    this.unobservable.previouslySetAttributes = newPreviouslySetAttributes;
  }
  updateStyle(element, newStyle) {
    const elementStyle = element.style;
    const newPreviouslySetStyles = {};
    for (let property in this.unobservable.previouslySetStyles) {
      if (typeof newStyle[property] === "undefined") {
        elementStyle[property] = "";
      }
    }
    for (let property in newStyle) {
      const newValue = newStyle[property];
      if (this.unobservable.previouslySetStyles[property] !== newValue) {
        elementStyle[property] = newValue;
      }
      newPreviouslySetStyles[property] = newValue;
    }
    this.unobservable.previouslySetStyles = newPreviouslySetStyles;
  }
  // getAnimatedFinishStyles() {
  //   const style = (this.attributes && this.attributes.style) ? this.attributes.style : {};
  //   const animation = this.animation ? this.animation : this.getAnimation();
  //   return extractProperties(style, animation.animatedProperties);
  // }
  synchronizeDomNodeStyle(properties) {
    if (!properties) {
      properties = Object.keys(this.unobservable.previouslySetAttributes);
      log$1(properties);
    }
    if (!(properties instanceof Array)) properties = [properties];
    const style = this.attributes && this.attributes.style ? this.attributes.style : {};
    const same = (styleValueA, styleValueB) => typeof styleValueA === "undefined" && typeof styleValueB === "undefined" || styleValueA === styleValueB;
    for (let property of properties) {
      if (typeof property === "string") {
        if (!same(style[property], this.domNode.style[property])) {
          this.domNode.style[property] = style[property] ? style[property] : "";
        }
      } else {
        const propertyCompoundValue = style[property.compound];
        if (propertyCompoundValue) {
          if (!same(propertyCompoundValue, this.domNode.style[property.compound])) {
            this.domNode.style[property.compound] = propertyCompoundValue ? propertyCompoundValue : "";
          }
        } else {
          const propertyPartialValues = {};
          property.partial.forEach((property2) => {
            if (style[property2]) {
              propertyPartialValues[property2] = style[property2];
            }
          });
          if (Object.keys(propertyPartialValues).length > 0) {
            Object.assign(this.domNode.style, propertyPartialValues);
          } else {
            this.domNode.style[property.compound] = "";
          }
        }
      }
    }
  }
}
const DOMElementNode$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  DOMElementNode
}, Symbol.toStringTag, { value: "Module" }));
class DOMTextNode extends DOMNode {
  setProperties({ text }) {
    this.text = text;
  }
  createEmptyDomNode() {
    return document.createTextNode("");
  }
  ensureDomNodeAttributesSet() {
    this.domNode.nodeValue = this.text;
  }
  synchronizeDomNodeStyle(properties) {
  }
}
const DOMTextNode$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  DOMTextNode
}, Symbol.toStringTag, { value: "Module" }));
class DOMFlowTarget extends FlowTarget {
  constructor(rootElement, configuration2 = {}) {
    const { creator = null, fullWindow = true } = configuration2;
    super();
    if (!this.key) this.key = configuration2.key ? configuration2.key : null;
    this.animate = typeof configuration2.animate === "undefined" ? true : configuration2.animate;
    if (this.animate) addDOMFlowTarget(this);
    this.creator = creator;
    this.rootElement = rootElement;
    if (fullWindow) {
      document.body.style.margin = "0px";
      document.body.style.width = "100%";
      document.body.style.height = window.innerHeight + "px";
      this.rootElement.style.width = "100%";
      this.rootElement.style.height = "100%";
      this.rootElement.style.overflow = "hidden";
      window.addEventListener("resize", () => {
        if (document.body.style.height != window.innerHeight + "px")
          document.body.style.height = window.innerHeight + "px";
        transaction(() => {
          if (this.flow) {
            this.flow.bounds = { width: window.innerWidth, height: window.innerHeight };
          }
        });
      });
    }
    this.state = observable({
      modalDiv: null
    });
    return observable(this, this.key);
  }
  toString() {
    return "[target]" + (this.flow ? this.flow.toString() : "null");
  }
  setContent(flow) {
    flow.bounds = { width: window.innerWidth, height: window.innerHeight };
    super.setContent(flow);
  }
  ensureContentInPlace() {
    this.contentPlacementRepeater = repeat(this.toString() + ".contentPlacementRepeater", (repeater) => {
      if (trace) console.group(repeater.causalityString());
      placeContent();
      clearNode(this.rootElement);
      this.flow.getPrimitive().givenDomNode = this.rootElement;
      workOnPriorityLevel(2, () => this.flow.getPrimitive().ensureDomNodeBuilt());
      if (trace) console.groupEnd();
    }, { priority: 2 });
  }
  dispose() {
    super.dispose();
    if (this.animate) removeDOMFlowTarget(this);
  }
  create(...parameters) {
    const properties = findKeyInProperties(readFlowProperties(parameters));
    switch (properties.type) {
      case "dom.textNode":
        return new DOMTextNode(properties);
      case "dom.elementNode":
        return new DOMElementNode(properties);
    }
  }
}
const DOMFlowTarget$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  DOMFlowTarget
}, Symbol.toStringTag, { value: "Module" }));
const log = console.log;
class FlyFromTopDOMNodeAnimation extends ZoomFlyDOMNodeAnimation {
  constructor() {
    super(...arguments);
    __publicField(this, "animateLeaderWidth", false);
    __publicField(this, "animateLeaderHeight", true);
  }
  emulateOriginalFootprintsAndFixateAnimatedStyle(flow) {
    console.group("Emulate original style and footprints for " + this.changesChain(flow) + ": " + flow.toString());
    const node = flow.domNode;
    const trailer = node.trailer;
    switch (flow.changes.type) {
      case changeType.added:
      case changeType.moved:
        this.setupALeaderForIncomingWithOriginalFootprint(node);
        break;
    }
    switch (flow.changes.type) {
      case changeType.removed:
        if (node.parentNode !== trailer) {
          trailer.appendChild(node);
        }
        if (trailer) this.show(trailer);
        break;
      case changeType.moved:
        if (trailer) this.show(trailer);
        break;
    }
    if (node.ongoingAnimation) {
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
      transform: "matrix(1, 0, 0, 1, 0, -" + node.changes.targetDimensions.heightWithoutMargin + ")",
      //transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px",
      height: node.changes.targetDimensions.heightWithoutMargin + "px",
      // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001"
    });
  }
  activateAnimation(flow) {
    const node = flow.domNode;
    const ongoingAnimation = node.ongoingAnimation;
    flow.changes;
    const trailer = node.trailer;
    const leader = node.leader;
    console.group("Activate for " + this.changesChain(flow) + ": " + flow.toString());
    log(extractProperties(node.style, this.typicalAnimatedProperties));
    if (node.leader) {
      log(extractProperties(node.leader.style, this.typicalAnimatedProperties));
    }
    if (node.trailer) {
      log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
    }
    if (ongoingAnimation) {
      switch (flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          break;
        case changeType.resident:
          if (flow.outOfPosition) {
            delete flow.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
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
      switch (flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          this.startAnimationChain(node);
          break;
        case changeType.resident:
          if (flow.outOfPosition) {
            this.startAnimationChain(node);
            delete flow.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
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
    log(extractProperties(flow.domNode.style, this.typicalAnimatedProperties));
    if (leader) {
      log(extractProperties(leader.style, this.typicalAnimatedProperties));
    }
    if (node.trailer) {
      log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
    }
    console.groupEnd();
  }
  targetPositionForFlyOut(node) {
    node.style.transition = this.removeTransition();
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, -" + node.changes.originalDimensions.heightWithoutMargin + ")",
      opacity: "1"
    });
  }
}
class FlyFromLeftDOMNodeAnimation extends FlyFromTopDOMNodeAnimation {
  constructor() {
    super(...arguments);
    __publicField(this, "animateLeaderWidth", true);
    __publicField(this, "animateLeaderHeight", false);
  }
  originalPositionForFlyIn(node) {
    Object.assign(node.style, {
      position: "absolute",
      transform: "matrix(1, 0, 0, 1, -" + node.changes.targetDimensions.widthWithoutMargin + ", 0)",
      //transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px",
      height: node.changes.targetDimensions.heightWithoutMargin + "px",
      // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001"
    });
  }
  targetPositionForFlyOut(node) {
    node.style.transition = this.removeTransition();
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, -" + node.changes.originalDimensions.widthWithoutMargin + ", 0)",
      opacity: "1"
    });
  }
}
const flyFromTopAnimation = new FlyFromTopDOMNodeAnimation();
const flyFromLeftAnimation = new FlyFromLeftDOMNodeAnimation();
const FlyDOMNodeAnimation = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  flyFromLeftAnimation,
  flyFromTopAnimation
}, Symbol.toStringTag, { value: "Module" }));
function fitTextWithinWidth(text, targetWidth, fontWeight) {
  if (!fontWeight) fontWeight = 400;
  let lowerLimitFontSize = 0;
  let experimentalFactor = 0.324;
  let guessFontSize = targetWidth * experimentalFactor;
  let guessWidth;
  let upperLimitFontSize = guessFontSize * 2;
  let iterations = 10;
  while (iterations-- > 0) {
    guessWidth = uncachedTextWidth(text, guessFontSize, fontWeight);
    if (guessWidth == targetWidth) {
      return guessFontSize;
    } else if (guessWidth > targetWidth) {
      upperLimitFontSize = guessFontSize;
      guessFontSize = (guessFontSize + lowerLimitFontSize) / 2;
    } else if (guessWidth < targetWidth) {
      lowerLimitFontSize = guessFontSize;
      guessFontSize = (guessFontSize + upperLimitFontSize) / 2;
    }
  }
  return guessFontSize;
}
function fitTextWithinCapHeight(targetHeight) {
  const fontSize = targetHeight / getFontSizeToCapHeightRatio();
  return fontSize;
}
const textMeasures = {};
function textWidth(text, styleOrFontSize) {
  return textDimensions(text, styleOrFontSize).width;
}
function textHeight(text, styleOrFontSize) {
  return textDimensions(text, styleOrFontSize).height;
}
function textDimensions(text, styleOrFontSize) {
  if (typeof styleOrFontSize === "undefined") styleOrFontSize = 13;
  if (typeof styleOrFontSize === "number") styleOrFontSize = { fontSize: styleOrFontSize };
  const style = styleOrFontSize;
  const fontSize = style.fontSize ? style.fontSize : 13;
  const fontWeight = style.fontWeight ? style.fontWeight : 400;
  const styleKey = fontSize + ":" + fontWeight;
  if (typeof textMeasures[styleKey] === "undefined") {
    textMeasures[styleKey] = uncachedTextDimensions(text, fontSize, fontWeight);
  }
  const styleBucket = textMeasures[styleKey];
  if (typeof styleBucket[text] === "undefined") {
    styleBucket[text] = uncachedTextDimensions(text, fontSize, fontWeight);
  }
  return styleBucket[text];
}
function uncachedTextWidth(text, fontSize, fontWeight) {
  return uncachedTextDimensions(text, fontSize, fontWeight).width;
}
function uncachedTextHeight(text, fontSize, fontWeight) {
  return uncachedTextDimensions(text, fontSize, fontWeight).height;
}
function uncachedTextDimensions(text, fontSize, fontWeight) {
  const parentElement = document.body;
  let div2 = document.createElement("div");
  div2.style["font-weight"] = fontWeight;
  div2.style["font-size"] = fontSize + "px";
  div2.style["white-space"] = "pre";
  div2.style["position"] = "absolute";
  div2.style["margin"] = "0px";
  div2.style["padding"] = "0px";
  div2.innerHTML = text;
  parentElement.appendChild(div2);
  let width = div2.clientWidth + 1;
  let height = div2.scrollHeight + 1;
  parentElement.removeChild(div2);
  return {
    width,
    height
  };
}
let fontSizeToCapHeightRatio = null;
function capHeight(fontSize) {
  return Math.ceil(getFontSizeToCapHeightRatio() * fontSize);
}
function getFontSizeToCapHeightRatio() {
  if (!fontSizeToCapHeightRatio) {
    const fontSize = 60;
    const metrics = getMetrics("Roboto", fontSize + "px");
    fontSizeToCapHeightRatio = metrics.px.ascent / fontSize;
  }
  return fontSizeToCapHeightRatio;
}
function getGoldenRatioTopPadding(wrapperHeight, contentHeight) {
  const gRatio = 1.618;
  const emptySpace = wrapperHeight - contentHeight;
  return emptySpace - emptySpace / gRatio;
}
function getMetrics(fontName, fontSize) {
  let myCanvas = document.createElement("canvas");
  myCanvas.style["width"] = "200px";
  myCanvas.style["height"] = "200px";
  document.body.appendChild(myCanvas);
  let testtext = "Sixty Handgloves ABC";
  if (!document.defaultView.getComputedStyle) {
    throw "ERROR: 'document.defaultView.getComputedStyle' not found. This library only works in browsers that can report computed CSS values.";
  }
  let getCSSValue = function(element, property) {
    return document.defaultView.getComputedStyle(element, null).getPropertyValue(property);
  };
  CanvasRenderingContext2D.prototype.measureTextNew = function(textstring) {
    let metrics2 = this.measureText(textstring), fontFamily = getCSSValue(this.canvas, "font-family"), fontSize2 = getCSSValue(this.canvas, "font-size").replace("px", ""), isSpace = !/\S/.test(textstring);
    metrics2.fontsize = fontSize2;
    let leadDiv = document.createElement("div");
    leadDiv.style.position = "absolute";
    leadDiv.style.margin = 0;
    leadDiv.style.padding = 0;
    leadDiv.style.opacity = 0;
    leadDiv.style.font = fontSize2 + "px " + fontFamily;
    leadDiv.innerHTML = textstring + "<br/>" + textstring;
    document.body.appendChild(leadDiv);
    metrics2.leading = 1.2 * fontSize2;
    let leadDivHeight = getCSSValue(leadDiv, "height");
    leadDivHeight = leadDivHeight.replace("px", "");
    if (leadDivHeight >= fontSize2 * 2) {
      metrics2.leading = leadDivHeight / 2 | 0;
    }
    document.body.removeChild(leadDiv);
    if (!isSpace) {
      let canvas2 = document.createElement("canvas");
      let padding = 100;
      canvas2.width = metrics2.width + padding;
      canvas2.height = 3 * fontSize2;
      canvas2.style.opacity = 1;
      canvas2.style.fontFamily = fontFamily;
      canvas2.style.fontSize = fontSize2;
      let ctx = canvas2.getContext("2d");
      ctx.font = fontSize2 + "px " + fontFamily;
      let w2 = canvas2.width, h2 = canvas2.height, baseline = h2 / 2;
      ctx.fillStyle = "white";
      ctx.fillRect(-1, -1, w2 + 2, h2 + 2);
      ctx.fillStyle = "black";
      ctx.fillText(textstring, padding / 2, baseline);
      let pixelData = ctx.getImageData(0, 0, w2, h2).data;
      let i = 0, w4 = w2 * 4, len = pixelData.length;
      while (++i < len && pixelData[i] === 255) {
      }
      let ascent = i / w4 | 0;
      i = len - 1;
      while (--i > 0 && pixelData[i] === 255) {
      }
      let descent = i / w4 | 0;
      for (i = 0; i < len && pixelData[i] === 255; ) {
        i += w4;
        if (i >= len) {
          i = i - len + 4;
        }
      }
      let minx = i % w4 / 4 | 0;
      let step = 1;
      for (i = len - 3; i >= 0 && pixelData[i] === 255; ) {
        i -= w4;
        if (i < 0) {
          i = len - 3 - step++ * 4;
        }
      }
      let maxx = i % w4 / 4 + 1 | 0;
      metrics2.ascent = baseline - ascent;
      metrics2.descent = descent - baseline;
      metrics2.bounds = {
        minx: minx - padding / 2,
        maxx: maxx - padding / 2,
        miny: 0,
        maxy: descent - ascent
      };
      metrics2.height = 1 + (descent - ascent);
    } else {
      metrics2.ascent = 0;
      metrics2.descent = 0;
      metrics2.bounds = {
        minx: 0,
        maxx: metrics2.width,
        // Best guess
        miny: 0,
        maxy: 0
      };
      metrics2.height = 0;
    }
    return metrics2;
  };
  let wf = document.createElement("script");
  wf.src = ("https:" == document.location.protocol ? "https" : "http") + "://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js";
  wf.type = "text/javascript";
  wf.async = "true";
  let s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(wf, s);
  document.body.style.fontFamily = ['"' + fontName + '"', "Arial sans"].join(" ");
  let canvas = myCanvas;
  let context = canvas.getContext("2d");
  let w = 220, h = 220;
  canvas.style.font = [fontSize, fontName].join(" ");
  context.font = [fontSize, fontName].join(" ");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.measureTextNew("x").height;
  context.measureTextNew("H").height;
  let metrics = context.measureTextNew("Hxy");
  let xStart = (w - metrics.width) / 2;
  context.fontFamily = fontName;
  context.fillStyle = "#FFAF00";
  context.fillRect(xStart, h / 2 - metrics.ascent, metrics.bounds.maxx - metrics.bounds.minx, 1 + metrics.bounds.maxy - metrics.bounds.miny);
  context.fillStyle = "#333333";
  context.fillText(testtext, xStart, h / 2);
  metrics.fontsize = parseInt(metrics.fontsize);
  metrics.offset = Math.ceil((metrics.leading - metrics.height) / 2);
  let myMetrics = {
    px: JSON.parse(JSON.stringify(metrics)),
    relative: {
      fontsize: 1,
      offset: metrics.offset / metrics.fontsize,
      height: metrics.height / metrics.fontsize,
      capHeight: metrics.capHeight / metrics.fontsize,
      ascender: metrics.ascender / metrics.fontsize,
      xHeight: metrics.xHeight / metrics.fontsize,
      descender: metrics.descender / metrics.fontsize
    },
    descriptions: {
      ascent: "distance above baseline",
      descent: "distance below baseline",
      height: "ascent + 1 for the baseline + descent",
      leading: "distance between consecutive baselines",
      bounds: {
        minx: "can be negative",
        miny: "can also be negative",
        maxx: "not necessarily the same as metrics.width",
        maxy: "not necessarily the same as metrics.height"
      },
      capHeight: "height of the letter H",
      ascender: "distance above the letter x",
      xHeight: "height of the letter x (1ex)",
      descender: "distance below the letter x"
    }
  };
  Array.prototype.slice.call(
    document.getElementsByTagName("canvas"),
    0
  ).forEach(function(c, i) {
    if (i > 0) document.body.removeChild(c);
  });
  document.body.removeChild(myCanvas);
  return myMetrics;
}
const fontMetrics = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  capHeight,
  fitTextWithinCapHeight,
  fitTextWithinWidth,
  getFontSizeToCapHeightRatio,
  getGoldenRatioTopPadding,
  textDimensions,
  textHeight,
  textWidth,
  uncachedTextDimensions,
  uncachedTextHeight,
  uncachedTextWidth
}, Symbol.toStringTag, { value: "Module" }));
const index = {
  ...BasicHtml,
  ...DOMAnimation,
  ...DOMElementNode$1,
  ...DOMFlowTarget$1,
  ...DOMNode$1,
  ...DOMNodeAnimation$1,
  ...domNodeAttributes,
  ...DOMTextNode$1,
  ...FlyDOMNodeAnimation,
  ...fontMetrics,
  ...ZoomFlyDOMNodeAnimation$1
};
export {
  index as default
};
