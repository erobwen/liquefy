import { observable, deeplyObservable, repeat, Component, getFlowProperties, getRenderContext } from "@liquefy/flow.core"
import { div, text, DOMRenderContext, getInputProperties, getButtonProperties } from "@liquefy/flow.DOM"
import "./materialExperiments.css";
import { MdOutlinedIconButton, MdTextButton } from '@material/web/all.js';

import 'mdui/mdui.css';
import 'mdui';
//import {styles as typescaleStyles} from '@material/web/typography/md-typescale-styles.js';

console.log(MdTextButton)
const data = deeplyObservable({value: "something"})
const data2 = deeplyObservable({value: 142})
console.log(data)
repeat(() => {
  console.log("DATA CHANGED!!!!")
  console.log(data.value)
})



MdOutlinedIconButton
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
        input("Something else", data2, "value", {type: "number", variant: "outlined"}), 
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
 * Stamp
 */
let stamp = 0;


/**
 * Icon component
 */
const icon = (...parameters) => {
  const properties = getFlowProperties(parameters)
  const attributes = {name: properties.name};
  return getRenderContext().primitive({type: "elementNode", tagName: "mdui-icon", key: properties.key ? properties.key + ".text-" + stamp++ : null, attributes})

  // <mdui-icon name="delete"></mdui-icon>
}


/**
 * Button component
 */
const button = (...parameters) => {
  const properties = getButtonProperties(parameters);
  const keyPrefix = properties.key;
  return getRenderContext().primitive({type: "elementNode", tagName: "mdui-button", key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, ...properties})
}



/**
 * Input experiment
 */
const input = (...parameters) => {
    const properties = getInputProperties(parameters);

    const {key, labelText, setter, getter, ...attributes} = properties;
    return getRenderContext().primitive({
      key: key + ".text", 
      type: "elementNode",
      tagName: "mdui-text-field", 
      attributes: {
        inputmode: "numeric",
        vaueAsNumber: 220,
        onInput: (event) => setter(event.target.value),
        value: getter(),
        label: labelText,
        type: "password",
        ...attributes
      }
    });
}


// type	type		'text' | 'number' | 'password' | 'url' | 'email' | 'search' | 'tel' | 'hidden' | 'date' | 'datetime-local' | 'month' | 'time' | 'week'

// inputmode	inputmode		'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'




// class Input extends Component {
  
//   readParameters(parameters) {
//     console.log(parameters);
//     const properties = getFlowProperties(parameters);
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
