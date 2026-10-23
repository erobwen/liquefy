import { repeat } from "@liquefy/cascade.component";
import { PaperSequence } from "../../print/index.js";
import { domMeasurer, papersOf } from "../../print/dom.js";
import { sequence as sequenceOf, isSection, paragraphText, titleNumber } from "../../model/flows.js";
import { SequenceLayout, titlePlaceholder } from "../../layout/DocumentLayout.js";
import { documentToJSON, documentFromJSON } from "./json.js";

// A structured text's papers, for printing - laid out anew, onto papers of
// its own, not taken from the screen: the same however it's shown, or
// whether it's shown at all.
//
// A copy of the document is laid out - made through its JSON - and the
// layout is never retracted: nothing changes the copy, so nothing in the
// layout ever runs again, and once the papers are read nothing refers to
// any of it. Retracted, it would place its lines again from nowhere: its
// writes (where the next line goes, see ../../print/PaperSequence.js) are
// undone while its paragraphs still read them - cascade.reactive's
// retractRepeater(), the classic app's teardown bug (see ../../test/app.js).
export function printPapers(document) {
  const copy = documentFromJSON(documentToJSON(document));
  const sequence = new PaperSequence();
  const layout = new SequenceLayout({ sequence: sequenceOf(copy), measurer: domMeasurer() }).establish();
  repeat(() => layout.renderOnto(sequence), { independent: true });
  return papersOf(sequence);
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
