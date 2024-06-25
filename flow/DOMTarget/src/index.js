
import * as BasicHtml from "./BasicHtml";
import * as DOMAnimation from "./DOMAnimation";
import * as DOMElementNode from "./DOMElementNode";
import * as DOMFlowTarget from "./DOMFlowTarget"
import * as DOMNode from "./DOMNode"
import * as DOMNodeAnimation from "./DOMNodeAnimation"
import * as domNodeAttributes from "./domNodeAttributes"
import * as DOMTextNode from "./DOMTextNode"
import * as FlyDOMNodeAnimation from "./FlyDOMNodeAnimation"
import * as fontMetrics from "./fontMetrics"
import * as ZoomFlyDOMNodeAnimation from "./ZoomFlyDOMNodeAnimation"

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
