import assert from "assert";
import { PaperSequence } from "@liquefy/cascade.print";
import {
  document, section, paragraph, sequence as sequenceOf, gap, partStart, partEnd, isGap, isPartEdge, isSection,
  samePosition, textPosition, paragraphText,
} from "../../model/parts.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { caretRows, edgeDistance } from "../markers.js";
import { caretAt, hitTest, stepRight, stepLeft, sequenceStart, sequenceEnd } from "../positions.js";

// Every character 1000 µm wide, lines 5000 µm tall; parts 6000 µm apart, so
// there's room between them to see where markers go.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};
const paper = { width: 32000, height: 200000 };
const margins = { top: 10000, right: 1000, bottom: 1000, left: 1000 };
const font = { family: "Body", size: 11, weight: 400, italic: false };
const spaced = {
  body: { font, spaceAfter: 6000 },
  titles: [0, 1, 2, 3].map(() => ({ font, spaceAfter: 6000 })),
};
const textArea = { x: margins.left, width: paper.width - margins.left - margins.right };

function layOut(root) {
  const sequence = new PaperSequence();
  new SequenceLayout({ sequence: root, measurer, typography: spaced }).renderOnto(sequence);
  return { sequence, rows: caretRows(sequence, root) };
}

const markerRow = (rows, position) => rows.find(({ row }) => "marker" in row && samePosition(row.marker, position)).row;
const markerY = (rows, position) => markerRow(rows, position).y;
const areaOf = (rows, position) => markerRow(rows, position).area;
const linesOf = (rows, paragraph) => rows.filter(({ row }) => !("marker" in row) && row.paragraph === paragraph).map(({ row }) => row);
const top = (rows, paragraph) => linesOf(rows, paragraph)[0].top;
const bottom = (rows, paragraph) => {
  const lines = linesOf(rows, paragraph);
  const last = lines[lines.length - 1];
  return last.top + last.height;
};

// A position, readable: text "words@offset"; a gap "list:index" (a list
// named by its title, "root" for the sequence); a part's start "<part" and
// end "part>" (a part named by its text, a section by its title).
function nameOf(at, root) {
  const partName = (part) => paragraphText(isSection(part) ? part.title : part);
  if (isGap(at)) return (at.list === root ? "root" : partName(at.list)) + ":" + at.index;
  if (isPartEdge(at)) return at.edge === "start" ? "<" + partName(at.part) : partName(at.part) + ">";
  return paragraphText(at.paragraph) + "@" + at.offset;
}

function walk(rows) {
  const places = [];
  let at = sequenceStart(rows);
  for (let i = 0; i < 500; i++) {
    places.push(at);
    const next = stepRight(rows, at);
    if (samePosition(next, at)) break;
    at = next;
  }
  return places;
}

