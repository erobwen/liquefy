
import { elemenNode, textNode, text, span, div, styledDiv, textToTextNode} from "./BasicHtml";
import { installDOMAnimation, resetDOMAnimation, freezeFlowChanges, unfreezeFlowChanges, addDOMFlowTarget, removeDOMFlowTarget, logProperties, extractProperties, flowChanges, previousFlowChanges, changeType, onFinishReBuildingFlow, onFinishReBuildingDOM, sameBounds, camelCase, getHeightIncludingMargin, getWidthIncludingMargin, parseMatrix } from "./DOMAnimation";
import { DOMElementNode } from "./DOMElementNode";
import { DOMFlowTarget} from "./DOMFlowTarget"
import { mostAbstractFlow, aggregateToString, movedPrimitives, clearNode, DOMNode  } from "./DOMNode";
import { DOMNodeAnimation } from "./DOMNodeAnimation"
import { extractAttributes, eventHandlerContentElementAttributesCamelCase, globalElementAttributesCamelCase, extractChildStyles, extractProperty } from "./domNodeAttributes";
import { DOMTextNode } from "./DOMTextNode"
import { flyFromLeftAnimation, flyFromTopAnimation } from "./FlyDOMNodeAnimation"
import { fitTextWithinWidth, fitTextWithinCapHeight, textWidth, textHeight, textDimensions, uncachedTextWidth, uncachedTextHeight, uncachedTextDimensions, capHeight, getFontSizeToCapHeightRatio, getGoldenRatioTopPadding } from "./fontMetrics"
import { setAnimationTime, ZoomFlyDOMNodeAnimation, zoomFlyAnimation, standardAnimation } from "./ZoomFlyDOMNodeAnimation"

export {
    // Basic HTML
    elemenNode, 
    textNode,
    text,
    span, 
    div, 
    styledDiv, 
    textToTextNode,

    // DOM Animation
    installDOMAnimation, 
    resetDOMAnimation, 
    freezeFlowChanges, 
    unfreezeFlowChanges, 
    addDOMFlowTarget, 
    removeDOMFlowTarget, 
    logProperties, 
    extractProperties, 
    flowChanges, 
    previousFlowChanges, 
    changeType, 
    onFinishReBuildingFlow, 
    onFinishReBuildingDOM, 
    sameBounds, 
    camelCase, 
    getHeightIncludingMargin, 
    getWidthIncludingMargin, 
    parseMatrix,
    
    // DOMElementNode
    DOMElementNode,

    //DOMFlowTarget
    DOMFlowTarget,

    //DOMNode
    mostAbstractFlow, 
    aggregateToString, 
    movedPrimitives, 
    clearNode, 
    DOMNode,

    //DOMNodeAnimation
    DOMNodeAnimation,

    //domNodeAttributes
    extractAttributes, 
    eventHandlerContentElementAttributesCamelCase, 
    globalElementAttributesCamelCase, 
    extractChildStyles, 
    extractProperty,
    
    //DOMTextNode 
    DOMTextNode,

    // FlyDOMNodeAnimation
    flyFromLeftAnimation, 
    flyFromTopAnimation,

    // fontMetrics
    fitTextWithinWidth, 
    fitTextWithinCapHeight, 
    textWidth, 
    textHeight, 
    textDimensions, 
    uncachedTextWidth, 
    uncachedTextHeight, 
    uncachedTextDimensions, 
    capHeight, 
    getFontSizeToCapHeightRatio, 
    getGoldenRatioTopPadding, 

    // ZoomFlyDOMNodeAnimation
    setAnimationTime, 
    ZoomFlyDOMNodeAnimation, 
    zoomFlyAnimation, 
    standardAnimation
};
