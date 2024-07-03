import { findTextKeyAndOnClickInProperties, Flow } from "../flow/Flow";
import { readFlowProperties, findTextAndKeyInProperties } from "../flow/flowParameters";
import { div } from "../flow.DOM/BasicHtml";
import { adjustLightness } from "./Color";
import { button, inputField, text, textInputField } from "./basic/BasicWidgets";
import { panelStyle } from "./modern/Style";
import { centerMiddle, column, filler, fitContainerStyle, row } from "./basic/Layout";

const log = console.log; 


export function modernTextField(label, getter, setter, ...parameters) {
  let type = "string";
  let error;
  if (typeof(getter) === "object" && typeof(setter) === "string") {
    const targetObject = getter;
    const targetProperty = setter; 
    getter = () => targetObject[targetProperty]
    setter = newValue => { log(newValue); targetObject[targetProperty] = (type === "number") ? parseInt(newValue) : newValue;}
    error = targetObject[targetProperty + "Error"];
  }

  return new ModernTextField({label, getter, setter, ...readFlowProperties(parameters)});
}

export class ModernTextField extends Flow {

  setProperties({label="[label]"}) {
    this.label = label; 
  }

  setState() {
    this.active = this.getter() !== "";
  }

  build() {
    const {label, getter, setter} = this; 

    const labelText = text("label", label);

    return (
      column("textFrame",
        row(
          "labelRow",
          labelText.show(this.active), 
          filler(), 
          {style: {fontSize: "8px"}}
        ),
        row(
          "textFieldRow",
          labelText.show(!this.active),
          textInputField("", getter, setter, {style: {fontSize: this.active ? "14px" : "8px"}}),
          {style: {fontSize: "14px"}}
        )
      )
    );
  }
}
