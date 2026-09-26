// Shared by every component that owns a real element and accepts a `style`
// property directly (DOMElementComponent, and anything else that patches an
// element's style in place across reruns rather than routing through
// DOMElementComponent's own tag functions - DOMElementBoundsProvider,
// DOMContextContainer). Ported from flow.DOM's own DOMElementNode.js
// (updateStyle()/defaultToPx()) - ~every component in flow accepted `style`
// as an unwritten convention, and this diffing is what made a *changed*
// style object correct there too, not just a fresh one: a property present
// last time but absent from `newStyle` this time must be cleared, not left
// stuck at its old value - a plain Object.assign(element.style, newStyle)
// only ever adds/overwrites keys, never removes them.

// No unit is ever implied for a bare number in CSS, so every numeric style
// value is suffixed "px" - matches flow's own convention (a style object can
// mix plain numbers and unit strings interchangeably, e.g. {height: 300}
// or {height: "100%"}).
export function defaultToPx(value) {
  if (typeof(value) === "undefined" || value === null) return "";
  return typeof(value) === "number" ? value + "px" : value;
}

// Applies `newStyle` onto `element.style`, diffed against `previouslySetStyle`
// (whatever this same function returned last time, or {} the first time) -
// clears a property that's no longer present, only touches the DOM for a
// property whose value actually changed. Returns the next `previouslySetStyle`
// for the caller to store (typically on `this.unobservable`) and pass back in
// next time.
// CSS custom properties ("--mdui-color-outline") can only be set through
// setProperty(): assigned like the others, they are silently ignored.
function setStyleProperty(elementStyle, property, value) {
  if (property.startsWith("--")) {
    if (value === "") elementStyle.removeProperty(property);
    else elementStyle.setProperty(property, value);
  } else {
    elementStyle[property] = value;
  }
}

export function applyStyle(element, newStyle, previouslySetStyle) {
  const elementStyle = element.style;
  const currentlySet = previouslySetStyle || {};

  for (const property in currentlySet) {
    if (typeof(newStyle[property]) === "undefined") {
      setStyleProperty(elementStyle, property, "");
    }
  }

  const nextPreviouslySet = {};
  for (const property in newStyle) {
    const value = newStyle[property];
    if (currentlySet[property] !== value) {
      setStyleProperty(elementStyle, property, defaultToPx(value));
    }
    nextPreviouslySet[property] = value;
  }
  return nextPreviouslySet;
}
