import assert from "assert";
import { PaperSequence } from "../../print/index.js";
import {
  document, section, paragraph, sequence as sequenceOf, flowStart, flowEnd, isFlowEdge, isSection,
  samePosition, textPosition, paragraphText, exitTitle,
} from "../../model/flows.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { caretRows, besideStep, belowGap, flowBoxes } from "../markers.js";
import { caretAt, hitTest, stepRight, stepLeft, rowAbove, rowBelow, sequenceStart, sequenceEnd } from "../positions.js";

// Every character 1000 µm wide, lines 5000 µm tall; flows 6000 µm apart.
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
const textAreaRight = textArea.x + textArea.width;

function layOut(root, options = {}) {
  const sequence = new PaperSequence();
  new SequenceLayout({ sequence: root, measurer, typography: spaced }).renderOnto(sequence);
  return { sequence, rows: caretRows(sequence, root, options) };
}

const markerRow = (rows, position) => rows.find(({ row }) => "marker" in row && samePosition(row.marker, position)).row;
const areaOf = (rows, position) => markerRow(rows, position).area;
const linesOf = (rows, paragraph) => rows.filter(({ row }) => !("marker" in row) && row.paragraph === paragraph).map(({ row }) => row);
const top = (rows, paragraph) => linesOf(rows, paragraph)[0].top;
const bottom = (rows, paragraph) => {
  const lines = linesOf(rows, paragraph);
  const last = lines[lines.length - 1];
  return last.top + last.height;
};

