
/**
 * Element Node Attributes 
 */
export function extractAttributes(properties) {
  let attributes = null;
  if (!properties) return attributes;
  eventHandlerContentElementAttributes.forEach(
    attribute => {
      if (typeof(properties[attribute.camelCase]) !== "undefined") {
        if (!attributes) attributes = {};
        attributes[attribute.lowerCase] = properties[attribute.camelCase];
        delete properties[attribute.camelCase];
      }
    }
  );
  globalElementAttributes.forEach(
    attribute => {
      if (typeof(properties[attribute.camelCase]) !== "undefined") {
        if (!attributes) attributes = {};
        attributes[attribute.lowerCase] = properties[attribute.camelCase];
        delete properties[attribute.camelCase]; // Destructive change of properties... could this cause problems?
      }
    }
  );

  // if (properties.className) attributes["class"] = properties.className;  
  if (attributes) {
    if (properties.attributes) {
      throw new Error("An attributes property is already existing in properties, combined with loose attributes.")
    }
    properties.attributes = attributes;
  }
  return attributes;
}


// Source https://html.spec.whatwg.org/#global-attributes
export const eventHandlerContentElementAttributesCamelCase = [
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
]
const eventHandlerContentElementAttributes = eventHandlerContentElementAttributesCamelCase.map(camelCase => ({camelCase, lowerCase: camelCase.toLowerCase()}));

// Source https://html.spec.whatwg.org/#global-attributes
export const globalElementAttributesCamelCase = [
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
  "translate",
];

const globalElementAttributes = globalElementAttributesCamelCase.map(camelCase => ({camelCase, lowerCase: camelCase.toLowerCase()}));

/**
 * Child styles
 */

export function extractChildStyles(style) {
  // style = {...style}
  const childStyle = {}
  childStylePropertiesCamelCase.forEach(property => {
    if (typeof(style[property]) !== "undefined") {
      childStyle[property] = style[property];
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
]

const childStyleProperties = childStylePropertiesCamelCase.map(camelCase => ({camelCase, lowerCase: camelCase.toLowerCase()}));
