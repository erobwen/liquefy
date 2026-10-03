import assert from "assert";
import {
  document, section, paragraph, bold, sequence as sequenceOf, paragraphText, isSection, isParagraph,
  textPosition, flowEnd, flowStart, splitMarker, joinMarker, samePosition,
} from "../../model/flows.js";
import { rippleEditing } from "../editing.js";
import { PaperSequence } from "../../print/index.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { caretRows } from "../markers.js";
import { rowAt } from "../positions.js";

const paper = { width: 100000, height: 100000 };
const margins = { top: 0, right: 0, bottom: 0, left: 0 };

// A flow, readable: a paragraph its text; a section "Title[child, ...]".
function shape(flow) {
  if (isParagraph(flow)) return paragraphText(flow);
  return paragraphText(flow.title) + (flow.titleOffset ? "+" + flow.titleOffset : "") + "[" + flow.children.map(shape).join(", ") + "]";
}

function setUp(...children) {
  const doc = document({ title: "D", paper, margins }, ...children);
  const root = sequenceOf(doc);
  return { doc, root, editing: rippleEditing(root) };
}

describe("Editing a Ripple document", function () {
  describe("in the text", function () {
    it("types into the span before the caret, taking its style", function () {
      const p = paragraph("ab", bold("cd"));
      const { editing } = setUp(p);
      const after = editing.insertText(textPosition(p, 4), "e");
      assert.deepEqual(p.spans.map((span) => [span.text, span.bold]), [["ab", false], ["cde", true]]);
      assert.ok(samePosition(after, textPosition(p, 5)));
      editing.insertText(textPosition(p, 0), "x");
      assert.equal(paragraphText(p), "xabcde");
    });

    it("types into an empty paragraph", function () {
      const s = section("");
      const { editing } = setUp(s);
      editing.insertText(textPosition(s.title, 0), "Named");
      assert.equal(paragraphText(s.title), "Named");
    });

    it("takes out a character with Backspace and Delete - a surrogate pair as one", function () {
      const p = paragraph("a😀b");
      const { editing } = setUp(p);
      assert.ok(samePosition(editing.deleteBackward(textPosition(p, 3)), textPosition(p, 1)));
      assert.equal(paragraphText(p), "ab");
      editing.deleteForward(textPosition(p, 0));
      assert.equal(paragraphText(p), "b");
    });

    it("splits a paragraph with Enter - and joins it back with Backspace at its start, Delete at the end before", function () {
      const p = paragraph("one", bold("two"));
      const { doc, editing } = setUp(p);
      const at = editing.splitParagraph(textPosition(p, 4));
      assert.equal(shape(doc), "D[onet, wo]");
      assert.ok(doc.children[1].spans[0].bold);
      assert.ok(samePosition(at, textPosition(doc.children[1], 0)));
      assert.ok(samePosition(editing.deleteBackward(at), textPosition(p, 4)));
      assert.equal(shape(doc), "D[onetwo]");
      editing.splitParagraph(textPosition(p, 3));
      editing.deleteForward(textPosition(p, 3));
      assert.equal(shape(doc), "D[onetwo]");
    });

    it("moves what's after the caret in a title, on Enter, into a new first paragraph", function () {
      const s = section("Title text", paragraph("p"));
      const { editing } = setUp(s);
      editing.splitParagraph(textPosition(s.title, 5));
      assert.equal(shape(s), "Title[ text, p]");
    });

    it("takes out a selection within a paragraph, and across paragraphs side by side", function () {
      const a = paragraph("aaaa");
      const b = paragraph("bbbb");
      const c = paragraph("cccc");
      const { doc, editing } = setUp(a, b, c);
      editing.deleteBetween(textPosition(a, 1), textPosition(a, 3));
      assert.equal(paragraphText(a), "aa");
      const at = editing.deleteBetween(textPosition(c, 2), textPosition(a, 1));
      assert.equal(shape(doc), "D[acc]");
      assert.ok(samePosition(at, textPosition(a, 1)));
    });
  });

  describe("at a post marker", function () {
    it("makes a new paragraph after a paragraph on Enter - the caret in it", function () {
      const p = paragraph("p");
      const { doc, editing } = setUp(p, paragraph("q"));
      const at = editing.splitParagraph(flowEnd(p));
      assert.equal(shape(doc), "D[p, , q]");
      assert.ok(samePosition(at, textPosition(doc.children[1], 0)));
    });

    it("makes a new section after a section on Enter - with no title offset - the caret in its title", function () {
      const s = section({ title: "S", titleOffset: 1 }, paragraph("p"));
      const { doc, editing } = setUp(s);
      const at = editing.splitParagraph(flowEnd(s));
      assert.equal(shape(doc), "D[S+1[p], []]");
      assert.ok(samePosition(at, textPosition(doc.children[1].title, 0)));
    });

    it("types at a paragraph's pre and post markers at its start and end", function () {
      const p = paragraph("mid");
      const { editing } = setUp(p);
      editing.insertText(flowEnd(p), ">");
      editing.insertText(flowStart(p), "<");
      assert.equal(paragraphText(p), "<mid>");
    });
  });

  describe("at a split marker", function () {
    it("makes a new section on typing, before a section - as far down as it - the text in its title", function () {
      const next = section({ title: "Next", titleOffset: 1 });
      const { doc, editing } = setUp(paragraph("p"), next);
      const at = editing.insertText(splitMarker(doc, 1), "New");
      assert.equal(shape(doc), "D[p, New+1[], Next+1[]]");
      assert.ok(samePosition(at, textPosition(doc.children[1].title, 3)));
    });

    it("makes a new paragraph on typing, before a paragraph", function () {
      const { doc, editing } = setUp(paragraph("p"), paragraph("q"));
      editing.insertText(splitMarker(doc, 1), "new");
      assert.equal(shape(doc), "D[p, new, q]");
    });

    it("splits its section in two on Enter - the caret at the split marker between them", function () {
      const outer = section("Outer", paragraph("a"), paragraph("b"), section("c"));
      const { doc, editing } = setUp(outer);
      const at = editing.splitParagraph(splitMarker(outer, 1));
      assert.equal(shape(doc), "D[Outer[a], [b, c[]]]");
      assert.ok(samePosition(at, splitMarker(doc, 1)));
    });
  });

  describe("at a join marker", function () {
    it("joins two sections on Backspace or Delete - the second's title gone, its children the first's", function () {
      const { doc, editing } = setUp(section("A", paragraph("a")), section("B", paragraph("b")));
      const at = editing.deleteBackward(joinMarker(doc, 1));
      assert.equal(shape(doc), "D[A[a, b]]");
      assert.ok(samePosition(at, splitMarker(doc.children[0], 1)));
    });

    it("joins two paragraphs' text", function () {
      const { doc, editing } = setUp(paragraph("ab"), paragraph("cd"));
      const at = editing.deleteForward(joinMarker(doc, 1));
      assert.equal(shape(doc), "D[abcd]");
      assert.ok(samePosition(at, textPosition(doc.children[0], 2)));
    });

    it("makes a paragraph after a section the section's last child", function () {
      const { doc, editing } = setUp(section("A", paragraph("a")), paragraph("after"));
      editing.deleteBackward(joinMarker(doc, 1));
      assert.equal(shape(doc), "D[A[a, after]]");
    });

    it("unwraps a section after a paragraph - its title gone, its children after the paragraph, in the section it's in", function () {
      const { doc, editing } = setUp(paragraph("p"), section("S", paragraph("x"), section("Inner")));
      const at = editing.deleteBackward(joinMarker(doc, 1));
      assert.equal(shape(doc), "D[p, x, Inner[]]");
      assert.ok(samePosition(at, splitMarker(doc, 1)));
    });

    it("joins on typing, then types as at the split marker the join made", function () {
      const { doc, editing } = setUp(section("A", paragraph("a")), section("B", section("Sub")));
      const at = editing.insertText(joinMarker(doc, 1), "T");
      assert.equal(shape(doc), "D[A[a, T[], Sub[]]]");
      assert.ok(samePosition(at, textPosition(doc.children[0].children[1].title, 1)));
    });
  });

  it("leaves the caret where the layout, laid out again, has a place for it", function () {
    const measurer = { measure: (text) => text.length * 1000, metrics: () => ({ ascent: 4000, descent: 1000 }) };
    const { doc, root, editing } = setUp(section("A", paragraph("a")), section("B", paragraph("b")));
    const sequence = new PaperSequence();
    new SequenceLayout({ sequence: root, measurer }).renderOnto(sequence);
    const placed = (at) => !!rowAt(caretRows(sequence, root, { joinMarkers: "beforeSections" }), at);
    const typed = editing.insertText(joinMarker(doc, 1), "T");
    assert.ok(placed(typed));
    assert.ok(placed(editing.splitParagraph(flowEnd(doc.children[0]))));
    assert.ok(placed(editing.splitParagraph(splitMarker(doc.children[0], 1))));
  });

  it("leaves everything as it is anywhere else - Backspace at a split marker, Enter at a pre marker", function () {
    const p = paragraph("p");
    const { doc, editing } = setUp(p, paragraph("q"));
    assert.ok(samePosition(editing.deleteBackward(splitMarker(doc, 1)), splitMarker(doc, 1)));
    assert.ok(samePosition(editing.splitParagraph(flowStart(p)), flowStart(p)));
    assert.equal(shape(doc), "D[p, q]");
    assert.ok(isSection(doc));
  });
});
