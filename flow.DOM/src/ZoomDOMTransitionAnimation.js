import { draw, insertAfter, extractProperties, logMark } from "@liquefy/flow.core";

import { camelCase, changeType, componentChanges, freezeComponentChanges, sameBounds, unfreezeComponentChanges } from "./DOMAnimation";
import { DOMTransitionAnimation } from "./DOMTransitionAnimation";
import { ZoomFlyDOMTransitionAnimation } from "./ZoomFlyDOMTransitionAnimation";

const log = console.log;

let animationTime = 1;

export function setAnimationTime(value) {
  animationTime = value; 
}


export class ZoomDOMTransitionAnimation extends ZoomFlyDOMTransitionAnimation {
  /**
   * Emulate original bounds
   */
  emulateOriginalBounds(flow) {
  }
}

export const zoomAnimation = new ZoomDOMTransitionAnimation();