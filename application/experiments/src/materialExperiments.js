import { observable, repeat, Component, getFlowProperties, findImplicitChildrenAndOnClick, getRenderContext } from "@liquefy/flow.core"
import { div, DOMRenderContext } from "@liquefy/flow.DOM"
import { findImplicitInputFieldParameters } from "@liquefy/basic-ui"
import "./materialExperiments.css";
import { MdOutlinedButton, MdOutlinedIconButton, MdTextButton } from '@material/web/all.js';

import 'mdui/mdui.css';
import 'mdui';
//import {styles as typescaleStyles} from '@material/web/typography/md-typescale-styles.js';

console.log(MdTextButton)
const data = observable({value: 42})
console.log(data)
repeat(() => {
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
        input("Something", observable, "value")
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
  const properties = buttonParametersToProperties(parameters);
  const keyPrefix = properties.key;
  return getRenderContext().primitive({type: "elementNode", tagName: "mdui-button", key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, ...properties})
}

const buttonParametersToProperties = (parameters) => {
  const properties = getFlowProperties(parameters);
  findImplicitChildrenAndOnClick(properties);
  return properties; 
}


/**
 * Input experiment
 */
// const input = (...parameters) => {
//   const properties = findImplicitInputFieldParameters(parameters);
//   const keyPrefix = properties.key;
//   return getRenderContext().primitive({type: "elementNode", tagName: "mdui-text-field", key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, ...properties})
// }

const input = (...parameters) => new Input(...parameters)

class Input extends Component {
  
  readParameters(parameters) {
    return findImplicitInputFieldParameters(parameters)
  }

  receive(properties) {
    this.properties = properties
  }

  render() {
    const keyPrefix = this.properties.key;
    return getRenderContext().primitive({
      onChange: (event) => console.log(event),
      type: "elementNode", 
      tagName: "mdui-text-field", 
      key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, 
      ...this.properties
    })
  }
}
