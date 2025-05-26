import { getFlowProperties, getRenderContext } from "@liquefy/flow.core";
import { getButtonProperties, getInputProperties, elementNode } from "@liquefy/flow.DOM";


/**
 * Input element properties
 * 
 * type: 'text' | 'number' | 'password' | 'url' | 'email' | 'search' | 'tel' | 'hidden' | 'date' | 'datetime-local' | 'month' | 'time' | 'week'
 * inputmode: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
 */
export function getMduiInputProperties(parameters) {
  const properties = getInputProperties(parameters);
  const {key, labelText, setter, getter, ...restProperties} = properties;
  return {
    onInput: (event) => setter(event.target.value),
    value: getter(),
    label: labelText,
    ...restProperties
  }
}
