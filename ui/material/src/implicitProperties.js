import { toProperties, getRenderContext } from "@liquefy/flow.core";
import { toButtonProperties, toInputProperties, addDefaultStyle } from "@liquefy/flow.DOM";


/**
 * Input element properties
 * 
 * type: 'text' | 'number' | 'password' | 'url' | 'email' | 'search' | 'tel' | 'hidden' | 'date' | 'datetime-local' | 'month' | 'time' | 'week'
 * inputmode: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
 */
export function toMduiInputProperties(parameters) {
  const properties = toInputProperties(parameters);
  const {key, type, labelText, setter, getter, getErrors, ...restProperties} = properties;
  const defaultStye = {
    height: 56
  }
  if (type === "number") {
    defaultStye.width = 200
    defaultStye.height = 40
  }
  return {
    key,
    type,
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
