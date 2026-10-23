import { repeat, retractRepeater } from "@liquefy/cascade.component";
import { PaperSequence } from "../../print/index.js";
import { domMeasurer, papersOf } from "../../print/dom.js";
import { sequence as sequenceOf, isSection, paragraphText, titleNumber } from "../../model/flows.js";
import { SequenceLayout, titlePlaceholder } from "../../layout/DocumentLayout.js";

// A structured text's papers, for printing - laid out anew, onto papers of
// its own, not taken from the screen: the same however it's shown, or
// whether it's shown at all. The layout is thrown away once read.
export function printPapers(document) {
  const measurer = domMeasurer();
  const sequence = new PaperSequence();
  const layout = new SequenceLayout({ sequence: sequenceOf(document), measurer }).establish();
  const root = repeat(() => layout.renderOnto(sequence), { independent: true });
  try {
    return papersOf(sequence);
  } finally {
    retractRepeater(root);
    layout.dispose();
    measurer.dispose();
  }
}

// A structured text as a tree, for the tree mode (see ../../shell/TreeView.js):
// its sections as folders - numbered, if its titles are - and its
// paragraphs as what's in them, by their first words.
export function outline(document) {
  const nodes = (section, around) => section.children.map((flow) => {
    if (isSection(flow)) {
      const number = titleNumber(flow, [...around, section]);
      return {
        label: (number ? number + "  " : "") + (paragraphText(flow.title) || titlePlaceholder),
        icon: "folder",
        children: nodes(flow, [...around, section]),
      };
    }
    return { label: firstWords(paragraphText(flow)) || "(empty paragraph)", icon: "notes", children: [] };
  });
  return nodes(document, []);
}

function firstWords(text, length = 60) {
  return text.length <= length ? text : text.slice(0, length).replace(/\s+\S*$/, "") + " …";
}
