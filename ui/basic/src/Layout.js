import { deepFreeze } from "@liquefy/flow.core";
import { getFlowPropertiesIncludingChildren } from "@liquefy/flow.core";
import { elementNode } from "@liquefy/flow.DOM";

const log = console.log;


export function styledDiv(componentTypeName, style, parameters) { 
  const properties = getFlowPropertiesIncludingChildren(parameters);
  properties.style = {...style, ...properties.style}; // Inject given style (while making it possible to override)
  return elementNode({type: "elementNode", componentTypeName, tagName: "div", ...properties}); 
}


/**
 * Useful for debugging and seeing where your components are. 
 */
export const layoutBorderStyle = {
  borderStyle: "solid",
  borderColor: "light-gray",
  borderWidth: "1px",
  boxSizing: "border-box"
}


/**
 * Basic layout styles
 * TODO: Deep freeze all styles. 
 */
export const flexContainerStyle = deepFreeze({
  overflow: "hidden",
  boxSizing: "border-box",
  display:"flex",
  alignItems: "stretch", 
  justifyContent: "flexStart",
  whiteSpace: "pre"
});

export const rowStyle = deepFreeze({
  ...flexContainerStyle,
  flexDirection: "row"
});

export const columnStyle = {
  ...flexContainerStyle,
  flexDirection: "column" 
};

export const centerStyle = {
  ...rowStyle,
  justifyContent:"center",
  alignItems: "stretch"
} 

export const middleStyle = {
  ...columnStyle,
  justifyContent:"center",
  alignItems: "stretch"
}

export const centerMiddleStyle = {
  ...rowStyle,
  justifyContent:"center",
  alignItems: "center"
} 


/**
 * Basic element styles
 */
export const naturalSizeStyle = { // For bottom up components inside scroll compoennts
  overflow: "visible",
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: 'auto'
}

export const fitContainerStyle = {
  overflow: "hidden", // Enforce top down layout. If set to auto or display, layout might be influenced by grand children that are too large to fit within their given space. 
  boxSizing: "border-box",  // Each component needs to be responsible of their own padding/border space...
  width: "100%",
  height: "100%"
} 

// For components that needs to grow and shrink without regard to its contents. Scroll panels typically, or for equal distribution of space.
export const fillerStyle = {
  overflow: "hidden", 
  boxSizing: "border-box",
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
}

// For components that needs to grow and shrink without regard to its contents. Scroll panels typically, or for equal distribution of space.
export const autoFillerStyle = {
  overflow: "hidden", 
  boxSizing: "border-box",
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 'auto',
}


// For a component that stubbornly needs to keep its size in the flex direction. For buttons etc.  
// export const flexAutoStyle = {
//   overflow: "hidden",
//   boxSizing: "border-box",
//   flexGrow: 0,
//   flexShrink: 0,
//   flexBasis: 'auto'
// };

// export const naturalSizeLimitStyle = {
//   overflow: "hidden",
//   boxSizing: "border-box",
//   flexGrow: 0,
//   flexShrink: 1,
//   flexBasis: 'auto'
// };

// Convenience for an auto width style with fixed width. 
// export function flexAutoWidthStyle(width) {
//   return {
//     overflow: "hidden",
//     boxSizing: "border-box",
//     width: width, 
//     flexGrow: 0,
//     flexShrink: 0,
//     flexBasis: 'auto'    
//   };
// };

// Convenience for an auto width style with fixed height. 
// export function flexAutoHeightStyle(height) {
//   return {
//     overflow: "hidden",
//     boxSizing: "border-box",
//     height: height, 
//     flexGrow: 0,
//     flexShrink: 0,
//     flexBasis: 'auto'
//   };
// };

// For components that needs to grow and shrink with the size of its contents as base. This was needed for some IE11 support. 
// export const flexGrowShrinkAutoStyle = {
//   overflow: "hidden",
//   boxSizing: "border-box",
//   flexGrow: 1,
//   flexShrink: 1,
//   flexBasis: 'auto',
// }

// export const flexGrowAutoStyle = {
//   overflow: "hidden",
//   boxSizing: "border-box",
//   flexGrow: 1,
//   flexShrink: 0,
//   flexBasis: 'auto',  
// } 


/**
 * Basic basic layout containers
 */
export const wrapper = (...parameters) => styledDiv("wrapper", {}, parameters);
export const row = (...parameters) => styledDiv("row", rowStyle, parameters);
export const column = (...parameters) => styledDiv("column", columnStyle, parameters);
export const center = (...parameters) => styledDiv("center", centerStyle, parameters);
export const middle = (...parameters) => styledDiv("middle", middleStyle, parameters);
export const centerMiddle = (...parameters) => styledDiv("centerMiddle", centerMiddleStyle, parameters);

/**
 * Basic basic layout fillers
 */
export const filler = (...parameters) => styledDiv("filler", fillerStyle, parameters);


/**
 * ZStack
 */

export const zStackElementStyle = {
  ...fitContainerStyle,
  position:"absolute", 
  top:0, 
  left:0,
  width: "100%",
  height: "100%",
}

export const zStack = (...parameters) => styledDiv("zStack", {...parameters.style, position: "relative"}, parameters);


/**
 * Animations
 */
export const overflowVisibleStyle = {
  overflow: "visible"
}