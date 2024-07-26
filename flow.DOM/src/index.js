
import { 
  address,
  article,    
  aside,
  footer,
  header,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  group,
  main,
  nav,
  section,
  search,
  blockquote,
  dd,
  div,
  dl,
  dt,
  figcaption,
  figure,
  hr,
  li,
  menu,
  ol,
  p,
  pre,
  ul,
  a,
  abbr,
  b,
  bdi,
  bdo,
  br,
  cite,
  code,
  data,
  dfn,
  em,
  i,
  kbd,
  mark,
  q,
  rp,
  rt,
  ruby,
  s,
  samp,
  small,
  span,
  strong,
  sub,
  sup,
  time,
  u,
  htmlVar,
  wbr,
  area,
  audio,
  img,
  map,
  track,
  video,
  embed,
  iframe,
  object,
  picture,
  portal,
  source,
  svg,
  math,
  canvas,
  noscript,
  script,
  del,
  ins,
  caption,
  col,
  colgroup,
  table,
  tbody,
  td,
  tfoot,
  th,
  thead,
  tr,
  button,
  datalist,
  fieldset,
  form,
  input,
  label,
  legend,
  meter,
  optgroup,
  option,
  output,
  progress,
  select,
  textarea,
  details,
  dialog,
  summary,
  slot,
  template
} from "./HTMLTags";
import { addDefaultStyleToProperties } from "./HTMLBuilding";
import { DOMElementNode, elementNode } from "./DOMElementNode";
import { getThemedComponent } from "./domFlowBuildContext"
import { textNode, text, DOMTextNode, findImplicitSingleTextInContent, getFlowPropertiesWithImplicitSingleText } from "./DOMTextNode"
import { DOMFlowTarget} from "./DOMFlowTarget"
import { mostAbstractFlow, aggregateToString, clearNode, getWidthIncludingMargin, getHeightIncludingMargin, DOMNode } from "./DOMNode";
import { extractAttributes, eventHandlerContentElementAttributesCamelCase, globalElementAttributesCamelCase, extractChildStyles } from "./domNodeAttributes";
import { fitTextWithinWidth, fitTextWithinCapHeight, textWidth, textHeight, textDimensions, uncachedTextWidth, uncachedTextHeight, uncachedTextDimensions, capHeight, getFontSizeToCapHeightRatio, getGoldenRatioTopPadding } from "./fontMetrics"

// Animation
import { installDOMAnimation, resetDOMAnimation, freezeFlowChanges, unfreezeFlowChanges, logProperties, flowChanges, previousFlowChanges, changeType, onFinishReBuildingFlow, onFinishReBuildingDOM, sameBounds, camelCase, parseMatrix } from "./DOMAnimation";
import { DOMNodeAnimation } from "./DOMNodeAnimation"
import { flyFromLeftAnimation, flyFromTopAnimation } from "./FlyDOMNodeAnimation"
import { setAnimationTime, ZoomFlyDOMNodeAnimation, zoomFlyAnimation, standardAnimation } from "./ZoomFlyDOMNodeAnimation"


export {
    // HTML tags
    address,
    article,    
    aside,
    footer,
    header,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    group,
    main,
    nav,
    section,
    search,
    blockquote,
    dd,
    div,
    dl,
    dt,
    figcaption,
    figure,
    hr,
    li,
    menu,
    ol,
    p,
    pre,
    ul,
    a,
    abbr,
    b,
    bdi,
    bdo,
    br,
    cite,
    code,
    data,
    dfn,
    em,
    i,
    kbd,
    mark,
    q,
    rp,
    rt,
    ruby,
    s,
    samp,
    small,
    span,
    strong,
    sub,
    sup,
    time,
    u,
    htmlVar,
    wbr,
    area,
    audio,
    img,
    map,
    track,
    video,
    embed,
    iframe,
    object,
    picture,
    portal,
    source,
    svg,
    math,
    canvas,
    noscript,
    script,
    del,
    ins,
    caption,
    col,
    colgroup,
    table,
    tbody,
    td,
    tfoot,
    th,
    thead,
    tr,
    button,
    datalist,
    fieldset,
    form,
    input,
    label,
    legend,
    meter,
    optgroup,
    option,
    output,
    progress,
    select,
    textarea,
    details,
    dialog,
    summary,
    slot,
    template,
    
    // Basic HTML
    addDefaultStyleToProperties,

    // DOMElementNode
    elementNode, 
    DOMElementNode,

    // domFlowBuildContext
    getThemedComponent,

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
    
    //DOMTextNode 
    textNode,
    text,
    DOMTextNode,
    findImplicitSingleTextInContent,
    getFlowPropertiesWithImplicitSingleText,

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
