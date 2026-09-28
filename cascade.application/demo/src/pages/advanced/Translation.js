import { Component, serviceProvider } from "@liquefy/cascade.component";
import { DOMServiceLocator, p, text } from "@liquefy/cascade.dom";
import { button, card, row } from "@liquefy/cascade.ui";

// A component of an existing app - it knows nothing about languages.
class SaveChanges extends Component {
  build() {
    return card(
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      p({ style: { margin: 0 } }, text("Save your changes?")),
      row({ style: { gap: "8px" } }, button(text("Save")), button(text("Discard"))),
    );
  }
}

// A service provider of your own: every text the app asks for, in Swedish -
// and everything else, whatever the app already had.
const swedish = { "Save your changes?": "Spara dina ändringar?", "Save": "Spara", "Discard": "Släng" };
const dom = new DOMServiceLocator();
const inSwedish = {
  locate(query) {
    if (query.type !== "textNode") return undefined;
    const { text: original, ...rest } = query.properties;
    return dom.locate({ ...query, properties: { ...rest, text: swedish[original] ?? original } });
  },
};

// The same component, twice: as it is - and in Swedish.
export class TranslationDemo extends Component {
  build() {
    return row(
      { style: { gap: "16px", flexWrap: "wrap", overflow: "visible" } },
      new SaveChanges(),
      serviceProvider({ serviceLocator: inSwedish, child: new SaveChanges() }),
    );
  }
}
