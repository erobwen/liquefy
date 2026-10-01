import assert from "assert";
import { PaperSequence } from "@liquefy/cascade.print";
import { document, section, paragraph, sequence as sequenceOf, gap, isGap, samePosition, textPosition, paragraphText } from "../../model/parts.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { caretRows, edgeDistance } from "../markers.js";
import { caretAt, hitTest, stepRight, stepLeft, sequenceStart, sequenceEnd } from "../positions.js";

// Every character 1000 µm wide, lines 5000 µm tall; paragraphs 4000 µm
// apart, so there's room between them to see where markers go.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};
const paper = { width: 32000, height: 200000 };
const margins = { top: 10000, right: 1000, bottom: 1000, left: 1000 };
const font = { family: "Body", size: 11, weight: 400, italic: false };
const spaced = {
  body: { font, spaceAfter: 4000 },
  titles: [0, 1, 2, 3].map(() => ({ font, spaceAfter: 4000 })),
};

function layOut(root) {
  const sequence = new PaperSequence();
  new SequenceLayout({ sequence: root, measurer, typography: spaced }).renderOnto(sequence);
  return { sequence, rows: caretRows(sequence, root) };
}

// A gap's marker height, and a paragraph's upper and lower edge.
const markerY = (rows, position) => rows.find(({ row }) => "gap" in row && samePosition(row.gap, position)).row.y;
const linesOf = (rows, paragraph) => rows.filter(({ row }) => !("gap" in row) && row.paragraph === paragraph).map(({ row }) => row);
const top = (rows, paragraph) => linesOf(rows, paragraph)[0].top;
const bottom = (rows, paragraph) => {
  const lines = linesOf(rows, paragraph);
  const last = lines[lines.length - 1];
  return last.top + last.height;
};

