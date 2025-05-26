import { observable, deeplyObservable, repeat, Component, toProperties, getRenderContext } from "@liquefy/flow.core"
import { div, text, DOMRenderContext, toInputProperties, toButtonProperties } from "@liquefy/flow.DOM"
import "./materialExperiments.css";
import { MdOutlinedIconButton, MdTextButton } from '@material/web/all.js';

import 'mdui/mdui.css';
import 'mdui';
//import {styles as typescaleStyles} from '@material/web/typography/md-typescale-styles.js';

const data = deeplyObservable({value: "something"})
const data2 = deeplyObservable({value: 142})
repeat(() => {
  console.log("Data Changed!")
  console.log(data.value)
  console.log(data2.value)
})



// MdOutlinedIconButton
/**
 * Minimalistic component used for experiments. 
 */
class MaterialExperiment extends Component {
  initialize() { }

  render() {
    return (
      div(
        button("Button Text", () => {console.log("clicked me!")}),
        icon({name: "delete"}),
        input("Something", data, "value", {style: {marginBottom: "10px"}}),
        input("Something else", data2, "value", {type: "number", variant: "outlined", inputmode: "numeric"}), 
        text(data.value)
      )
    )
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function materialExperiment() {
  const experiment = new MaterialExperiment()  
  new DOMRenderContext(document.getElementById("root")).render(experiment)
}


/**
 * Icon component
 */
const icon = (...parameters) => {
  const properties = toProperties(parameters)
  const {key, ...attributes} = properties;
  return getRenderContext().primitive({
    key: key, 
    type: "elementNode", 
    tagName: "mdui-icon", 
    attributes
  })
}


/**
 * Button component
 */
const button = (...parameters) => {
  const properties = toButtonProperties(parameters);
  const {key, ...attributes} = properties;
  return getRenderContext().primitive({
    key, 
    type: "elementNode", 
    tagName: "mdui-button", 
    ...attributes
  })
}



/**
 * Input element
 * 
 * type: 'text' | 'number' | 'password' | 'url' | 'email' | 'search' | 'tel' | 'hidden' | 'date' | 'datetime-local' | 'month' | 'time' | 'week'
 * inputmode: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
 */
const input = (...parameters) => {
  const properties = toInputProperties(parameters);
  const {key, labelText, setter, getter, ...attributes} = properties;
  return getRenderContext().primitive({
    key, 
    type: "elementNode",
    tagName: "mdui-text-field", 
    attributes: {
      onInput: (event) => setter(event.target.value),
      value: getter(),
      label: labelText,
      ...attributes
    }
  });
}







// class Input extends Component {
  
//   readParameters(parameters) {
//     console.log(parameters);
//     const properties = toProperties(parameters);
//     console.log({...properties});
//     findImplicitTextInputFieldParameters(properties);
//     console.log({...properties});
//     return properties; 
//   }

//   receive({labelText, setter, getter, ...attributes}) {
//     this.labelText = labelText; 
//     this.setter = setter; 
//     this.getter = getter;
//     this.attributes = attributes;
//   }

//   render() {
//     console.log(attributes);
//     return getRenderContext().primitive({
//       key: this.key + ".text", 
//       type: "elementNode",
//       tagName: "mdui-text-field", 
//       attributes: {
//         onInput: (event) => this.setter(event.target.value),
//         value: this.getter(),
//         label: this.labelText,
//         type: "number",
//         ...this.attributes
//       }
//     })
//   }
// }
