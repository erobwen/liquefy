import { extractProperty, callback } from "@liquefy/flow.core";

export function findImplicitTextInputFieldParameters(properties) {
  properties.type = "text";
  return findImplicitInputFieldParameters(properties);
}

export function findImplicitNumberInputFieldParameters(properties) {
  properties.type = "number";
  return findImplicitInputFieldParameters(properties);
}

export function findImplicitCheckboxInputFieldParameters(properties) {
  properties.type = "checkbox";
  return findImplicitInputFieldParameters(properties);
}

function findImplicitInputFieldParameters(properties) {
  const componentContent = extractProperty(properties, "componentContent");
  if (!componentContent) return properties;
  if (!componentContent.length === 4) throw new Error("An input field should have label text, getter and setter or object and property."); 

  properties.labelText = componentContent.shift();
  if (!properties.key) properties.key = properties.labelText;
  if (typeof(componentContent[0]) === "function") {
    properties.getter = componentContent.shift();
    if (typeof(componentContent[0]) !== "function") throw new Error("No setter found for input field.");
    properties.setter = componentContent.shift();
  } else {
    const targetObject = componentContent.shift();
    const targetProperty = componentContent.shift();
    properties.key = properties.key + "." + targetObject.causality.id + "." + targetProperty;
    properties.getter = callback(properties.key + ".getter", () => targetObject[targetProperty]);
    properties.setter = callback(properties.key + ".setter", newValue => { targetObject[targetProperty] = (properties.type === "number") ? parseInt(newValue) : newValue;})
  }
}