describe("Ripple's gap markers", function () {
  it("are dead centre between two siblings - and between a title and its first child", function () {
    const a = paragraph("aa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const { rows } = layOut(sequenceOf(doc));
    assert.equal(markerY(rows, gap(doc, 1)), (bottom(rows, a) + top(rows, b)) / 2);
    assert.equal(markerY(rows, gap(doc, 0)), (bottom(rows, doc.title) + top(rows, a)) / 2);
  });

  it("span the text area, as horizontal bars", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"));
    const { rows } = layOut(sequenceOf(doc));
    const caret = caretAt(rows, gap(doc, 1), measurer);
    assert.equal(caret.x, margins.left);
    assert.equal(caret.width, paper.width - margins.left - margins.right);
    assert.ok(caret.gap);
  });

  it("spread the ends of lists ending together evenly, from the part they end after to the sibling gap after them", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const outer = section("Outer", paragraph("pp"), inner);
    const next = section("Next");
    const doc = document({ title: "D", paper, margins }, outer, next);
    const { rows } = layOut(sequenceOf(doc));
    // After "qq": Inner ends, Outer ends, then the gap between Outer and
    // Next - dead centre - with the two ends a third and two thirds down to it.
    const from = bottom(rows, q);
    const centre = (from + top(rows, next.title)) / 2;
    assert.equal(markerY(rows, gap(doc, 1)), centre);
    assert.equal(markerY(rows, gap(outer, 2)), Math.round(from + (centre - from) * 2 / 3));
    assert.equal(markerY(rows, gap(inner, 1)), Math.round(from + (centre - from) / 3));
  });

  it("put the end of everything a fixed distance below the last part, the ends inside it spread above", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const doc = document({ title: "D", paper, margins }, inner);
    const root = sequenceOf(doc);
    const { rows } = layOut(root);
    const from = bottom(rows, q);
    assert.equal(markerY(rows, gap(root, 1)), from + edgeDistance);
    assert.equal(markerY(rows, gap(doc, 1)), Math.round(from + edgeDistance * 2 / 3));
    assert.equal(markerY(rows, gap(inner, 1)), Math.round(from + edgeDistance / 3));
  });

  it("put the start of everything a fixed distance above the first part", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"));
    const root = sequenceOf(doc);
    const { rows } = layOut(root);
    assert.equal(markerY(rows, gap(root, 0)), top(rows, doc.title) - edgeDistance);
  });

  it("never move a part: the text is where it'd be with no markers at all", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("aa"), section("S", paragraph("bb")));
    const root = sequenceOf(doc);
    const { sequence, rows } = layOut(root);
    const lineTops = sequence.linesOf(0).map((line) => line.top);
    assert.deepEqual(rows.filter(({ row }) => !("gap" in row)).map(({ row }) => row.top), lineTops);
  });

  it("are stepped through with Left and Right, every place once, and back", function () {
    const inner = section("In", paragraph("x"));
    const doc = document({ title: "D", paper, margins }, paragraph("p"), inner);
    const root = sequenceOf(doc);
    const { rows } = layOut(root);
    const name = (at) => isGap(at)
      ? (at.list === root ? "root" : paragraphText(at.list.title)) + ":" + at.index
      : paragraphText(at.paragraph) + "@" + at.offset;
    const forward = [];
    let at = sequenceStart(rows);
    for (let i = 0; i < 100; i++) {
      forward.push(name(at));
      const next = stepRight(rows, at);
      if (samePosition(next, at)) break;
      at = next;
    }
    assert.deepEqual(forward, [
      "root:0", "D@0", "D@1", "D:0", "p@0", "p@1", "D:1", "In@0", "In@1", "In@2", "In:0", "x@0", "x@1", "In:1", "D:2", "root:1",
    ]);
    const backward = [];
    at = sequenceEnd(rows);
    for (let i = 0; i < 100; i++) {
      backward.push(name(at));
      const previous = stepLeft(rows, at);
      if (samePosition(previous, at)) break;
      at = previous;
    }
    assert.deepEqual(backward, forward.slice().reverse());
  });

  it("are found by a click: on a line the line, between lines the nearest marker - the levels told apart by height", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const doc = document({ title: "D", paper, margins }, section("Outer", paragraph("pp"), inner), section("Next"));
    const { rows } = layOut(sequenceOf(doc));
    const innerEnd = markerY(rows, gap(inner, 1));
    assert.ok(samePosition(hitTest(rows, 0, 5000, innerEnd + 100, measurer), gap(inner, 1)));
    assert.ok(samePosition(hitTest(rows, 0, 5000, markerY(rows, gap(doc, 1)), measurer), gap(doc, 1)));
    assert.ok(samePosition(hitTest(rows, 0, 1600, top(rows, q) + 1000, measurer), textPosition(q, 1)));
  });

  // A gap's area: the room between two siblings, or the part a list starts
  // or ends with - across the text area.
  const areaOf = (rows, position) => rows.find(({ row }) => "gap" in row && samePosition(row.gap, position)).row.area;
  const textArea = { x: margins.left, width: paper.width - margins.left - margins.right };

  it("has an area between two siblings: from the one's lower edge to the other's upper edge, the bar in the middle of it", function () {
    const a = paragraph("aa");
    const b = paragraph("bb");
    const doc = document({ title: "D", paper, margins }, a, b);
    const { rows } = layOut(sequenceOf(doc));
    const [area] = areaOf(rows, gap(doc, 1));
    assert.deepEqual(area, { page: 0, ...textArea, top: bottom(rows, a), height: top(rows, b) - bottom(rows, a) });
    assert.equal(markerY(rows, gap(doc, 1)), area.top + area.height / 2);
  });

  it("has, at a list's end, the bounding box of the part it ends after - lists ending together one inside another", function () {
    const q = paragraph("qq");
    const inner = section("Inner", q);
    const outer = section("Outer", paragraph("pp"), inner);
    const doc = document({ title: "D", paper, margins }, outer, section("Next"));
    const { rows } = layOut(sequenceOf(doc));
    // The end of Inner: "qq" itself. The end of Outer: all of Inner, its
    // title to its last line.
    assert.deepEqual(areaOf(rows, gap(inner, 1)), [{ page: 0, ...textArea, top: top(rows, q), height: bottom(rows, q) - top(rows, q) }]);
    assert.deepEqual(areaOf(rows, gap(outer, 2)), [{ page: 0, ...textArea, top: top(rows, inner.title), height: bottom(rows, q) - top(rows, inner.title) }]);
  });

  it("has, at a list's start, the bounding box of the part it starts with - on every paper the part is on", function () {
    const many = Array.from({ length: 40 }, (_, index) => paragraph("p" + index));
    const doc = document({ title: "D", paper: { width: 32000, height: 60000 }, margins }, ...many);
    const root = sequenceOf(doc);
    const { sequence, rows } = layOut(root);
    const area = areaOf(rows, gap(root, 0));
    assert.ok(sequence.pages.length > 1);
    assert.deepEqual(area.map((rect) => rect.page), sequence.pages.map((format, page) => page));
    assert.equal(area[0].top, top(rows, doc.title));
    // And the end of everything: the same document.
    assert.deepEqual(areaOf(rows, gap(root, 1)), area);
  });
});