// A position, readable: text "words@offset"; a flow's start "<flow" and end
// "flow>" (a flow named by its text, a section by its title).
function nameOf(at) {
  const flowName = (flow) => paragraphText(isSection(flow) ? flow.title : flow);
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
  it("give every flow a start and an end of its own - nothing between two flows", function () {
    const inner = section("In", paragraph("x"));
    const doc = document({ title: "D", paper, margins }, paragraph("p"), inner);
    const { rows } = layOut(sequenceOf(doc));
    const markers = walk(rows).filter((at) => !("paragraph" in at)).map(nameOf);
    assert.deepEqual(markers, [
      "<D", "<D",             // the document starts; its title starts - a title has no end
      "<p", "p>",
      "<In", "<In",           // the section starts; its title starts
      "<x", "x>",
      "In>",
      "D>",
    ]);
    // A document and its title, "D" both, are two flows: two starts.
    assert.ok(!samePosition(flowStart(doc), flowStart(doc.title)));
  });

  it("are stepped through with Left and Right, every place once - and back", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("ab"), section("S", paragraph("cd")));
    const { rows } = layOut(sequenceOf(doc));
    const forward = walk(rows);
    const backward = [];
    let at = sequenceEnd(rows);
    for (let i = 0; i < 500; i++) {
      backward.push(at);
      const previous = stepLeft(rows, at);
      if (samePosition(previous, at)) break;
      at = previous;
    }
    assert.deepEqual(backward.map(nameOf), forward.map(nameOf).reverse());
  });

  it("can leave out kinds of markers - the caret skips them", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("p"));
    const { rows } = layOut(sequenceOf(doc), { types: { paragraphStart: false, titleStart: false, sectionStart: false } });
    assert.deepEqual(walk(rows).filter((at) => !("paragraph" in at)).map(nameOf), ["p>", "D>"]);
  });

  it("put every end at the right edge of its area, the text area - the ends of flows ending together on top of each other, stepped through innermost first, their areas growing", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const outer = section("Outer", paragraph("pppppp"), inner);
    const doc = document({ title: "D", paper, margins }, outer, section("Next"));
    const { rows } = layOut(sequenceOf(doc));
    const last = linesOf(rows, q)[0];
    for (const flow of [q, inner, outer]) {
      const caret = caretAt(rows, flowEnd(flow), measurer);
      assert.equal(caret.x, textAreaRight);
      assert.equal(caret.top, last.baseline - last.ascent);
      assert.equal(caret.height, last.ascent + last.descent);
    }
    // Right from the end of "qq": one after another, out to Outer's end.
    let at = textPosition(q, 2);
    const passed = [];
    for (let i = 0; i < 3; i++) passed.push(at = stepRight(rows, at));
    assert.deepEqual(passed.map(nameOf), ["qq>", "Inner>", "Outer>"]);
    const heights = passed.map((position) => areaOf(rows, position)[0].height);
    assert.ok(heights[0] < heights[1] && heights[1] < heights[2]);
    // A click there: the innermost.
    assert.ok(samePosition(hitTest(rows, 0, textAreaRight, last.top + 1000, measurer), flowEnd(q)));
  });

  it("put section ends below, as an option: horizontal bars under the last line, one on top of the other - moving up and down through them one by one", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const outer = section("Outer", paragraph("pp"), inner);
    // A section after Outer - no exit title, its last line "qq" too.
    const next = section("Next");
    const doc = document({ title: "D", paper, margins }, outer, next);
    const { rows } = layOut(sequenceOf(doc), { sectionEnds: "below" });
    const last = linesOf(rows, q)[0];
    for (const flow of [inner, outer]) {
      const caret = caretAt(rows, flowEnd(flow), measurer);
      assert.equal(caret.y, last.top + last.height + belowGap);
      assert.equal(caret.x, textArea.x);
      assert.equal(caret.width, textArea.width);
      assert.ok(caret.marker);
    }
    // A paragraph's end still beside it.
    assert.equal(caretAt(rows, flowEnd(q), measurer).x, textAreaRight);
    // Down from "qq": Inner's end, Outer's, then Next's title - and back up.
    const x = textArea.x + 1000;
    const down = [];
    let at = textPosition(q, 1);
    for (let i = 0; i < 3; i++) down.push(at = rowBelow(rows, at, x, measurer));
    assert.deepEqual(down.map(nameOf), ["Inner>", "Outer>", "Next@1"]);
    const up = [];
    for (let i = 0; i < 3; i++) up.push(at = rowAbove(rows, at, x, measurer));
    assert.deepEqual(up.map(nameOf), ["Outer>", "Inner>", "qq@1"]);
    // A click at the bars: the innermost.
    assert.ok(samePosition(hitTest(rows, 0, x, last.top + last.height + belowGap, measurer), flowEnd(inner)));
    // Their areas: the sections'.
    assert.ok(areaOf(rows, flowEnd(outer))[0].height > areaOf(rows, flowEnd(inner))[0].height);
  });

  it("give a title no end", function () {
    const s = section("Title", paragraph("p"));
    const doc = document({ title: "D", paper, margins }, s);
    const { rows } = layOut(sequenceOf(doc));
    assert.ok(!rows.some(({ row }) => "marker" in row && row.marker.flow === s.title && row.marker.edge === "end"));
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
  });

  it("are found by a click beside a line, nearer than its text", function () {
    const a = paragraph("aa");
    const doc = document({ title: "D", paper, margins }, a, paragraph("bb"));
    const { rows } = layOut(sequenceOf(doc));
    const line = linesOf(rows, a)[0];
    const start = caretAt(rows, flowStart(a), measurer);
    assert.ok(samePosition(hitTest(rows, 0, textAreaRight - 100, line.top + 1000, measurer), flowEnd(a)));
    assert.ok(samePosition(hitTest(rows, 0, start.x, line.top + 1000, measurer), flowStart(a)));
    assert.ok(samePosition(hitTest(rows, 0, line.x + 1900, line.top + 1000, measurer), textPosition(a, 2)));
    // Between two lines: the nearest line.
    assert.ok(samePosition(hitTest(rows, 0, line.x + 1000, bottom(rows, a) + 1000, measurer), textPosition(a, 1)));
  });

  it("are gone past moving up and down - from line to line - unless the caret's x is nearer them than the text", function () {
    const a = paragraph("aaaa");
    const b = paragraph("bb");
    const s = section("S", b);
    const doc = document({ title: "D", paper, margins }, a, s);
    const { rows } = layOut(sequenceOf(doc));
    const x = textArea.x + 1000;
    assert.ok(samePosition(rowBelow(rows, textPosition(a, 1), x, measurer), textPosition(s.title, 1)));
    assert.ok(samePosition(rowBelow(rows, textPosition(s.title, 1), x, measurer), textPosition(b, 1)));
    assert.ok(samePosition(rowAbove(rows, textPosition(b, 1), x, measurer), textPosition(s.title, 1)));
    // Far right, past the text: at the paragraph's end.
    assert.ok(samePosition(rowBelow(rows, textPosition(s.title, 1), textAreaRight, measurer), flowEnd(b)));
    // From beside a line, as from the line.
    assert.ok(samePosition(rowAbove(rows, flowEnd(b), x, measurer), textPosition(s.title, 1)));
  });

  it("put the caret in a numbered title after its number - and a section's start, always there, before it", function () {
    const s = section("Sect", paragraph("p"));
    const doc = document({ title: "D", paper, margins, numberTitles: true }, s);
    const { rows } = layOut(sequenceOf(doc), { types: { sectionStart: false, titleStart: false, paragraphStart: false } });
    const line = linesOf(rows, s.title)[0];
    const number = line.runs[0];
    assert.ok(number.fixed);
    // Offset 0: after the number, before "Sect".
    assert.equal(caretAt(rows, textPosition(s.title, 0), measurer).x, line.x + number.width);
    assert.equal(caretAt(rows, textPosition(s.title, 2), measurer).x, line.x + number.width + 2000);
    // A click on the number: the title's start.
    assert.ok(samePosition(hitTest(rows, 0, line.x + 500, line.top + 1000, measurer), textPosition(s.title, 0)));
    // The section's start: there, though left out of types - before the number.
    const start = caretAt(rows, flowStart(s), measurer);
    assert.ok(start);
    assert.ok(start.x < line.x);
    assert.ok(samePosition(stepRight(rows, flowStart(s)), textPosition(s.title, 0)));
    // Not the document's own.
    assert.equal(caretAt(rows, flowStart(doc), measurer), null);
  });

  it("leave an empty paragraph's placeholder one place - before it", function () {
    const empty = paragraph();
    const doc = document({ title: "D", paper, margins }, empty, paragraph("bb"));
    const { rows } = layOut(sequenceOf(doc));
    const line = linesOf(rows, empty)[0];
    assert.ok(line.width >= 4000);  // "Text", as wide as it is
    assert.ok(samePosition(hitTest(rows, 0, line.x + 2500, line.top + 1000, measurer), textPosition(empty, 0)));
    assert.equal(caretAt(rows, textPosition(empty, 0), measurer).x, line.x);
    // Right from before it: past it, to its end.
    assert.ok(samePosition(stepRight(rows, textPosition(empty, 0)), flowEnd(empty)));
  });

  it("go around an exit title, as around text - but the caret never goes into it", function () {
    const q = paragraph("qq");
    const deep = section("Deep", q);
    const next = section({ title: "Next", titleOffset: 1 });
    const doc = document({ title: "D", paper, margins }, deep, next);
    const { sequence, rows } = layOut(sequenceOf(doc));
    const exit = sequence.linesOf(0).find((line) => line.paragraph === exitTitle(deep));
    assert.ok(exit);
    assert.ok(!rows.some(({ row }) => row === exit));
    // Deep's end beside its exit title - q's beside q.
    assert.equal(caretAt(rows, flowEnd(deep), measurer).top, exit.baseline - exit.ascent);
    assert.equal(caretAt(rows, flowEnd(q), measurer).top, linesOf(rows, q)[0].top);
    // Down from "qq": Next's title - past the exit title.
    assert.ok(samePosition(rowBelow(rows, textPosition(q, 1), textArea.x + 1000, measurer), textPosition(next.title, 1)));
  });

  it("have areas: a flow's start and end its content box", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const doc = document({ title: "D", paper, margins }, section("Outer", paragraph("pp"), inner), section("Next"));
    const { rows } = layOut(sequenceOf(doc));
    const box = (fromParagraph, toParagraph) => [{ page: 0, ...textArea, top: top(rows, fromParagraph), height: bottom(rows, toParagraph) - top(rows, fromParagraph) }];
    assert.deepEqual(areaOf(rows, flowStart(q)), box(q, q));
    assert.deepEqual(areaOf(rows, flowEnd(q)), box(q, q));
    assert.deepEqual(areaOf(rows, flowEnd(inner)), box(inner.title, q));
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

  it("give a section delimiter boxes: from its top to its first child, and from its last child - however deep - to its bottom, its exit title in it", function () {
    const deepest = paragraph("dd");
    const inner = section("Inner", paragraph("ii"), section("Deeper", deepest));
    const outer = section("Outer", inner);
    const empty = section("Empty");
    const doc = document({ title: "D", paper, margins }, outer, paragraph("after"), empty);
    const { sequence, rows } = layOut(sequenceOf(doc));
    const boxOf = flowBoxes(sequence);
    const box = (from, to) => [{ page: 0, ...textArea, top: from, height: to - from }];
    const exit = sequence.linesOf(0).find((line) => line.paragraph === exitTitle(outer));
    assert.deepEqual(boxOf(outer).startDelimiter, box(top(rows, outer.title), top(rows, inner.title)));
    assert.deepEqual(boxOf(outer).endDelimiter, box(bottom(rows, deepest), exit.top + exit.height));
    assert.deepEqual(boxOf(outer).content, box(top(rows, outer.title), exit.top + exit.height));
    assert.equal(boxOf(inner).endDelimiter, null);
    assert.deepEqual(boxOf(empty).startDelimiter, boxOf(empty).content);
    assert.equal(boxOf(deepest).startDelimiter, null);
    assert.equal(boxOf(deepest).endDelimiter, null);
  });

  it("never move a flow: the text is where it'd be with no markers at all", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"), section("S", paragraph("bb")));
    const { sequence, rows } = layOut(sequenceOf(doc));
    assert.deepEqual(rows.filter(({ row }) => !("marker" in row)).map(({ row }) => row.top), sequence.linesOf(0).map((line) => line.top));
  });
});
