import { Component, getFlowProperties, findImplicitChildrenAndOnClick, getRenderContext } from "@liquefy/flow.core"
import { div, DOMRenderContext } from "@liquefy/flow.DOM"
import "./materialExperiments.css";
import { MdOutlinedButton, MdOutlinedIconButton, MdTextButton } from '@material/web/all.js';

import 'mdui/mdui.css';
import 'mdui';
//import {styles as typescaleStyles} from '@material/web/typography/md-typescale-styles.js';

console.log(MdTextButton)

MdOutlinedIconButton
/**
 * Minimalistic component used for experiments. 
 */
class MaterialExperiment extends Component {
  setState() { }

  build() {
    return (
      div(
        button("Button Text", () => {console.log("clicked me!")}),
        icon({name: "delete"})
      )
    )
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function materialExperiment() {
  const experiment = new MaterialExperiment()  
  new DOMRenderContext(document.getElementById("root")).setContent(experiment)
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
  return getRenderContext().create({type: "elementNode", tagName: "mdui-icon", key: properties.key ? properties.key + ".text-" + stamp++ : null, attributes})

  // <mdui-icon name="delete"></mdui-icon>
}


/**
 * Button component
 */
const button = (...parameters) => {
  const properties = buttonParametersToProperties(parameters);
  const keyPrefix = properties.key;
  return getRenderContext().create({type: "elementNode", tagName: "mdui-button", key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, ...properties})
}

const buttonParametersToProperties = (parameters) => {
  const properties = getFlowProperties(parameters);
  findImplicitChildrenAndOnClick(properties);
  return properties; 
}

{/* <mdui-icon name="delete"></mdui-icon> */}