describe("Ripple's markers", function () {
  it("give every part a start and an end of its own, and a gap between any two parts side by side - none before the first, none after the last", function () {
    const inner = section("In", paragraph("x"));
    const doc = document({ title: "D", paper, margins }, paragraph("p"), inner);
    const root = sequenceOf(doc);
    const { rows } = layOut(root);
    const markers = walk(rows).filter((at) => !("paragraph" in at)).map((at) => nameOf(at, root));
    assert.deepEqual(markers, [
      "<D", "<D", "D>",       // the document starts; its title starts, and ends
      "D:0",                  // between the title and "p"
      "<p", "p>",
      "D:1",                  // between "p" and the section
      "<In", "<In", "In>",    // the section starts; its title starts, and ends
      "In:0",                 // between the title and "x"
      "<x", "x>",
      "In>",                  // the section ends - no gap after "x"
      "D>",                   // the document ends - no gap after the section
    ]);
    // A document and its title, "D" both, are two parts: two starts.
    assert.ok(!samePosition(partStart(doc), partStart(doc.title)));
  });

  it("are stepped through with Left and Right, every place once - and back", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("ab"), section("S", paragraph("cd")));
    const root = sequenceOf(doc);
    const { rows } = layOut(root);
    const forward = walk(rows);
    const backward = [];
    let at = sequenceEnd(rows);
    for (let i = 0; i < 500; i++) {
      backward.push(at);
      const previous = stepLeft(rows, at);
      if (samePosition(previous, at)) break;
      at = previous;
    }
    assert.deepEqual(backward.map((place) => nameOf(place, root)), forward.map((place) => nameOf(place, root)).reverse());
  });

  it("put the gap between two siblings dead centre between them - the one's end above it, the other's start below", function () {
    const a = paragraph("aa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const { rows } = layOut(sequenceOf(doc));
    const from = bottom(rows, a);
    const to = top(rows, b);
    const centre = (from + to) / 2;
    assert.equal(markerY(rows, gap(doc, 1)), centre);
    assert.equal(markerY(rows, partEnd(a)), Math.round(from + (centre - from) / 2));
    assert.equal(markerY(rows, partStart(b)), Math.round(centre + (to - centre) / 2));
  });

  it("spread what ends together evenly down to the sibling gap after it, and what starts below it down to the part", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const outer = section("Outer", paragraph("pp"), inner);
    const next = section("Next");
    const doc = document({ title: "D", paper, margins }, outer, next);
    const { rows } = layOut(sequenceOf(doc));
    // After "qq": its end, Inner's end, Outer's end - then the gap between
    // Outer and Next, dead centre; then Next starts, and Next's title.
    const from = bottom(rows, q);
    const to = top(rows, next.title);
    const centre = (from + to) / 2;
    const closing = [partEnd(q), partEnd(inner), partEnd(outer), gap(doc, 1)];
    closing.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(from + (centre - from) * (index + 1) / closing.length));
    });
    const opening = [partStart(next), partStart(next.title)];
    opening.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(centre + (to - centre) * (index + 1) / (opening.length + 1)));
    });
  });

  it("put the end of everything a fixed distance below the last part, what ends there spread above it", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const doc = document({ title: "D", paper, margins }, inner);
    const root = sequenceOf(doc);
    const { rows } = layOut(root);
    const from = bottom(rows, q);
    const closing = [partEnd(q), partEnd(inner), partEnd(doc)];
    closing.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(from + edgeDistance * (index + 1) / closing.length));
    });
  });

  it("put the start of everything a fixed distance above the first part, what starts there spread below it", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"));
    const root = sequenceOf(doc);
    const { rows } = layOut(root);
    const to = top(rows, doc.title);
    const opening = [partStart(doc), partStart(doc.title)];
    opening.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(to - edgeDistance + edgeDistance * index / opening.length));
    });
  });

  it("never move a part: the text is where it'd be with no markers at all", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"), section("S", paragraph("bb")));
    const { sequence, rows } = layOut(sequenceOf(doc));
    assert.deepEqual(rows.filter(({ row }) => !("marker" in row)).map(({ row }) => row.top), sequence.linesOf(0).map((line) => line.top));
  });

  it("are horizontal bars across the text area", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"));
    const { rows } = layOut(sequenceOf(doc));
    for (const position of [gap(doc, 0), partEnd(doc.title), partStart(doc)]) {
      const caret = caretAt(rows, position, measurer);
      assert.equal(caret.x, textArea.x);
      assert.equal(caret.width, textArea.width);
      assert.ok(caret.marker);
    }
  });

  it("have areas: a part's start and end its bounding box - a gap the room it's in", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const doc = document({ title: "D", paper, margins }, section("Outer", paragraph("pp"), inner), section("Next"));
    const { rows } = layOut(sequenceOf(doc));
    const box = (fromParagraph, toParagraph) => [{ page: 0, ...textArea, top: top(rows, fromParagraph), height: bottom(rows, toParagraph) - top(rows, fromParagraph) }];
    // A paragraph's start and end: the paragraph.
    assert.deepEqual(areaOf(rows, partStart(q)), box(q, q));
    assert.deepEqual(areaOf(rows, partEnd(q)), box(q, q));
    // A section's: its title to its last line.
    assert.deepEqual(areaOf(rows, partEnd(inner)), box(inner.title, q));
    // A gap: the room between the parts around it - for every gap in it.
    const room = [{ page: 0, ...textArea, top: bottom(rows, q), height: top(rows, doc.children[1].title) - bottom(rows, q) }];
    assert.deepEqual(areaOf(rows, gap(doc, 1)), room);
  });

  it("give a part on several papers an area on each", function () {
    const many = Array.from({ length: 40 }, (_, index) => paragraph("p" + index));
    const doc = document({ title: "D", paper: { width: 32000, height: 80000 }, margins }, ...many);
    const { sequence, rows } = layOut(sequenceOf(doc));
    const area = areaOf(rows, partStart(doc));
    assert.ok(sequence.pages.length > 1);
    assert.deepEqual(area.map((rect) => rect.page), sequence.pages.map((format, page) => page));
    assert.deepEqual(areaOf(rows, partEnd(doc)), area);
  });

  it("are found by a click: on a line the line, between lines the nearest marker", function () {
    const a = paragraph("aa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const { rows } = layOut(sequenceOf(doc));
    for (const position of [partEnd(a), gap(doc, 1), partStart(b)]) {
      assert.ok(samePosition(hitTest(rows, 0, 5000, markerY(rows, position), measurer), position));
    }
    assert.ok(samePosition(hitTest(rows, 0, 1600, top(rows, a) + 1000, measurer), textPosition(a, 1)));
  });

  it("can leave out kinds of markers - the caret skips them, the rest share the room, a sibling gap still dead centre", function () {
    const a = paragraph("aa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const root = sequenceOf(doc);
    const sequence = new PaperSequence();
    new SequenceLayout({ sequence: root, measurer, typography: spaced }).renderOnto(sequence);
    const onlyGaps = { paragraphStart: false, paragraphEnd: false, titleStart: false, titleEnd: false, sectionStart: false, sectionEnd: false };
    const rows = caretRows(sequence, root, { types: onlyGaps });
    const markers = walk(rows).filter((at) => !("paragraph" in at)).map((at) => nameOf(at, root));
    assert.deepEqual(markers, ["D:0", "D:1"]);
    assert.equal(markerY(rows, gap(doc, 1)), (bottom(rows, a) + top(rows, b)) / 2);

    // Without the gaps: a's end and b's start share the room between them.
    const noGaps = caretRows(sequence, root, { types: { titleGap: false, siblingGap: false } });
    const from = bottom(noGaps, a);
    const to = top(noGaps, b);
    const centre = (from + to) / 2;
    assert.equal(markerY(noGaps, partEnd(a)), centre);
    assert.equal(markerY(noGaps, partStart(b)), Math.round(centre + (to - centre) / 2));
    assert.ok(!noGaps.some(({ row }) => "marker" in row && isGap(row.marker)));
  });
});
