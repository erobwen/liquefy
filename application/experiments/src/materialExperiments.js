import { Component } from "@liquefy/flow.core"
import { div, DOMTarget } from "@liquefy/flow.DOM"

/**
 * Minimalistic component used for experiments. 
 */
class MaterialExperiment extends Component {
  setState() { }

  build() {
    return div("Some text")
  }
}

/**
 * This is what you would typically do in index.js to start this app. 
 */
export function materialExperiment() {
  const experiment = new MaterialExperiment()  
  new DOMTarget(document.getElementById("root")).setContent(experiment)
}
  