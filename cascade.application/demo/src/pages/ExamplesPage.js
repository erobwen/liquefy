import { Component, callback } from "@liquefy/cascade.component";
import { a, div, h3, p, text } from "@liquefy/cascade.dom";
import { icon, themeColor } from "@liquefy/cascade.ui";
import { pageActions, informationBox } from "../components/pageActions.js";
import { pageColumn, pageRoom, sectionTitle } from "../components/layout.js";
import source from "./ExamplesPage.js?raw";

// What this page is about - first on the page (see
// ../components/pageActions.js's informationBox()).
const information = {
  summary: "Every example in the demo, a card each - the menu only lists the showcase.",
  points: [
    "Each card is a real link to its example's own address: open it in a new tab, or copy it. A plain click goes there without loading the app anew.",
    "The examples not in the menu are still pages of their own - found from here, by visitors and by the prerenderer alike.",
  ],
};

// How wide a card is at least: as many columns as fit.
const CARD_WIDTH = 260;

/**
 * Examples - every example page, as cards: an icon, its title and what it
 * shows, grouped in `sections` (each { title, description }, in order -
 * an example says which it's in by its `section`). `examples` are the
 * app's page entries (see index.js): the same keys, titles, icons and
 * descriptions the menu and the document head use.
 */
export class ExamplesPage extends Component {
  setProperties({ examples, sections }) {
    this.examples = examples;
    this.sections = sections;
  }

  build() {
    const room = pageRoom(this) || 1000;
    const columns = Math.max(1, Math.floor((room + 16) / (CARD_WIDTH + 16)));
    return pageColumn(
      pageActions({ source, fileName: "src/pages/ExamplesPage.js" }),
      informationBox(information),
      ...this.sections.map((section) => {
        const examples = this.examples.filter((example) => example.section === section.title);
        return div(
          { key: section.title, style: { display: "flex", flexDirection: "column", gap: "8px" } },
          sectionTitle(section.title),
          p({ style: { margin: "0 0 4px 0", opacity: 0.75 } }, text(section.description)),
          div(
            { style: { display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "16px" } },
            examples.map((example) => new ExampleCard({ key: example.key, example })),
          ),
        );
      }),
    );
  }
}

// What a page's description says, for a card: without the "A Cascade
// example: " the document head needs, standing alone.
function shownDescription(description) {
  const shown = description.replace(/^A Cascade example: /, "");
  return shown.charAt(0).toUpperCase() + shown.slice(1);
}

// An example's card: a real link to its page - and a plain click goes
// there without loading the app anew, as the menu does.
class ExampleCard extends Component {
  setProperties({ example }) {
    this.example = example;
  }

  build() {
    const { example } = this;
    const location = this.inherit("location");
    return a(
      {
        href: location.href([example.key]),
        onclick: callback("go", (event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          location.navigate([example.key]);
        }),
        style: {
          display: "flex", gap: "14px", alignItems: "flex-start", padding: "16px", borderRadius: "12px", boxSizing: "border-box",
          color: "inherit", textDecoration: "none", background: themeColor.surface, border: "1px solid " + themeColor.border,
          boxShadow: "0 8px 20px -14px rgba(0, 0, 0, 0.4)",
        },
      },
      div(
        { style: { flex: "none", width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", background: `linear-gradient(135deg, ${themeColor.accent}, ${themeColor.accentDark})` } },
        icon({ name: example.icon, style: { fontSize: "24px" } }),
      ),
      div(
        { style: { minWidth: 0 } },
        h3({ style: { margin: "2px 0 4px 0", fontSize: "16px" } }, text(example.title)),
        p({ style: { margin: 0, fontSize: "14px", lineHeight: 1.45, opacity: 0.8 } }, text(shownDescription(example.description))),
      ),
    );
  }
}
