import { repeat, retractRepeater } from "@liquefy/cascade.component";
import { PaperSequence } from "../../print/index.js";
import { domMeasurer, papersOf } from "../../print/dom.js";
import { sequence as sequenceOf, isSection, paragraphText, titleNumber } from "../../model/flows.js";
import { SequenceLayout, titlePlaceholder } from "../../layout/DocumentLayout.js";
import { frameNode } from "../../model/frames.js";
import { pageElements } from "../../model/pageLayout.js";

// A structured text's papers, for printing - laid out anew, onto papers of
// its own, not taken from the screen: the same however it's shown, or
// whether it's shown at all. The layout is thrown away once read. Its
// frames printed as their kinds print them (see ../../model/frames.js) -
// and what its page layout draws on each page, under the text (see
// ../../model/pageLayout.js).
export function printPapers(document) {
  const measurer = domMeasurer();
  const sequence = new PaperSequence();
  const layout = new SequenceLayout({ sequence: sequenceOf(document), measurer }).establish();
  const root = repeat(() => layout.renderOnto(sequence), { independent: true });
  try {
    const papers = papersOf(sequence);
    return papers.map((paper, index) => ({
      ...paper,
      frames: [
        ...pageElements(document.pageLayout, index, papers.length, paper.format).map(({ element, rect }) => ({
          ...rect, under: true, node: elementNode(element, { page: index + 1, pages: papers.length }),
        })),
        ...paper.lines.flatMap((line) => line.frames || []).map((frame) => ({ ...frame, node: frameNode(frame.source) })),
      ],
    }));
  } finally {
    retractRepeater(root);
    layout.dispose();
    measurer.dispose();
  }
}

// A page element's content, as its kind prints it - an empty box if it
// doesn't.
function elementNode(element, page) {
  const kind = element.content && element.content.documentType ? element.content.documentType.frame : null;
  if (kind && kind.printNode) return kind.printNode(element.content.model, page);
  return globalThis.document.createElement("div");
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
