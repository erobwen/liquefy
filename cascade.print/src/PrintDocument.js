import { Component } from "@liquefy/cascade.component";
import { Section } from "./Section.js";
import { monospaceMeasurer } from "./monospaceMeasurer.js";

const fallbackMeasurer = monospaceMeasurer();

/**
 * PrintDocument - a document's model, laid out onto a PaperSequence:
 *
 *   new PrintDocument({ document, measurer }).renderOnto(new PaperSequence());
 *
 * `document` - the model, observable all the way down: { styles, sections }
 * - a stylesheet (see styles.js), and sections (see Section.js) of
 * paragraphs. `measurer` - what text is measured with (see
 * monospaceMeasurer.js); a monospace one if none is given.
 *
 * Provides both to everything in it, as `styles` and `textMeasurer`: they
 * are the same for the whole document, all through a pass.
 */
export class PrintDocument extends Component {
  setProperties({ document, measurer }) {
    this.document = document;
    this.measurer = measurer || null;
  }

  provide() {
    const document = this;
    return {
      get styles() { return document.document.styles; },
      get textMeasurer() { return document.measurer || fallbackMeasurer; },
    };
  }

  build() {
    return this.document.sections.map((section) => new Section({ key: "section" + section.causality.id, section }));
  }
}
