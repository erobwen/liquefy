import { toProperties, getRenderContext } from "@liquefy/flow.core";
import { toButtonProperties, toInputProperties, elementNode } from "@liquefy/flow.DOM";


/**
 * Input element properties
 * 
 * type: 'text' | 'number' | 'password' | 'url' | 'email' | 'search' | 'tel' | 'hidden' | 'date' | 'datetime-local' | 'month' | 'time' | 'week'
 * inputmode: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
 */
export function toMduiInputProperties(parameters) {
  const properties = toInputProperties(parameters);
  const {key, labelText, setter, getter, ...restProperties} = properties;
  return {
    onInput: (event) => setter(event.target.value),
    value: getter(),
    label: labelText,
    ...restProperties
  }
}
