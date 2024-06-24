
import BasicHtml from "./BasicHtml";
import DOMAnimation from "./DOMAnimation";
import DOMElementNode from "./DOMElementNode";
import DOMFlowTarget from "./DOMFlowTarget"
import DOMNode from "./DOMNode"
import DOMNodeAnimation from "./DOMNodeAnimation"
import domNodeAttributes from "./domNodeAttributes"
import DOMTextNode from "./DOMTextNode"
import FlyDOMNodeAnimation from "./FlyDOMNodeAnimation"
import fontMetrics from "./fontMetrics"
import ZoomFlyDOMNodeAnimation from "./ZoomFlyDOMNodeAnimation"

export default {
    ...BasicHtml,
    ...DOMAnimation,
    ...DOMElementNode,
    ...DOMFlowTarget,
    ...DOMNode,
    ...DOMNodeAnimation,
    ...domNodeAttributes,
    ...DOMTextNode,
    ...FlyDOMNodeAnimation,
    ...fontMetrics,
    ...ZoomFlyDOMNodeAnimation
};
