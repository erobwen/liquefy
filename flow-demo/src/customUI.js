import { div } from "../../flow.DOM/BasicHtml";
import { model } from "../../flow/Flow";
import { readFlowProperties } from "../../flow/src";
import { textInputField as basicTextInputField } from "../basic/BasicWidgets";
import { button as basicButton } from "../basic/BasicWidgets";
import { modernButton } from "../modern/ModernButton";


export function button(...parameters) {
  const properties = readFlowProperties(parameters);
  // return theme.button.apply(null, parameters);
  // return basicButton.apply(null, parameters); 
  return modernButton(properties);
}

export function textInputField(...parameters) {
  const properties = readFlowProperties(parameters);
  return basicTextInputField(properties);
  // return modernTextField.apply(null, parameters);
}

// export const theme = model({
//   // Alternatives
//   buttonAlternatives: {
//     modernButton,
//     basicButton
//   },
//   textInputFieldAlternatives: {
//     basicTextInputField
//   },

//   button: modernButton,
//   textInputField: basicTextInputField 
// });