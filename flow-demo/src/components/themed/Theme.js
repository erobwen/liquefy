import { div } from "../../flow.DOMTarget/BasicHtml";
import { model } from "../../flow/Flow";
import { textInputField as basicTextInputField } from "../basic/BasicWidgets";
import { button as basicButton } from "../basic/BasicWidgets";
import { modernButton } from "../modern/ModernButton";


export function button(...parameters) {
  // return theme.button.apply(null, parameters);
  // return basicButton.apply(null, parameters); 
  return modernButton.apply(null, parameters);
}


export function textInputField(...parameters) {
  return basicTextInputField.apply(null, parameters);
  // return modernTextField.apply(null, parameters);
}

export const theme = model({
  // Alternatives
  buttonAlternatives: {
    modernButton,
    basicButton
  },
  textInputFieldAlternatives: {
    basicTextInputField
  },

  button: modernButton,
  textInputField: basicTextInputField 
});