import { Component } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { fitContainerStyle } from "@liquefy/cascade.ui";
import { creationDot } from "./CreationDot.js";

/**
 * NullDocument - the document there is before there's one: a creation dot
 * (see CreationDot.js) in the middle of where it would be, saying
 * "Create".
 *
 *   nullDocument({ documentTypes, onCreate })
 */
export class NullDocument extends Component {
  setProperties({ documentTypes, onCreate }) {
    this.documentTypes = documentTypes || [];
    this.onCreate = onCreate;
  }

  build() {
    return div(
      { style: { ...fitContainerStyle, position: "relative", overflow: "hidden", background: nullBackdrop } },
      div(
        { style: { position: "absolute", left: "50%", top: "50%" } },
        creationDot({ documentTypes: this.documentTypes, onCreate: this.onCreate, label: "Create" }),
      ),
    );
  }
}

export const nullBackdrop = "#f4f3f0";

export const nullDocument = (...parameters) => new NullDocument(...parameters);
