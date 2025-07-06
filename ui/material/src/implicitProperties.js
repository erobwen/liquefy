import { toProperties, getRenderContext, extractProperty } from "@liquefy/flow.core";
import { toButtonProperties, toInputProperties, addDefaultStyle, label, text } from "@liquefy/flow.DOM";


/**
 * Input element properties
 * 
 * type: 'text' | 'number' | 'password' | 'url' | 'email' | 'search' | 'tel' | 'hidden' | 'date' | 'datetime-local' | 'month' | 'time' | 'week'
 * inputmode: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
 */
export function toMduiInputProperties(parameters) {
  const properties = toInputProperties(parameters);
  const {key, type, variant="filled", labelText, setter, getter, getErrors, ...restProperties} = properties;
  const defaultStye = {
    height: 56
  }
  if (type === "number") { //  && variant === "outlined"
    defaultStye.width = 120
    // defaultStye.height = 40
  }
  return {
    key,
    type,
    variant,
    onInput: (event) => setter(event.target.value),
    value: getter(),
    label: labelText,
    errors: getErrors ?  getErrors() : null,
    ...addDefaultStyle(
      restProperties,
      defaultStye
    )
  }
}


export function toMduiCheckboxProperties(parameters) {
  const properties = toInputProperties(parameters);
  const {key, type, variant="filled", labelText, children, setter, getter, getErrors, ...restProperties} = properties;
  // const defaultStye = {
  //   height: 56
  // }
  const labelChild = label(text(labelText));  //, {style: {paddingRight: "4px", margin: "", lineHeight: 20}}
  return {
    key,
    type,
    onChange: (event) => setter(event.target.checked),
    checked: getter(),
    variant,
    value: getter(),
    children: [labelChild],
    errors: getErrors ?  getErrors() : null,
    // ...addDefaultStyle(
      ...restProperties,
      // defaultStye
    // )
  }
}


// export function findImplicitChildrenAndOnChange(properties) {
//   const componentContent = extractProperty(properties, "componentContent");
//   if (!componentContent) return properties;
  
//   let children = null;
//   let onChange = null;
//   for (let item of componentContent) {
//     if (typeof item === "function") {
//       if (onChange) throw new Error("Can only have one onChange function as flow content.");
//       onChange = item; 
//     } else {
//       if (!children) children = [];
//       children.push(item);
//     }
//   }
//   if (onChange) {
//     if (properties.onChange) {
//       throw new Error("implicitly defined onChange already defined explicitly in properties.");
//     }
//     properties.onChange = onChange;
//   }
//   // if (!properties.onChange) throw new Error("Expected onChange defined as a property.");
//   if (children) {
//     if (properties.children) {
//       throw new Error("implicitly defined children already defined explicitly in properties.");
//     }
//     properties.children = children;
//   }
//   createTextNodesFromStringChildren(properties, properties.key);
//   return properties;
// }