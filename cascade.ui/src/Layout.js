import { toPropertiesWithChildren } from "@liquefy/cascade.component";
import { taggedElement } from "@liquefy/cascade.dom";

/**
 * Layout - ported from flow.ui/basic/src/Layout.js: a small kit of style
 * constants plus the styled-div functions built from them, all following
 * the same unwritten flow convention every component's own doc in this
 * codebase now points back to (see cascade.DOM/src/applyStyle.js): every
 * one of these takes an optional `style` property, merged as
 * `{...ownDefault, ...style}` - the caller's own value always wins - and
 * applied straight onto the one div each of these builds, not onto some
 * further wrapper. That's the actual mechanism behind "extra divs are
 * usually unnecessary": a creator styles its child directly, including
 * fitting it into a flex row/column or making it fill its container,
 * instead of wrapping it in a div dedicated to just that.
 *
 * Two style families here, not one "fillStyle": fitContainerStyle sizes by
 * *absolute* dimensions (width/height: 100% of the parent's own box, no
 * flex participation implied), fillerStyle sizes by *flex* participation
 * (flexGrow/Shrink: 1, flexBasis: 0 - takes an equal share of whatever
 * room a flex row/column has left). Reach for fitContainerStyle when the
 * parent isn't a flex container (or you want 100% regardless of flex
 * distribution) and fillerStyle when it is and you want this child to
 * share/absorb the remaining space with its siblings.
 *
 * One deliberate correction from flow's own copy: flow.ui/basic/src/Layout.js's
 * own flexContainerStyle sets `justifyContent: "flexStart"` - not valid CSS
 * (camelCase is for the *property* name in a JS style object, not a
 * property's *value* - the real value is the kebab-case string
 * "flex-start"). Harmless there in practice (an invalid value is simply
 * ignored, and justify-content's own initial value, "normal", already packs
 * items at the start for ordinary content) but not worth reproducing
 * knowingly - fixed here to the real value.
 *
 * flow's own componentTypeName argument to styledDiv() (purely a debug-id
 * label, baked into flow.core's own aggregateToString()-style element id)
 * isn't ported - cascade.DOM's DOMElementComponent doesn't have an equivalent
 * hook yet (setProperties() has no special case for it, so passing one
 * through today would just land as a meaningless "componenttypename" DOM
 * attribute instead). Every element built here still gets a real, unique
 * debug id from DOMNodeRenderComponent's own aggregateToString() fallback
 * (this.constructor.name-based) - just not one that says "row" vs "column".
 */

// --- Basic layout styles ---

export const flexContainerStyle = {
  overflow: "hidden",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "flex-start",
  whiteSpace: "normal",
  userSelect: "none",
};

export const rowStyle = { ...flexContainerStyle, flexDirection: "row" };
export const columnStyle = { ...flexContainerStyle, flexDirection: "column" };

export const centerStyle = { ...rowStyle, justifyContent: "center", alignItems: "stretch" };
export const middleStyle = { ...columnStyle, justifyContent: "center", alignItems: "stretch" };
export const centerMiddleStyle = { ...rowStyle, justifyContent: "center", alignItems: "center" };

// --- Basic element styles ---

// For a bottom-up component inside a scroll container - sized by its own
// content, not stretched or shrunk to fit.
export const naturalSizeStyle = { overflow: "visible", flexGrow: "0", flexShrink: "0", flexBasis: "auto" };

// Fill 100% of the parent's own box - absolute sizing, no flex participation
// implied (works inside or outside a flex container).
export const fitContainerStyle = { overflow: "hidden", boxSizing: "border-box", width: "100%", height: "100%" };

// Grow/shrink to take an equal share of whatever room is left in a flex
// row/column, ignoring its own content's natural size - scroll panels,
// equal space distribution.
export const fillerStyle = { overflow: "hidden", boxSizing: "border-box", flexGrow: "1", flexShrink: "1", flexBasis: "0" };

// Same, but based on its own content's natural size rather than an equal
// 0-basis share - grows/shrinks around whatever it would naturally be.
export const autoFillerStyle = { overflow: "hidden", boxSizing: "border-box", flexGrow: "1", flexShrink: "1", flexBasis: "auto" };

// Visualizes a component's own bounds during development - not meant to
// ship.
export const layoutBorderStyle = { borderStyle: "solid", borderColor: "light-gray", borderWidth: "1px", boxSizing: "border-box" };

// Opts back out of fitContainerStyle/fillerStyle's own overflow: hidden -
// for content that must be allowed to overflow its own box (an animation,
// a popover, ...).
export const overflowVisibleStyle = { overflow: "visible" };

// --- styledDiv: the shared mechanism behind every function below ---

// Builds a div the same mechanical way cascade.DOM's own div() does
// (toPropertiesWithChildren() then taggedElement()) - just merging
// `defaultStyle` underneath whatever `style` property is given first, so
// the caller's own value always wins (see this file's own class doc).
function styledDiv(defaultStyle, parameters) {
  const properties = toPropertiesWithChildren(parameters);
  properties.style = { ...defaultStyle, ...properties.style };
  return taggedElement("div", properties);
}

// --- Basic layout containers ---

export const wrapper = (...parameters) => styledDiv({}, parameters);
export const row = (...parameters) => styledDiv(rowStyle, parameters);
export const column = (...parameters) => styledDiv(columnStyle, parameters);
export const center = (...parameters) => styledDiv(centerStyle, parameters);
export const middle = (...parameters) => styledDiv(middleStyle, parameters);
export const centerMiddle = (...parameters) => styledDiv(centerMiddleStyle, parameters);

// --- Basic layout fillers ---

export const filler = (...parameters) => styledDiv(fillerStyle, parameters);

// --- zStack: children stacked on top of each other, edge to edge ---

export const zStackElementStyle = { ...fitContainerStyle, position: "absolute", top: 0, left: 0, width: "100%", height: "100%" };

export const zStack = (...parameters) => styledDiv({ position: "relative" }, parameters);
