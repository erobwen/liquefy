import { createTextNodesFromStringChildren, toProperties, extractProperty, callback  } from "@liquefy/flow.core"


export const toButtonProperties = (parameters) => {
  const properties = toProperties(parameters);
  findImplicitChildrenAndOnClick(properties);
  return properties; 
}

export function findImplicitChildrenAndOnClick(properties) {
  const componentContent = extractProperty(properties, "componentContent");
  if (!componentContent) return properties;
  
  let children = null;
  let onClick = null;
  for (let item of componentContent) {
    if (typeof item === "function") {
      if (onClick) throw new Error("Can only have one onClick function as flow content.");
      onClick = item; 
    } else {
      if (!children) children = [];
      children.push(item);
    }
  }
  if (onClick) {
    if (properties.onClick) {
      throw new Error("implicitly defined onClick already defined explicitly in properties.");
    }
    properties.onClick = onClick;
  }
  // if (!properties.onClick) throw new Error("Expected onClick defined as a property.");
  if (children) {
    if (properties.children) {
      throw new Error("implicitly defined children already defined explicitly in properties.");
    }
    properties.children = children;
  }
  createTextNodesFromStringChildren(properties, properties.key);
  return properties;
}


/**
 * Shorthand parameter list for input fields. 
 * 
 * labelText, getter, setter
 * 
 * OR
 * 
 * labelText, targetObject, targetProperty
 * 
 * Extra feature: labelText will double as a key if you have no other key given. 
 */
export const toInputProperties = (parameters) => {
  const properties = toProperties(parameters);
  findImplicitInputFieldParameters(properties);
  if (!properties.type) properties.type = "text";
  return properties; 
}

export function findImplicitInputFieldParameters(properties) {
  const componentContent = extractProperty(properties, "componentContent");
  if (!componentContent) return properties;
  if (!componentContent.length === 4) throw new Error("An input field should have label text, getter and setter or object and property."); 

  properties.labelText = componentContent.shift();
  if (!properties.key) properties.key = properties.labelText;
  if (typeof(componentContent[0]) === "function") {
    properties.getter = componentContent.shift();
    if (typeof(componentContent[0]) !== "function") throw new Error("No setter found for input field.");
    properties.setter = componentContent.shift();
    properties.getErrors = componentContent.shift();
  } else {
    const targetObject = componentContent.shift();
    const targetProperty = componentContent.shift();
    properties.key = properties.key + "." + targetObject.causality.id + "." + targetProperty;
    properties.getter = callback(properties.key + ".getter", () => targetObject[targetProperty]);
    properties.setter = callback(properties.key + ".setter", newValue => { targetObject[targetProperty] = (properties.type === "number") ? parseInt(newValue) : newValue;})
    properties.getErrors = callback(properties.key + ".getErrors", () => targetObject.errors ? targetObject.errors[targetProperty] : null)
  }
}
