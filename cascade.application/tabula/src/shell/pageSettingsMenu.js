import { callback } from "@liquefy/cascade.component";
import { div, text, input } from "@liquefy/cascade.dom";
import { button, row } from "@liquefy/cascade.ui";
import { paperSizes, margins, mm, inch } from "../print/index.js";
import { defaultPageSettings } from "../model/pageLayout.js";
import { menuHeading as heading, menuNote as note } from "./contextMenus.js";

/**
 * Page settings in a context menu - a page layout's (see
 * ../model/pageLayout.js): the file's, the base, what all of it is
 * designed for (see TabulaApp.js), or something's own, overriding what
 * it's in:
 *
 *   pageSettingsControls({ key, setup, inherited, root })
 *
 * `setup`: the page layout changed. `inherited(key)`: what it's in has,
 * where `setup` doesn't - shown as what's in effect, said to be the
 * file's. Not the file's own (`root` false): each setting it has itself
 * can be reset - taken away, the file's again.
 *
 * Something's own: ownPageSettings() - what it's on, as long as it sets
 * none of them, and the way to change that for it alone: "Add page
 * settings".
 */
export function pageSettingsControls({ key = "pageSettings", setup, inherited = () => undefined, root = false }) {
  const value = (name) => {
    const own = setup[name];
    if (typeof(own) !== "undefined") return own;
    const above = inherited(name);
    return typeof(above) !== "undefined" ? above : defaultPageSettings[name];
  };
  const own = (name) => typeof(setup[name]) !== "undefined";
  // Each setting's state: its own, with a way back - or the file's.
  const origin = (name) => root ? null : own(name)
    ? button({ key: "reset" + name, variant: "text", title: "As the file has it again" }, "Reset", callback(key + "reset" + name, () => { setup[name] = undefined; }))
    : div({ key: "inherited" + name, style: inheritedStyle }, text("the file's"));
  const paper = value("paper");
  const landscape = value("landscape");
  const duplex = value("duplex");
  const marginsNow = value("margins");
  const choice = (name, label, chosen, choose) => button({ key: name, variant: chosen ? "filled" : undefined }, label, callback(key + name, choose));
  const isSize = (size) => paper.width === size.width && paper.height === size.height;
  // A paper size, its margins with it - unless they're set apart from it.
  const setPaper = (name) => {
    setup.paper = Object.freeze({ width: paperSizes[name].width, height: paperSizes[name].height });
    if (root || own("margins")) setup.margins = paperMargins[name];
  };
  return [
    labelled("Paper", origin("paper"),
      choice("A4", "A4", isSize(paperSizes.A4), () => setPaper("A4")),
      choice("letter", "Letter", isSize(paperSizes.letter), () => setPaper("letter"))),
    labelled("Orientation", origin("landscape"),
      choice("portrait", "Portrait", !landscape, () => { setup.landscape = false; }),
      choice("landscape", "Landscape", landscape, () => { setup.landscape = true; })),
    labelled("Sides", origin("duplex"),
      choice("single", "Single-sided", !duplex, () => { setup.duplex = false; }),
      choice("double", "Double-sided", duplex, () => { setup.duplex = true; })),
    note(duplex
      ? "Designed to be printed on both sides, like a book: the pages face each other, mirrored - the shade is where they're bound."
      : "Designed to be printed on one side, like a letter."),
    labelled("Margins", origin("margins")),
    div(
      { key: "margins", style: { display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "6px 8px", alignItems: "center", fontSize: "14px" } },
      ["top", "bottom", "left", "right"].map((side) => [
        div({ key: "label" + side }, text(sideName(side, duplex))),
        input({
          key: "margin" + side,
          type: "number", min: 0, step: 1,
          value: String(marginsNow[side] / 1000),
          onchange: callback(key + "margin" + side, (event) => {
            const typed = Number(event.target.value);
            if (Number.isFinite(typed) && typed >= 0) setup.margins = Object.freeze({ ...marginsNow, [side]: Math.round(typed * 1000) });
          }),
          style: { width: "100%", boxSizing: "border-box", font: "inherit", padding: "2px 4px" },
        }),
      ]),
    ),
    note("In millimetres, each from its own edge" + (duplex ? " - inner by the binding, outer away from it." : ".")),
  ];
}

// Something's page layout's settings (`layout`): while it has none, the
// file's, said - and, shown (`shown`, `show(shown)`), its own to set,
// until they're removed again.
export function ownPageSettings({ key = "pageSettings", layout, shown = false, show, inherited }) {
  if (!shown && !layout.hasSettings()) {
    const paper = inherited("paper") || defaultPageSettings.paper;
    const name = Object.keys(paperSizes).find((each) => paperSizes[each].width === Math.min(paper.width, paper.height)) || "its own size";
    return [
      heading("Page settings"),
      note("The file's: " + name + (inherited("landscape") ? ", landscape" : "") + (inherited("duplex") ? ", double-sided" : "") + "."),
      button({ key: "addPageSettings" }, "Add page settings", callback(key + "add", () => show(true))),
    ];
  }
  return [
    heading("Page settings"),
    note("Its own, where it says - the file's, where not."),
    ...pageSettingsControls({ key, setup: layout, inherited }),
    button({ key: "removePageSettings" }, "Remove page settings", callback(key + "remove", () => { layout.clearSettings(); show(false); })),
  ];
}

// Printed on both sides, left and right are inner and outer.
export const sideName = (side, duplex) => ({ left: duplex ? "Inner" : "Left", right: duplex ? "Outer" : "Right", top: "Top", bottom: "Bottom" })[side];

// The margins that go with each paper: 25 mm on A4, an inch on Letter.
const paperMargins = { A4: margins(mm(25)), letter: margins(inch(1)) };

// A setting's heading, whose it is beside it - and its choices under it.
function labelled(label, origin, ...choices) {
  return [
    row({ key: "heading" + label, style: { alignItems: "center", gap: "8px", justifyContent: "space-between" } }, heading(label), origin),
    choices.length ? row({ key: "choices" + label, style: { gap: "6px", flexWrap: "wrap" } }, choices) : null,
  ];
}

const inheritedStyle = { opacity: 0.6, fontSize: "12px", fontStyle: "italic" };

