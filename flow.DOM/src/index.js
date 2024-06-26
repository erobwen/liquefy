
import { elemenNode, textNode, text, span, div, styledDiv, textToTextNode} from "./BasicHtml";
import { DOMElementNode } from "./DOMElementNode";
import { DOMTextNode } from "./DOMTextNode"
import { DOMFlowTarget} from "./DOMFlowTarget"
import { mostAbstractFlow, aggregateToString, clearNode, getWidthIncludingMargin, getHeightIncludingMargin, DOMNode } from "./DOMNode";
import { extractAttributes, eventHandlerContentElementAttributesCamelCase, globalElementAttributesCamelCase, extractChildStyles, extractProperty } from "./domNodeAttributes";
import { fitTextWithinWidth, fitTextWithinCapHeight, textWidth, textHeight, textDimensions, uncachedTextWidth, uncachedTextHeight, uncachedTextDimensions, capHeight, getFontSizeToCapHeightRatio, getGoldenRatioTopPadding } from "./fontMetrics"

// Animation
import { installDOMAnimation, resetDOMAnimation, freezeFlowChanges, unfreezeFlowChanges, logProperties, extractProperties, flowChanges, previousFlowChanges, changeType, onFinishReBuildingFlow, onFinishReBuildingDOM, sameBounds, camelCase, parseMatrix } from "./DOMAnimation";
import { DOMNodeAnimation } from "./DOMNodeAnimation"
import { flyFromLeftAnimation, flyFromTopAnimation } from "./FlyDOMNodeAnimation"
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
    
    // DOMElementNode
    DOMElementNode,

    //DOMFlowTarget
    DOMFlowTarget,

    //DOMNode
    mostAbstractFlow, 
    aggregateToString, 
    clearNode, 
    getWidthIncludingMargin,
    getHeightIncludingMargin,
    DOMNode,

    //domNodeAttributes
    extractAttributes, 
    eventHandlerContentElementAttributesCamelCase, 
    globalElementAttributesCamelCase, 
    extractChildStyles, 
    extractProperty,
    
    //DOMTextNode 
    DOMTextNode,

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

    // Animation

    // DOM Animation
    installDOMAnimation, 
    resetDOMAnimation, 
    freezeFlowChanges, 
    unfreezeFlowChanges,
    logProperties, 
    extractProperties, 
    flowChanges, 
    previousFlowChanges, 
    changeType, 
    onFinishReBuildingFlow, 
    onFinishReBuildingDOM, 
    sameBounds, 
    camelCase, 
    parseMatrix,

    //DOMNodeAnimation
    DOMNodeAnimation,

    // FlyDOMNodeAnimation
    flyFromLeftAnimation, 
    flyFromTopAnimation,

    // ZoomFlyDOMNodeAnimation
    setAnimationTime, 
    ZoomFlyDOMNodeAnimation, 
    zoomFlyAnimation, 
    standardAnimation
};
