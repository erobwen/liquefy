import assert from "assert";
import {
  document, section, paragraph, bold, sequence as sequenceOf, paragraphText, isSection, isParagraph,
  textPosition, flowEnd, flowStart, samePosition,
} from "../../model/flows.js";
import { rippleEditing } from "../editing.js";
import { PaperSequence } from "../../print/index.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { caretRows } from "../markers.js";
import { rowAt } from "../positions.js";

const paper = { width: 100000, height: 100000 };
const margins = { top: 0, right: 0, bottom: 0, left: 0 };

// A flow, readable: a paragraph its text ("_" if empty); a section
// "Title[child, ...]".
function shape(flow) {
  if (isParagraph(flow)) return paragraphText(flow) || "_";
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

    it("only moves the caret on Enter at the end, when what's next is empty - its placeholder waiting", function () {
      const p = paragraph("p");
      const empty = paragraph();
      const { doc, editing } = setUp(p, empty, paragraph("q"));
      assert.ok(samePosition(editing.splitParagraph(textPosition(p, 1)), textPosition(empty, 0)));
      assert.equal(shape(doc), "D[p, _, q]");
      // A new section's title, written: Enter goes on to its empty text.
      const s = section("", paragraph());
      const { editing: inSection } = setUp(s);
      inSection.insertText(textPosition(s.title, 0), "T");
      assert.ok(samePosition(inSection.splitParagraph(textPosition(s.title, 1)), textPosition(s.children[0], 0)));
      assert.equal(shape(s), "T[_]");
      // Nothing empty next: a new paragraph, as ever.
      editing.splitParagraph(textPosition(doc.children[2], 1));
      assert.equal(shape(doc), "D[p, _, q, _]");
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
    it("takes the flow out on Backspace - the caret at the end of the text before it; a section left empty given an empty paragraph", function () {
      const inner = section("Inner", paragraph("i"));
      const outer = section("Outer", inner);
      const { doc, editing } = setUp(paragraph("p"), outer, paragraph("q"));
      let at = editing.deleteBackward(flowEnd(inner));
      assert.equal(shape(doc), "D[p, Outer[_], q]");
      assert.ok(samePosition(at, textPosition(outer.title, 5)));
      at = editing.deleteBackward(flowEnd(doc.children[2]));
      assert.equal(shape(doc), "D[p, Outer[_]]");
      assert.ok(samePosition(at, textPosition(outer.children[0], 0)));
      // The only document: stays.
      assert.ok(samePosition(editing.deleteBackward(flowEnd(doc)), flowEnd(doc)));
    });

    it("makes a new paragraph after a paragraph on Enter - the caret in it", function () {
      const p = paragraph("p");
      const { doc, editing } = setUp(p, paragraph("q"));
      const at = editing.splitParagraph(flowEnd(p));
      assert.equal(shape(doc), "D[p, _, q]");
      assert.ok(samePosition(at, textPosition(doc.children[1], 0)));
    });

    it("makes a new section after a section on Enter - with no title offset - the caret in its title", function () {
      const s = section({ title: "S", titleOffset: 1 }, paragraph("p"));
      const { doc, editing } = setUp(s);
      const at = editing.splitParagraph(flowEnd(s));
      assert.equal(shape(doc), "D[S+1[p], [_]]");
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

  describe("the structure, from the text", function () {
    it("makes a section on Enter on an empty paragraph - holding the paragraphs after it, up to the next section - and splits it off on Enter at its title's start; Backspace undoes both", function () {
      const p = paragraph("p");
      const outer = section("Outer", p, paragraph("x"), section("Y"), paragraph("z"));
      const { doc, editing } = setUp(outer);
      const original = shape(doc);
      // Enter at the end of "p": an empty paragraph.
      let at = editing.splitParagraph(textPosition(p, 1));
      assert.equal(shape(doc), "D[Outer[p, _, x, Y[], z]]");
      // Enter on it: a section in its place, holding "x" - up to Y.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[Outer[p, [x], Y[], z]]");
      const made = outer.children[1];
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // Enter at its title's start: split off Outer - what came after it in
      // Outer moved into it.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[Outer[p], [x, Y[], z]]");
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // Backspace: back into Outer, flattened - as it was before the split.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[Outer[p, [x], Y[], z]]");
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // Backspace: unwrapped - its empty title gone, all it held in its
      // place. Back where it started.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), original);
      assert.ok(samePosition(at, textPosition(outer.children[1], 0)));
    });

    it("promotes a paragraph to a section's title on Enter at its start twice - the empty one the first Enter left gone; Backspace makes it a paragraph again", function () {
      const x = paragraph("Heading");
      const { doc, editing } = setUp(paragraph("p"), x, paragraph("y"), section("S"));
      // Enter at the start of "Heading": an empty paragraph before it.
      let at = editing.splitParagraph(textPosition(x, 0));
      assert.equal(shape(doc), "D[p, _, Heading, y, S[]]");
      // Enter again, the empty one before it: a section, "Heading" its title,
      // holding "y" - up to S.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[p, Heading[y], S[]]");
      const made = doc.children[1];
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // Backspace at the start of its title: a paragraph again.
      editing.deleteBackward(at);
      assert.equal(shape(doc), "D[p, Heading, y, S[]]");
    });

    it("leaves no section empty on a split - and still undoes it exactly: Enter, Enter on a section's only, empty paragraph, then Backspace, Backspace", function () {
      const s = section("S", paragraph());
      const { doc, editing } = setUp(s, paragraph("after"));
      const original = shape(doc);
      // Enter on the empty paragraph: a section in its place.
      let at = editing.splitParagraph(textPosition(s.children[0], 0));
      assert.equal(shape(doc), "D[S[[_]], after]");
      // Enter at its title: split off S - S left with an empty paragraph.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[_], [_], after]");
      // Backspace: back in S - in place of the empty paragraph there.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[S[[_]], after]");
      // Backspace: unwrapped.
      editing.deleteBackward(at);
      assert.equal(shape(doc), original);
    });

    it("undoes a section made on Enter with one Backspace", function () {
      const p = paragraph("p");
      const { doc, editing } = setUp(p, paragraph("x"), section("Y"));
      const original = shape(doc);
      const at = editing.splitParagraph(editing.splitParagraph(textPosition(p, 1)));
      assert.equal(shape(doc), "D[p, [x], Y[]]");
      editing.deleteBackward(at);
      assert.equal(shape(doc), original);
    });

    it("makes a section holding an empty paragraph, on Enter on the last, empty paragraph", function () {
      const { doc, editing } = setUp(paragraph("p"), paragraph());
      editing.splitParagraph(textPosition(doc.children[1], 0));
      assert.equal(shape(doc), "D[p, [_]]");
    });

    it("splits a section off on Enter at its title's start even with text in the title - what came after it moved into it", function () {
      const s = section("S", paragraph("s"));
      const outer = section("Outer", paragraph("o"), s, section("T"));
      const { doc, editing } = setUp(outer);
      editing.splitParagraph(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[Outer[o], S[s, T[]]]");
    });

    it("makes a section right in a document a document of its own on Enter at its title's start - and Backspace a section again", function () {
      const s = section("S", paragraph("s"));
      const { doc, root, editing } = setUp(paragraph("d"), s);
      const at = editing.splitParagraph(textPosition(s.title, 0));
      assert.equal(root.children.length, 2);
      assert.equal(shape(root.children[1]), "S[s]");
      assert.equal(root.children[1].paper, doc.paper);
      assert.equal(root.children[1].title, s.title);
      editing.deleteBackward(at);
      assert.equal(root.children.length, 1);
      assert.equal(shape(doc), "D[d, S[s]]");
    });

    it("keeps a title with text, on Backspace at its start after a paragraph, as a paragraph before what the section held", function () {
      const s = section("Named", paragraph("in"));
      const { doc, editing } = setUp(paragraph("p"), s);
      const at = editing.deleteBackward(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[p, Named, in]");
      assert.ok(samePosition(at, textPosition(s.title, 0)));
    });

    it("flattens a section merged into the section before it - itself holding its leading paragraphs, the rest after it", function () {
      const s = section("S", paragraph("s1"), paragraph("s2"), section("Sub", paragraph("in")), paragraph("tail"));
      const { doc, editing } = setUp(section("A", paragraph("a")), s);
      editing.deleteBackward(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[A[a, S[s1, s2], Sub[in], tail]]");
    });

    it("splits a section off its parent on Tab anywhere in its title, as Enter at its start - what came after it moved into it", function () {
      const s = section("S", paragraph("s"));
      const outer = section("Outer", paragraph("o"), s, paragraph("after"), section("T"));
      const { doc, editing } = setUp(outer, paragraph("next"));
      const original = shape(doc);
      // Tab in the middle of "S": the caret stays.
      let at = editing.tab(textPosition(s.title, 1));
      assert.equal(shape(doc), "D[Outer[o], S[s, after, T[]], next]");
      assert.ok(samePosition(at, textPosition(s.title, 1)));
      // With Shift: nothing.
      editing.tab(textPosition(s.title, 0), { shift: true });
      assert.equal(shape(doc), "D[Outer[o], S[s, after, T[]], next]");
      at = textPosition(s.title, 0);
      // Backspace: back into Outer - but "after", a paragraph, now one of
      // S's own leading paragraphs, stays in S. Only what came after from a
      // section on goes back out.
      editing.deleteBackward(at);
      assert.equal(shape(doc), "D[Outer[o, S[s, after], T[]], next]");
      assert.notEqual(shape(doc), original);
    });

    it("promotes a paragraph on Tab anywhere in it - its title, the section holding the paragraphs after it up to the next section", function () {
      const x = paragraph("Heading");
      const { doc, editing } = setUp(paragraph("p"), x, paragraph("y"), section("S"), paragraph("z"));
      const at = editing.tab(textPosition(x, 3));
      assert.equal(shape(doc), "D[p, Heading[y], S[], z]");
      assert.equal(doc.children[1].title, x);
      assert.ok(samePosition(at, textPosition(x, 3)));
      // Backspace at the start of its title: a paragraph again.
      editing.deleteBackward(textPosition(x, 0));
      assert.equal(shape(doc), "D[p, Heading, y, S[], z]");
    });

    it("makes a section right in a document a document of its own on Tab", function () {
      const s = section("S", paragraph("s"));
      const { root, editing } = setUp(paragraph("d"), s, paragraph("after"));
      editing.tab(textPosition(s.title, 0));
      assert.equal(root.children.length, 2);
      assert.equal(shape(root.children[0]), "D[d]");
      assert.equal(shape(root.children[1]), "S[s, after]");
    });

    it("merges a section on Backspace at its pre marker, as at its title's start", function () {
      const s = section("S", paragraph("s"));
      const { doc, editing } = setUp(section("A", paragraph("a")), s);
      editing.deleteBackward(flowStart(s));
      assert.equal(shape(doc), "D[A[a, S[s]]]");
    });
  });

  it("joins a section's first paragraph into its title, and back - the title as the paragraph before it", function () {
    const s = section("Ti", paragraph("tle"), paragraph("p"));
    const { editing } = setUp(s);
    // Backspace at the start of the first paragraph: into the title.
    assert.ok(samePosition(editing.deleteBackward(textPosition(s.children[0], 0)), textPosition(s.title, 2)));
    assert.equal(shape(s), "Title[p]");
    // Delete at the title's end: the first paragraph into it.
    editing.deleteForward(textPosition(s.title, 5));
    assert.equal(shape(s), "Titlep[]");
  });

  it("leaves the caret where the layout, laid out again, has a place for it", function () {
    const measurer = { measure: (text) => text.length * 1000, metrics: () => ({ ascent: 4000, descent: 1000 }) };
    const p = paragraph("p");
    const { root, editing } = setUp(section("A", p), section("B", paragraph("b")));
    const sequence = new PaperSequence();
    new SequenceLayout({ sequence: root, measurer }).renderOnto(sequence);
    const placed = (at) => !!rowAt(caretRows(sequence, root), at);
    let at = editing.splitParagraph(textPosition(p, 1));
    assert.ok(placed(at));
    at = editing.splitParagraph(at);
    assert.ok(placed(at));
    at = editing.splitParagraph(at);
    assert.ok(placed(at));
    assert.ok(placed(editing.deleteBackward(at)));
  });

  it("leaves everything as it is anywhere else - Delete at a post marker, Enter at a pre marker", function () {
    const p = paragraph("p");
    const { doc, editing } = setUp(p, paragraph("q"));
    assert.ok(samePosition(editing.deleteForward(flowEnd(p)), flowEnd(p)));
    assert.ok(samePosition(editing.splitParagraph(flowStart(p)), flowStart(p)));
    assert.equal(shape(doc), "D[p, q]");
    assert.ok(isSection(doc));
  });
});
