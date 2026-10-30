import { repeat, retractRepeater, withoutRecording } from "@liquefy/cascade.component";
import { PaperSequence } from "../../print/index.js";
import { domMeasurer, papersOf } from "../../print/dom.js";
import { sequence as sequenceOf, isSection, paragraphText, titleNumber } from "../../model/flows.js";
import { SequenceLayout, titlePlaceholder } from "../../layout/DocumentLayout.js";
import { frameNode } from "../../model/frames.js";
import { pageElements } from "../../model/pageLayout.js";

// A structured text's papers, for printing - laid out anew, onto papers of
// its own, not taken from the screen: the same however it's shown, or
// whether it's shown at all. The layout is thrown away once printed. Among
// pages of their own in another document (`paperSequence` - see
// ../../layout/DocumentLayout.js's InsertLayout), the papers it's laid
// out on there instead, as that one is laid out.
export async function printPapers(document, { paperSequence = null } = {}) {
  if (paperSequence) return printSequence(paperSequence);
  const measurer = domMeasurer();
  const sequence = new PaperSequence();
  const layout = new SequenceLayout({ sequence: sequenceOf(document), measurer }).establish();
  const root = repeat(() => layout.renderOnto(sequence), { independent: true });
  try {
    return await printSequence(sequence);
  } finally {
    retractRepeater(root);
    layout.dispose();
    measurer.dispose();
  }
}

// Papers laid out, printed: their frames as their kinds print them (see
// ../../model/frames.js) - and what their page layout draws on each, under
// the text (see ../../model/pageLayout.js) - and, between them, pages of
// their own (see ../../model/sequences.js): each document in them as its
// kind prints it - laid out with them, a picture, a paper it fills -
// waited for.
async function printSequence(sequence) {
  const papers = laidOutPapers(sequence);
  const inserts = withoutRecording(() => [...sequence.inserts]);
  const result = [];
  for (let index = 0; index < papers.length; index++) {
    for (const insert of inserts.filter((each) => each.page === index && each.before)) result.push(...await printItems(insert));
    result.push(papers[index]);
    for (const insert of inserts.filter((each) => each.page === index && !each.before)) result.push(...await printItems(insert));
  }
  return result;
}

// What's in pages of their own, printed - and their blank back, if they
// have one (see ../../layout/DocumentLayout.js's InsertLayout).
async function printItems({ items, format, pad }) {
  const pages = [];
  for (const { item, pages: paperSequence } of items) {
    const type = item && item.documentType;
    if (!type) continue;
    if (type.print) pages.push(...await type.print(item.model, { paperSequence }));
    else if (type.frame && type.frame.printNode) {
      const paper = withoutRecording(() => paperSequence.pages[0]) || format;
      pages.push({ format: paper, lines: [], frames: [{ x: 0, top: 0, width: paper.width, height: paper.height, node: type.frame.printNode(item.model) }] });
    }
  }
  if (pad) pages.push({ format, lines: [], frames: [] });
  return pages;
}

// Papers, as laid out - with their frames, and their page layout's.
// Numbered as the paper sequence numbers them.
function laidOutPapers(sequence) {
  const papers = papersOf(sequence);
  const last = withoutRecording(() => sequence.lastNumber());
  return papers.map((paper, index) => ({
    ...paper,
    frames: [
      ...pageElements(paper.format.pageLayout, index, papers.length, paper.format).map(({ element, rect }) => ({
        ...rect, under: true, node: elementNode(element, { page: withoutRecording(() => sequence.numberOf(index)), pages: last }),
      })),
      ...paper.lines.flatMap((line) => line.frames || []).map((frame) => ({ ...frame, node: frameNode(frame.source) })),
    ],
  }));
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
