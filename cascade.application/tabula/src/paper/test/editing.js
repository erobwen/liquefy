import assert from "assert";
import {
  document, section, paragraph, bold, sequence as sequenceOf, paragraphText, isSection, isParagraph,
  textPosition, flowEnd, flowStart, samePosition,
} from "../../model/flows.js";
import { tabulaEditing } from "../editing.js";
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

// Sections made from a blank paragraph kept in their parent - so each rule
// shows on its own; splitting them off right away, the default, has a test
// of its own.
function setUp(...children) {
  const doc = document({ title: "D", paper, margins }, ...children);
  const root = sequenceOf(doc);
  return { doc, root, editing: tabulaEditing(root, { newSectionsBeside: () => false }) };
}

describe("Editing a Tabula document", function () {
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

    it("splits a section made from a blank paragraph off its parent right away, with newSectionsBeside - not right in a document", function () {
      let beside = true;
      const p = paragraph("p");
      const outer = section("Outer", p, paragraph("x"), section("Y"));
      const doc = document({ title: "D", paper, margins }, outer, paragraph("top"));
      const editing = tabulaEditing(sequenceOf(doc), { newSectionsBeside: () => beside });
      // Enter, Enter at the end of "p": a section - beside Outer.
      let at = editing.splitParagraph(editing.splitParagraph(textPosition(p, 1)));
      assert.equal(shape(doc), "D[Outer[p], [x, Y[]], top]");
      assert.ok(samePosition(at, textPosition(doc.children[1].title, 0)));
      // Backspace: back into Outer; again: unwrapped - as it was.
      editing.deleteBackward(editing.deleteBackward(at));
      assert.equal(shape(doc), "D[Outer[p, x, Y[]], top]");
      // Near a blank one - Enter twice at a paragraph's start: the same.
      at = editing.splitParagraph(editing.splitParagraph(textPosition(outer.children[1], 0)));
      assert.equal(shape(doc), "D[Outer[p], x[Y[]], top]");
      // Backspace, Backspace: as it was.
      editing.deleteBackward(editing.deleteBackward(at));
      assert.equal(shape(doc), "D[Outer[p, x, Y[]], top]");
      editing.splitParagraph(editing.splitParagraph(textPosition(outer.children[1], 0)));
      // Right in the document: stays in.
      const top = doc.children[2];
      editing.splitParagraph(editing.splitParagraph(textPosition(top, 0)));
      assert.equal(shape(doc), "D[Outer[p], x[Y[]], top[_]]");
      // Off: in its parent, as ever.
      beside = false;
      editing.splitParagraph(editing.splitParagraph(textPosition(outer.children[0], 1)));
      assert.equal(shape(doc), "D[Outer[p, [_]], x[Y[]], top[_]]");
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

    it("splits a section off its parent on Shift+Tab anywhere in its title, as Enter at its start - what came after it moved into it", function () {
      const s = section("S", paragraph("s"));
      const outer = section("Outer", paragraph("o"), s, paragraph("after"), section("T"));
      const { doc, editing } = setUp(outer, paragraph("next"));
      const original = shape(doc);
      // Shift+Tab in the middle of "S": the caret stays.
      let at = editing.tab(textPosition(s.title, 1), { shift: true });
      assert.equal(shape(doc), "D[Outer[o], S[s, after, T[]], next]");
      assert.ok(samePosition(at, textPosition(s.title, 1)));
      // Backspace: back into Outer - but "after", a paragraph, now one of
      // S's own leading paragraphs, stays in S. Only what came after from a
      // section on goes back out.
      editing.deleteBackward(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[Outer[o, S[s, after], T[]], next]");
      assert.notEqual(shape(doc), original);
    });

    it("promotes a paragraph on Shift+Tab anywhere in it - its title, the section holding the paragraphs after it up to the next section", function () {
      const x = paragraph("Heading");
      const { doc, editing } = setUp(paragraph("p"), x, paragraph("y"), section("S"), paragraph("z"));
      // Tab, without Shift, in a paragraph: nothing.
      editing.tab(textPosition(x, 3));
      assert.equal(shape(doc), "D[p, Heading, y, S[], z]");
      const at = editing.tab(textPosition(x, 3), { shift: true });
      assert.equal(shape(doc), "D[p, Heading[y], S[], z]");
      assert.equal(doc.children[1].title, x);
      assert.ok(samePosition(at, textPosition(x, 3)));
      // Backspace at the start of its title: a paragraph again.
      editing.deleteBackward(textPosition(x, 0));
      assert.equal(shape(doc), "D[p, Heading, y, S[], z]");
    });

    it("only moves the caret on Tab when what's next is empty - its placeholder waiting - not demoting", function () {
      const s = section("S", paragraph());
      const { doc, editing } = setUp(section("A", paragraph("a")), s);
      const original = shape(doc);
      const at = editing.tab(textPosition(s.title, 1));
      assert.ok(samePosition(at, textPosition(s.children[0], 0)));
      assert.equal(shape(doc), original);
      // An empty title, an empty text after it: there too.
      const blank = section("", paragraph());
      const { editing: other } = setUp(blank);
      assert.ok(samePosition(other.tab(textPosition(blank.title, 0)), textPosition(blank.children[0], 0)));
    });

    it("demotes a section on Tab anywhere in its title - into the section before it, Shift+Tab undone exactly", function () {
      const s = section("S", paragraph("s"));
      const outer = section("Outer", paragraph("o"), s, section("T"), paragraph("t"));
      const { doc, editing } = setUp(outer, paragraph("next"));
      const original = shape(doc);
      editing.tab(textPosition(s.title, 1), { shift: true });
      assert.equal(shape(doc), "D[Outer[o], S[s, T[], t], next]");
      const at = editing.tab(textPosition(s.title, 1));
      assert.equal(shape(doc), original);
      assert.ok(samePosition(at, textPosition(s.title, 1)));
    });

    it("makes a section that can go no further down paragraphs on Tab - its title one, unless empty; a lone empty one gone", function () {
      const both = section("Both", paragraph("text"));
      const onlyTitle = section("Only title", paragraph());
      const onlyText = section("", paragraph("only text"));
      const neither = section("", paragraph());
      const { doc, editing } = setUp(paragraph("p"), both, paragraph("q"), onlyTitle, paragraph("r"), onlyText, paragraph("s"), neither);
      let at = editing.tab(textPosition(both.title, 2));
      assert.ok(samePosition(at, textPosition(both.title, 2)));
      // An empty paragraph next: Tab would only move there - the panel's
      // demote, then.
      editing.demoteSection(onlyTitle);
      at = editing.tab(textPosition(onlyText.title, 0));
      assert.ok(samePosition(at, textPosition(doc.children[6], 0)));
      editing.demoteSection(neither);
      assert.equal(shape(doc), "D[p, Both, text, q, Only title, r, only text, s, _]");
    });

    it("undoes Shift+Tab in a paragraph with Tab in its title", function () {
      const x = paragraph("Heading");
      const { doc, editing } = setUp(paragraph("p"), x, paragraph("y"), section("S"));
      const original = shape(doc);
      editing.tab(textPosition(x, 3), { shift: true });
      assert.equal(shape(doc), "D[p, Heading[y], S[]]");
      editing.tab(textPosition(x, 3));
      assert.equal(shape(doc), original);
    });

    it("leaves a document first of all as it is on Tab", function () {
      const { doc, root, editing } = setUp(paragraph("p"));
      assert.ok(!editing.canDemote(doc));
      editing.tab(textPosition(doc.title, 0));
      assert.equal(root.children.length, 1);
      assert.equal(shape(doc), "D[p]");
    });

    it("demotes a section whole, its sub-sections in it, with demoteWithChildren - flattened, by default", function () {
      let whole = true;
      const s = section("S", paragraph("s"), section("Sub", paragraph("in")), paragraph("tail"));
      const doc = document({ title: "D", paper, margins }, section("A", paragraph("a")), s);
      const editing = tabulaEditing(sequenceOf(doc), { newSectionsBeside: () => false, demoteWithChildren: () => whole });
      editing.tab(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[A[a, S[s, Sub[in], tail]]]");
      // Off: flattened.
      editing.tab(textPosition(s.title, 0), { shift: true });
      whole = false;
      editing.tab(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[A[a, S[s], Sub[in], tail]]");
    });

    it("tells whether demoting moves a section into a section - not, with none before it, making it paragraphs", function () {
      const first = section("First", paragraph("f"));
      const second = section("Second", paragraph("s"));
      const afterParagraph = section("After", paragraph("a"));
      const { editing } = setUp(first, second, paragraph("p"), afterParagraph);
      assert.ok(editing.canDemoteIntoSection(second));
      assert.ok(!editing.canDemoteIntoSection(first));
      assert.ok(!editing.canDemoteIntoSection(afterParagraph));
      assert.ok(editing.canDemote(afterParagraph));
    });

    it("promotes and demotes a section from outside the text - for a panel's buttons", function () {
      const inner = section("Inner", paragraph("i"));
      const a = section("A", paragraph("a"), inner);
      const { doc, editing } = setUp(a);
      assert.ok(editing.canPromote(inner));
      assert.ok(editing.canPromote(a));   // into a document of its own
      assert.ok(editing.promoteSection(inner));
      assert.equal(shape(doc), "D[A[a], Inner[i]]");
      assert.ok(editing.canDemote(inner));
      assert.ok(editing.demoteSection(inner));
      assert.equal(shape(doc), "D[A[a, Inner[i]]]");
    });

    it("makes a paragraph a title from outside the text - as Shift+Tab in it", function () {
      const x = paragraph("Heading");
      const { doc, editing } = setUp(paragraph("p"), x, paragraph("y"));
      assert.ok(editing.promoteParagraph(x));
      assert.equal(shape(doc), "D[p, Heading[y]]");
      assert.ok(!editing.promoteParagraph(doc.title));
    });

    it("makes a leaf section paragraphs again from outside the text - not one with sections in it", function () {
      const leaf = section("Leaf", paragraph("l"));
      const parent = section("Parent", section("Inner", paragraph("i")));
      const { doc, editing } = setUp(section("A", paragraph("a")), leaf, parent);
      assert.ok(editing.canMakeParagraphs(leaf));
      assert.ok(!editing.canMakeParagraphs(parent));
      assert.ok(!editing.canMakeParagraphs(doc));
      assert.ok(editing.makeParagraphs(leaf));
      assert.equal(shape(doc), "D[A[a], Leaf, l, Parent[Inner[i]]]");
    });

    it("moves a paragraph out of its section - it and all after it, after the section; the section left empty given an empty paragraph", function () {
      const p = paragraph("p");
      const inner = section("Inner", paragraph("i"), p, section("Sub"), paragraph("q"));
      const { doc, editing } = setUp(section("Outer", inner, paragraph("o")));
      assert.ok(editing.moveOut(p));
      assert.equal(shape(doc), "D[Outer[Inner[i], p, Sub[], q, o]]");
      const first = paragraph("first");
      const lone = section("Lone", first);
      const { doc: other, editing: editOther } = setUp(section("Outer", lone));
      editOther.moveOut(first);
      assert.equal(shape(other), "D[Outer[Lone[_], first]]");
      // Right in a document: nowhere to go.
      const top = paragraph("top");
      const { editing: atTop } = setUp(top);
      assert.ok(!atTop.canMoveOut(top));
    });

    it("makes a section right in a document a document of its own on Shift+Tab", function () {
      const s = section("S", paragraph("s"));
      const { root, editing } = setUp(paragraph("d"), s, paragraph("after"));
      editing.tab(textPosition(s.title, 0), { shift: true });
      assert.equal(root.children.length, 2);
      assert.equal(shape(root.children[0]), "D[d]");
      assert.equal(shape(root.children[1]), "S[s, after]");
    });

    it("acts at a section's pre marker as at its title's start - Enter splitting it off, typing into the title", function () {
      const s = section("S", paragraph("s"));
      const { doc, editing } = setUp(section("A", paragraph("a"), s));
      editing.insertText(flowStart(s), "X");
      assert.equal(paragraphText(s.title), "XS");
      const at = editing.splitParagraph(flowStart(s));
      assert.equal(shape(doc), "D[A[a], XS[s]]");
      assert.ok(samePosition(at, flowStart(s)));
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
