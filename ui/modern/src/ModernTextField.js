import { Component } from "@liquefy/flow.core";
import { toProperties } from "@liquefy/flow.core";
import { div, text } from "@liquefy/flow.DOM";
import { panelStyle } from "./Style";
import { button, textInputField } from "@liquefy/basic-ui";
import { centerMiddle, column, filler, fitContainerStyle, row } from "@liquefy/basic-ui";

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

  return new ModernTextField({label, getter, setter, ...toProperties(parameters)});
}

export class ModernTextField extends Component {

  receive(properties) {
    Object.assign(this, properties);
    const {label="[label]"} = properties;
    this.label = label; 
  }

  initialize() {
    this.active = this.getter() !== "";
  }

  render() {
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
