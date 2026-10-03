import assert from "assert";
import { PaperSequence } from "../../print/index.js";
import {
  document, section, paragraph, sequence as sequenceOf, gap, flowStart, flowEnd, isGap, isFlowEdge, isSection,
  samePosition, textPosition, paragraphText, exitTitle,
} from "../../model/flows.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { caretRows, edgeDistance, besideStep } from "../markers.js";
import { caretAt, hitTest, stepRight, stepLeft, rowAbove, rowBelow, sequenceStart, sequenceEnd } from "../positions.js";

// Every character 1000 µm wide, lines 5000 µm tall; flows 6000 µm apart, so
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

// Starts and ends between the flows, as they were placed before they went
// beside them.
const between = { beside: false };

function layOut(root, options = {}) {
  const sequence = new PaperSequence();
  new SequenceLayout({ sequence: root, measurer, typography: spaced }).renderOnto(sequence);
  return { sequence, rows: caretRows(sequence, root, options) };
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
// named by its title, "root" for the sequence); a flow's start "<flow" and
// end "flow>" (a flow named by its text, a section by its title).
function nameOf(at, root) {
  const flowName = (flow) => paragraphText(isSection(flow) ? flow.title : flow);
  if (isGap(at)) return (at.list === root ? "root" : flowName(at.list)) + ":" + at.index;
  if (isFlowEdge(at)) return at.edge === "start" ? "<" + flowName(at.flow) : flowName(at.flow) + ">";
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
  it("give every flow a start and an end of its own, and a gap between any two flows side by side - none before the first, none after the last", function () {
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
    // A document and its title, "D" both, are two flows: two starts.
    assert.ok(!samePosition(flowStart(doc), flowStart(doc.title)));
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

  it("put a flow's end beside its last line, right of it - one step out for every flow ending with it", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const outer = section("Outer", paragraph("pppppp"), inner);
    const doc = document({ title: "D", paper, margins }, outer, section("Next"));
    const { rows } = layOut(sequenceOf(doc));
    const last = linesOf(rows, q)[0];
    // Each box as far right as its widest line: "qq", "Inner", "pppppp".
    const rights = [2000, 5000, 6000].map((width) => textArea.x + width);
    [q, inner, outer].forEach((flow, index) => {
      const caret = caretAt(rows, flowEnd(flow), measurer);
      assert.equal(caret.x, rights[index] + besideStep * (index + 1));
      assert.equal(caret.top, last.baseline - last.ascent);
      assert.equal(caret.height, last.ascent + last.descent);
      assert.ok(!caret.marker);
    });
  });

  it("put a flow's start beside its first line, left of it - one step out for every flow starting with it", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const doc = document({ title: "D", paper, margins }, section("Outer", paragraph("pp"), inner));
    const { rows } = layOut(sequenceOf(doc));
    const first = linesOf(rows, inner.title)[0];
    [inner, inner.title].forEach((flow, index) => {
      const caret = caretAt(rows, flowStart(flow), measurer);
      assert.equal(caret.x, textArea.x - besideStep * (2 - index));
      assert.equal(caret.top, first.baseline - first.ascent);
    });
    // The gap before Inner: dead centre, in the room between "pp" and Inner.
    const pp = doc.children[0].children[0];
    assert.equal(markerY(rows, gap(doc.children[0], 1)), (bottom(rows, pp) + top(rows, inner.title)) / 2);
  });

  it("are found by a click beside a line, nearer than its text", function () {
    const a = paragraph("aa");
    const doc = document({ title: "D", paper, margins }, a, paragraph("bb"));
    const { rows } = layOut(sequenceOf(doc));
    const line = linesOf(rows, a)[0];
    const end = caretAt(rows, flowEnd(a), measurer);
    const start = caretAt(rows, flowStart(a), measurer);
    assert.ok(samePosition(hitTest(rows, 0, end.x + 100, line.top + 1000, measurer), flowEnd(a)));
    assert.ok(samePosition(hitTest(rows, 0, start.x, line.top + 1000, measurer), flowStart(a)));
    assert.ok(samePosition(hitTest(rows, 0, line.x + 1900, line.top + 1000, measurer), textPosition(a, 2)));
  });

  it("are gone past moving up and down - from line to gap to line - unless the caret's x is nearer them than the text", function () {
    const a = paragraph("aaaa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const { rows } = layOut(sequenceOf(doc));
    const x = textArea.x + 1000;
    // Down from "aaaa": the gap, then "bb" - past a's end and b's start.
    const toGap = rowBelow(rows, textPosition(a, 1), x, measurer);
    assert.ok(samePosition(toGap, gap(doc, 1)));
    assert.ok(samePosition(rowBelow(rows, toGap, x, measurer), textPosition(b, 1)));
    assert.ok(samePosition(rowAbove(rows, toGap, x, measurer), textPosition(a, 1)));
    // Past the end of "bb", nearer its end beside it: there.
    const endX = caretAt(rows, flowEnd(b), measurer).x;
    assert.ok(samePosition(rowBelow(rows, toGap, endX, measurer), flowEnd(b)));
    // From beside a line, as from the line.
    assert.ok(samePosition(rowAbove(rows, flowEnd(b), x, measurer), gap(doc, 1)));
    assert.ok(samePosition(rowBelow(rows, flowStart(a), x, measurer), gap(doc, 1)));
  });

  it("split, put a gap's two places a third and two thirds of the way down - what ends above them, what starts below", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const next = section("Next");
    const doc = document({ title: "D", paper, margins }, section("Outer", paragraph("pp"), inner), next);
    const root = sequenceOf(doc);
    const { rows } = layOut(root, { ...between, splitGaps: "beforeSections" });
    const from = bottom(rows, q);
    const to = top(rows, next.title);
    const upper = Math.round(from + (to - from) / 3);
    const lower = Math.round(from + (to - from) * 2 / 3);
    assert.equal(markerY(rows, gap(doc, 1, 0)), upper);
    assert.equal(markerY(rows, gap(doc, 1, 1)), lower);
    const closing = [flowEnd(q), flowEnd(inner), flowEnd(doc.children[0])];
    closing.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(from + (upper - from) * (index + 1) / (closing.length + 1)));
    });
    const opening = [flowStart(next), flowStart(next.title)];
    opening.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(lower + (to - lower) * (index + 1) / (opening.length + 1)));
    });
    // Two places, stepped through one after the other - upper first.
    const places = walk(rows);
    const at = places.findIndex((place) => samePosition(place, gap(doc, 1, 0)));
    assert.ok(samePosition(places[at + 1], gap(doc, 1, 1)));
    assert.ok(!samePosition(gap(doc, 1, 0), gap(doc, 1, 1)));
  });

  it("split, with starts and ends beside the flows, put a gap's two places a third and two thirds down", function () {
    const a = paragraph("aa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const { rows } = layOut(sequenceOf(doc), { splitGaps: "all" });
    const from = bottom(rows, a);
    const to = top(rows, b);
    assert.equal(markerY(rows, gap(doc, 1, 0)), Math.round(from + (to - from) / 3));
    assert.equal(markerY(rows, gap(doc, 1, 1)), Math.round(from + (to - from) * 2 / 3));
  });

  it("split, give a gap's second place an area reaching over the start delimiter box after it - a section's title", function () {
    const a = paragraph("aa");
    const next = section("Next", paragraph("nn"));
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b, next);
    const { rows } = layOut(sequenceOf(doc), { splitGaps: "all" });
    const box = (from, to) => [{ page: 0, ...textArea, top: from, height: to - from }];
    // Before a section: the room, and the section's title below it.
    assert.deepEqual(areaOf(rows, gap(doc, 2, 0)), box(bottom(rows, b), top(rows, next.title)));
    assert.deepEqual(areaOf(rows, gap(doc, 2, 1)), box(bottom(rows, b), bottom(rows, next.title)));
    // Before a paragraph - no delimiter: the room.
    assert.deepEqual(areaOf(rows, gap(doc, 1, 1)), box(bottom(rows, a), top(rows, b)));
  });

  it("go around an exit title, as around text - but the caret never goes into it", function () {
    const q = paragraph("qq");
    const deep = section({ title: "Deep", titleOffset: 1 }, q);
    const next = section("Next");
    const doc = document({ title: "D", paper, margins }, deep, next);
    const root = sequenceOf(doc);
    const { sequence, rows } = layOut(root);
    const exit = sequence.linesOf(0).find((line) => line.paragraph === exitTitle(deep));
    assert.ok(exit);
    assert.ok(!rows.some(({ row }) => row === exit));
    // Deep's end beside its exit title - q's beside q.
    assert.equal(caretAt(rows, flowEnd(deep), measurer).top, exit.baseline - exit.ascent);
    assert.equal(caretAt(rows, flowEnd(q), measurer).top, linesOf(rows, q)[0].top);
    // The gap after Deep: dead centre between its exit title and Next.
    assert.equal(markerY(rows, gap(doc, 1)), (exit.top + exit.height + top(rows, next.title)) / 2);
    // Down from "qq": the gap - past the exit title.
    assert.ok(samePosition(rowBelow(rows, textPosition(q, 1), textArea.x + 1000, measurer), gap(doc, 1)));
  });

  it("split, before sections: every gap before a flow with a title is two places - before a paragraph, one", function () {
    const outer = section("Outer", paragraph("pp"), section("Inner", paragraph("qq")));
    const doc = document({ title: "D", paper, margins }, paragraph("aa"), outer, section("Next"));
    const root = sequenceOf(doc, document({ title: "E", paper, margins }));
    const { rows } = layOut(root, { splitGaps: "beforeSections" });
    const gapsAt = (list, index) => rows.filter(({ row }) => "marker" in row && isGap(row.marker) && row.marker.list === list && row.marker.index === index).length;
    assert.equal(gapsAt(doc, 0), 1);    // the title, then "aa"
    assert.equal(gapsAt(doc, 1), 2);    // "aa", then Outer
    assert.equal(gapsAt(doc, 2), 2);    // Outer, then Next
    assert.equal(gapsAt(outer, 0), 1);  // Outer's title, then "pp"
    assert.equal(gapsAt(outer, 1), 2);  // "pp", then Inner
    assert.equal(gapsAt(root, 1), 2);   // one document, then the next
  });

  it("put the gap between two siblings dead centre between them - between the flows, the one's end above it, the other's start below", function () {
    const a = paragraph("aa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const { rows } = layOut(sequenceOf(doc), between);
    const from = bottom(rows, a);
    const to = top(rows, b);
    const centre = (from + to) / 2;
    assert.equal(markerY(rows, gap(doc, 1)), centre);
    assert.equal(markerY(rows, flowEnd(a)), Math.round(from + (centre - from) / 2));
    assert.equal(markerY(rows, flowStart(b)), Math.round(centre + (to - centre) / 2));
  });

  it("spread what ends together evenly down to the sibling gap after it, and what starts below it down to the flow", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const outer = section("Outer", paragraph("pp"), inner);
    const next = section("Next");
    const doc = document({ title: "D", paper, margins }, outer, next);
    const { rows } = layOut(sequenceOf(doc), between);
    // After "qq": its end, Inner's end, Outer's end - then the gap between
    // Outer and Next, dead centre; then Next starts, and Next's title.
    const from = bottom(rows, q);
    const to = top(rows, next.title);
    const centre = (from + to) / 2;
    const closing = [flowEnd(q), flowEnd(inner), flowEnd(outer), gap(doc, 1)];
    closing.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(from + (centre - from) * (index + 1) / closing.length));
    });
    const opening = [flowStart(next), flowStart(next.title)];
    opening.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(centre + (to - centre) * (index + 1) / (opening.length + 1)));
    });
  });

  it("put the end of everything a fixed distance below the last flow, what ends there spread above it", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const doc = document({ title: "D", paper, margins }, inner);
    const root = sequenceOf(doc);
    const { rows } = layOut(root, between);
    const from = bottom(rows, q);
    const closing = [flowEnd(q), flowEnd(inner), flowEnd(doc)];
    closing.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(from + edgeDistance * (index + 1) / closing.length));
    });
  });

  it("put the start of everything a fixed distance above the first flow, what starts there spread below it", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"));
    const root = sequenceOf(doc);
    const { rows } = layOut(root, between);
    const to = top(rows, doc.title);
    const opening = [flowStart(doc), flowStart(doc.title)];
    opening.forEach((position, index) => {
      assert.equal(markerY(rows, position), Math.round(to - edgeDistance + edgeDistance * index / opening.length));
    });
  });

  it("never move a flow: the text is where it'd be with no markers at all", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"), section("S", paragraph("bb")));
    const { sequence, rows } = layOut(sequenceOf(doc));
    assert.deepEqual(rows.filter(({ row }) => !("marker" in row)).map(({ row }) => row.top), sequence.linesOf(0).map((line) => line.top));
  });

  it("are horizontal bars across the text area - gaps, and starts and ends between the flows", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"));
    const { rows } = layOut(sequenceOf(doc), between);
    for (const position of [gap(doc, 0), flowEnd(doc.title), flowStart(doc)]) {
      const caret = caretAt(rows, position, measurer);
      assert.equal(caret.x, textArea.x);
      assert.equal(caret.width, textArea.width);
      assert.ok(caret.marker);
    }
  });

  it("have areas: a flow's start and end its bounding box - a gap the room it's in", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const doc = document({ title: "D", paper, margins }, section("Outer", paragraph("pp"), inner), section("Next"));
    const { rows } = layOut(sequenceOf(doc));
    const box = (fromParagraph, toParagraph) => [{ page: 0, ...textArea, top: top(rows, fromParagraph), height: bottom(rows, toParagraph) - top(rows, fromParagraph) }];
    // A paragraph's start and end: the paragraph.
    assert.deepEqual(areaOf(rows, flowStart(q)), box(q, q));
    assert.deepEqual(areaOf(rows, flowEnd(q)), box(q, q));
    // A section's: its title to its last line.
    assert.deepEqual(areaOf(rows, flowEnd(inner)), box(inner.title, q));
    // A gap: the room between the flows around it - for every gap in it.
    const room = [{ page: 0, ...textArea, top: bottom(rows, q), height: top(rows, doc.children[1].title) - bottom(rows, q) }];
    assert.deepEqual(areaOf(rows, gap(doc, 1)), room);
  });

  it("give a flow on several papers an area on each", function () {
    const many = Array.from({ length: 40 }, (_, index) => paragraph("p" + index));
    const doc = document({ title: "D", paper: { width: 32000, height: 80000 }, margins }, ...many);
    const { sequence, rows } = layOut(sequenceOf(doc));
    const area = areaOf(rows, flowStart(doc));
    assert.ok(sequence.pages.length > 1);
    assert.deepEqual(area.map((rect) => rect.page), sequence.pages.map((format, page) => page));
    assert.deepEqual(areaOf(rows, flowEnd(doc)), area);
  });

  it("are found by a click: on a line the line, between lines the nearest marker", function () {
    const a = paragraph("aa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const { rows } = layOut(sequenceOf(doc), between);
    for (const position of [flowEnd(a), gap(doc, 1), flowStart(b)]) {
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
    const noGaps = caretRows(sequence, root, { ...between, types: { titleGap: false, siblingGap: false } });
    const from = bottom(noGaps, a);
    const to = top(noGaps, b);
    const centre = (from + to) / 2;
    assert.equal(markerY(noGaps, flowEnd(a)), centre);
    assert.equal(markerY(noGaps, flowStart(b)), Math.round(centre + (to - centre) / 2));
    assert.ok(!noGaps.some(({ row }) => "marker" in row && isGap(row.marker)));
  });
});
