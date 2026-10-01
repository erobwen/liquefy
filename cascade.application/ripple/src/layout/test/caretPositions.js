import assert from "assert";
import { PaperSequence, caretRows, caretAt, stepRight, stepLeft, sequenceStart, sequenceEnd, samePosition, isGapPosition, hitTest } from "@liquefy/cascade.print";
import { document, section, paragraph, sequence as sequenceOf, gap, textPosition, paragraphText } from "../../model/parts.js";
import { SequenceLayout } from "../DocumentLayout.js";

// As in documentLayout.js: 20 characters across, 5000 µm lines, no spacing.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};
const paper = { width: 22000, height: 80000 };
// A wide left margin: the gaps sit in it.
const margins = { top: 1000, right: 1000, bottom: 1000, left: 10000 };
const plain = {
  body: { font: { family: "Body", size: 11, weight: 400, italic: false } },
  titles: [0, 1, 2, 3].map(() => ({ font: { family: "Title", size: 11, weight: 700, italic: false } })),
};

function layOut(root) {
  const sequence = new PaperSequence();
  new SequenceLayout({ sequence: root, measurer, typography: plain }).renderOnto(sequence);
  return sequence;
}

// A position, readable: a gap as list:index (the list named by its title,
// "root" for the sequence); a text position as text:offset.
function nameOf(at, root) {
  if (isGapPosition(at)) return (at.list === root ? "root" : paragraphText(at.list.title)) + ":" + at.index;
  return paragraphText(at.paragraph) + "@" + at.offset;
}

// Every place the caret goes, stepping right from the very start.
function walk(sequence) {
  const places = [];
  let at = sequenceStart(sequence);
  for (let i = 0; i < 500; i++) {
    places.push(at);
    const next = stepRight(sequence, at);
    if (samePosition(next, at)) break;
    at = next;
  }
  return places;
}

describe("Caret positions in a Ripple document", function () {
  it("has a gap before and after the root, after a title, between parts and after the last - at every level", function () {
    const inner = section("In", paragraph("x"));
    const doc = document({ title: "D", paper, margins }, paragraph("p"), inner);
    const root = sequenceOf(doc);
    const sequence = layOut(root);
    const gapsAndText = walk(sequence).map((at) => nameOf(at, root))
      // Only each paragraph's first place - the rest is its text.
      .filter((place, index, all) => !place.includes("@") || place.endsWith("@0"));
    assert.deepEqual(gapsAndText, [
      "root:0",            // before everything
      "D@0",               // the document's title
      "D:0",               // after it, before its first child
      "p@0",
      "D:1",               // between "p" and the section
      "In@0",              // the section's title
      "In:0",              // after it
      "x@0",
      "In:1",              // the end of the section...
      "D:2",               // ...and after it, in the document: two places
      "root:1",            // after everything
    ]);
  });

  it("steps back through the same places", function () {
    const doc = document({ title: "D", paper, margins }, paragraph("ab"), section("S", paragraph("cd")));
    const root = sequenceOf(doc);
    const sequence = layOut(root);
    const forward = walk(sequence);
    const backward = [];
    let at = sequenceEnd(sequence);
    for (let i = 0; i < 500; i++) {
      backward.push(at);
      const previous = stepLeft(sequence, at);
      if (samePosition(previous, at)) break;
      at = previous;
    }
    assert.deepEqual(backward.map((place) => nameOf(place, root)), forward.map((place) => nameOf(place, root)).reverse());
  });

  it("tells a section's end from the place after it: the same height, the shallower further left", function () {
    const inner = section("In", paragraph("x"));
    const doc = document({ title: "D", paper, margins }, inner);
    const root = sequenceOf(doc);
    const sequence = layOut(root);
    const end = caretAt(sequence, gap(inner, 1), measurer);
    const after = caretAt(sequence, gap(doc, 1), measurer);
    const outermost = caretAt(sequence, gap(root, 1), measurer);
    assert.equal(end.top, after.top);
    assert.ok(after.x < end.x);
    assert.ok(outermost.x < after.x);
    assert.ok(end.x < margins.left);
  });

  it("finds a gap by a click in the margin beside it - the nearest across", function () {
    const inner = section("In", paragraph("x"));
    const doc = document({ title: "D", paper, margins }, inner);
    const root = sequenceOf(doc);
    const sequence = layOut(root);
    const end = caretAt(sequence, gap(inner, 1), measurer);
    const after = caretAt(sequence, gap(doc, 1), measurer);
    assert.ok(samePosition(hitTest(sequence, 0, end.x, end.top + 1000, measurer), gap(inner, 1)));
    assert.ok(samePosition(hitTest(sequence, 0, after.x, after.top + 1000, measurer), gap(doc, 1)));
    // On the text, the text.
    const onText = hitTest(sequence, 0, margins.left + 800, 3000, measurer);
    assert.equal(nameOf(onText, root), "D@1");
    assert.ok(samePosition(onText, textPosition(doc.title, 1)));
  });

  it("follows the model: a paragraph added at a section's end makes a gap more", function () {
    const inner = section("In", paragraph("x"));
    const doc = document({ title: "D", paper, margins }, inner);
    const root = sequenceOf(doc);
    const sequence = layOut(root);
    const gapsBefore = caretRows(sequence).filter(({ row }) => "gap" in row).length;
    inner.children.push(paragraph("y"));
    const gaps = caretRows(sequence).filter(({ row }) => "gap" in row).map(({ row }) => nameOf(row.gap, root));
    assert.equal(gaps.length, gapsBefore + 1);
    assert.deepEqual(gaps, ["root:0", "D:0", "In:0", "In:1", "In:2", "D:1", "root:1"]);
  });
});
