import assert from "assert";
import {
  document, section, paragraph, bold, sequence as sequenceOf, paragraphText, isSection, isParagraph,
  textPosition, flowEnd, flowStart, samePosition, hasExitTitle,
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

// Every flow in a section, depth first.
function* walk(flow) {
  yield flow;
  if (isSection(flow)) for (const child of flow.children) yield* walk(child);
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
      // Enter on it: a section after it - the empty line left behind -
      // holding "x" - up to Y. Going down: at Y's level, but depressed - a
      // level further down.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[Outer[p, _, +1[x], Y[], z]]");
      const made = outer.children[2];
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // Enter at its title's start: across - at its own level, as Y.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[Outer[p, _, [x], Y[], z]]");
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // Enter again: out - split off Outer, what came after it in Outer
      // moved into it.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[Outer[p, _], [x, Y[], z]]");
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // Backspace, each a rung down - every Enter undone: back into Outer,
      // flattened - as it was before the split...
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[Outer[p, _, [x], Y[], z]]");
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // ...depressed again, before Y...
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[Outer[p, _, +1[x], Y[], z]]");
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // ...unwrapped - its empty title gone, all it held after the empty
      // line, the caret on it, as the first Enter left it...
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[Outer[p, _, x, Y[], z]]");
      assert.ok(samePosition(at, textPosition(outer.children[1], 0)));
      // ...and the line gone. Back where it started.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), original);
      assert.ok(samePosition(at, textPosition(p, 1)));
    });

    it("promotes a paragraph to a section's title on Enter at its start twice - the empty one the first Enter left gone; Backspace makes it a paragraph again", function () {
      const x = paragraph("Heading");
      const { doc, editing } = setUp(paragraph("p"), x, paragraph("y"), section("S"));
      // Enter at the start of "Heading": an empty paragraph before it.
      let at = editing.splitParagraph(textPosition(x, 0));
      assert.equal(shape(doc), "D[p, _, Heading, y, S[]]");
      // Enter again, the empty one before it: a section, "Heading" its title,
      // holding "y" - up to S; going down: depressed, before S. The empty
      // line left behind.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[p, _, Heading+1[y], S[]]");
      const made = doc.children[2];
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      // Backspace at the start of its title: a paragraph again - an empty
      // line before it, the caret at its start: as the first Enter left it.
      // Backspace there: as it was.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[p, _, Heading, y, S[]]");
      assert.ok(samePosition(at, textPosition(made.title, 0)));
      editing.deleteBackward(at);
      assert.equal(shape(doc), "D[p, Heading, y, S[]]");
    });

    it("leaves no section empty on a split - and still undoes it exactly: Enter, Enter on a section's only, empty paragraph, then Backspace, Backspace", function () {
      const s = section("S", paragraph());
      const { doc, editing } = setUp(s, paragraph("after"));
      const original = shape(doc);
      // Enter on the empty paragraph: a section in its place - going down,
      // depressed first.
      let at = editing.splitParagraph(textPosition(s.children[0], 0));
      assert.equal(shape(doc), "D[S[_, +1[_]], after]");
      // Enter at its title: at its own level.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[_, [_]], after]");
      // Enter again: split off S - S left with its empty line.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[_], [_], after]");
      // Backspace: back in S - after the line, not in place of it: a line
      // made, not a placeholder.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[S[_, [_]], after]");
      // Backspace: depressed again.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[S[_, +1[_]], after]");
      // Backspace: unwrapped.
      editing.deleteBackward(at);
      assert.equal(shape(doc), original);
    });

    it("climbs a ladder with Enter after a paragraph, going down first: a paragraph, a section depressed, at its own level a level down, across, out - and no further than the document's top", function () {
      let refusals = 0;
      const p = paragraph("p");
      const s = section("S", p);
      const doc = document({ title: "D", paper, margins }, s);
      const root = sequenceOf(doc);
      const editing = tabulaEditing(root, { newSectionsBeside: () => false, refuse: () => { refusals++; } });
      // A paragraph.
      let at = editing.splitParagraph(textPosition(p, 1));
      assert.equal(shape(doc), "D[S[p, _]]");
      // Down: a section in S, depressed - a level further down than its own.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[p, _, +1[_]]]");
      // Its own level, in S.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[p, _, [_]]]");
      // Across: beside S - S split, its empty line left in S.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[p, _], [_]]");
      // Out: no further - right in the document, on top: refused, nothing done.
      const before = shape(doc);
      const stayed = editing.splitParagraph(at);
      assert.equal(shape(doc), before);
      assert.equal(refusals, 1);
      assert.ok(samePosition(stayed, at));
      assert.equal(root.children.length, 1, "one document - one title on top");
    });

    it("undoes every Enter after a paragraph with a Backspace, rung by rung, back to where it started - going down or beside, wherever the paragraph is", function () {
      // Each: a document with the paragraph "p" somewhere in it.
      const structures = {
        "in a section, nothing after it": () => [section("S", paragraph("p"))],
        "before a section in its section": () => [section("S", paragraph("p"), section("X"))],
        "before a depressed section": () => [section("S", paragraph("p"), section({ title: "X", titleOffset: 1 }))],
        "in a section with one after it": () => [section("S", paragraph("p")), section("T")],
        "two levels down": () => [section("O", section("S", paragraph("p")), section("T"))],
        "right in the document, before a section": () => [paragraph("p"), section("T")],
      };
      for (const [beside, depressed] of [[false, true], [true, true], [false, false], [true, false]]) {
        for (const [name, children] of Object.entries(structures)) {
          const doc = document({ title: "D", paper, margins }, ...children());
          const root = sequenceOf(doc);
          const editing = tabulaEditing(root, { newSectionsBeside: () => beside, depressedTitles: () => depressed });
          const p = [...walk(doc)].find((flow) => isParagraph(flow) && paragraphText(flow) === "p");
          const shapes = [shape(doc)];
          // Enter until refused - nothing changing - or ten times.
          let at = textPosition(p, 1);
          for (let n = 0; n < 10; n++) {
            at = editing.splitParagraph(at);
            if (shape(doc) === shapes[shapes.length - 1]) break;
            shapes.push(shape(doc));
          }
          assert.ok(shapes.length >= 3, name + ": a paragraph, and a section");
          // Backspace, back down every rung, each to the shape before it -
          // but for the section the empty paragraph became: unwrapped, it
          // takes the empty paragraph with it when it holds what came after
          // it, so it may go straight back to the start.
          let index = shapes.length - 1;
          while (index > 0) {
            at = editing.deleteBackward(at);
            const now = shape(doc);
            const label = (beside ? "beside" : "going down") + (depressed ? "" : ", none depressed") + ", " + name + ": from " + shapes[index];
            if (index === 2 && now === shapes[0]) break;
            assert.equal(now, shapes[index - 1], label);
            index--;
          }
          assert.equal(shape(doc), shapes[0]);
        }
      }
    });

    it("takes the empty line a section left behind away once the caret moves on - and collapsing the section makes it again", function () {
      const p = paragraph("p");
      const doc = document({ title: "D", paper, margins }, p, section("T"));
      const editing = tabulaEditing(sequenceOf(doc), { newSectionsBeside: () => false, depressedTitles: () => false });
      // Enter, Enter: a section, the empty line left behind.
      let at = editing.splitParagraph(editing.splitParagraph(textPosition(p, 1)));
      assert.equal(shape(doc), "D[p, _, [_], T[]]");
      // Typing its title: an edit - the line still there.
      at = editing.insertText(at, "New");
      assert.equal(shape(doc), "D[p, _, New[_], T[]]");
      // The caret moves on: the line goes.
      editing.settle(textPosition(p, 0));
      assert.equal(shape(doc), "D[p, New[_], T[]]");
      // Backspace at the title's start: a paragraph again - the empty line
      // made again before it, the caret at its start.
      const made = doc.children[1];
      at = editing.deleteBackward(textPosition(made.title, 0));
      assert.equal(shape(doc), "D[p, _, New, T[]]");
      assert.ok(samePosition(at, textPosition(made.title, 0)));

      // An untitled one: its own empty paragraph the line again, the caret on it.
      const q = paragraph("q");
      const other = document({ title: "D", paper, margins }, q);
      const editOther = tabulaEditing(sequenceOf(other), { newSectionsBeside: () => false, depressedTitles: () => false });
      at = editOther.splitParagraph(editOther.splitParagraph(textPosition(q, 1)));
      editOther.settle(textPosition(q, 0));
      assert.equal(shape(other), "D[q, [_]]");
      at = editOther.deleteBackward(at);
      assert.equal(shape(other), "D[q, _]");
      assert.ok(samePosition(at, textPosition(other.children[1], 0)));

      // A line the caret moves onto - or typed into - stays.
      const r = paragraph("r");
      const third = document({ title: "D", paper, margins }, r);
      const editThird = tabulaEditing(sequenceOf(third), { newSectionsBeside: () => false, depressedTitles: () => false });
      editThird.splitParagraph(editThird.splitParagraph(textPosition(r, 1)));
      editThird.settle(textPosition(third.children[1], 0));
      assert.equal(shape(third), "D[r, _, [_]]");
      editThird.settle(textPosition(r, 0));
      assert.equal(shape(third), "D[r, _, [_]]", "remembered only until the caret first moves on");
    });

    it("keeps the empty paragraph of a section a section is merged into - but for the one a split put there, taken out again", function () {
      const p = paragraph("p");
      const doc = document({ title: "D", paper, margins }, p);
      const editing = tabulaEditing(sequenceOf(doc), { newSectionsBeside: () => false, depressedTitles: () => false });
      // Two sections, A and B, side by side - each holding only its
      // placeholder: A made on the empty line after p; B in A, on A's
      // placeholder, then split off A - A's placeholder left behind.
      let at = editing.splitParagraph(editing.splitParagraph(textPosition(p, 1)));
      assert.equal(shape(doc), "D[p, _, [_]]");
      const a = doc.children[2];
      at = editing.splitParagraph(textPosition(a.children[0], 0));
      assert.equal(shape(doc), "D[p, _, [_, [_]]]");
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[p, _, [_], [_]]");
      // Backspace at B's title: into A - after A's placeholder, kept.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[p, _, [_, [_]]]");
      // A split that leaves the section empty puts a placeholder in it - and
      // merging back takes that one out again.
      const first = section("First", paragraph("f"));
      const outer = section("Outer", first);
      const { doc: other, editing: editOther } = setUp(outer);
      const back = editOther.splitParagraph(textPosition(first.title, 0));
      assert.equal(shape(other), "D[Outer[_], First[f]]");
      editOther.deleteBackward(back);
      assert.equal(shape(other), "D[Outer[First[f]]]");
    });

    it("splits a section off at its own level, never depressed - the section it came out of left without an exit title - and Backspace merges it back", function () {
      const blank = paragraph();
      const s = section("S", paragraph("p"), blank);
      const { doc, editing } = setUp(s, section("T"));
      // Enter on the blank paragraph: going down, a section in S -
      // depressed, then at its own level.
      let at = editing.splitParagraph(textPosition(blank, 0));
      assert.equal(shape(doc), "D[S[p, _, +1[_]], T[]]");
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[p, _, [_]], T[]]");
      // Enter: across - beside S, before T, at its own level.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[p, _], [_], T[]]");
      assert.ok(!hasExitTitle(s, doc.children[1], 1), "S ends as a section does - nothing after it looks deeper");
      // Backspace: back into S, as it came - not depressed first; then down
      // its rungs in S - depressed, unwrapped.
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[S[p, _, [_]], T[]]");
      at = editing.deleteBackward(at);
      assert.equal(shape(doc), "D[S[p, _, +1[_]], T[]]");
      editing.deleteBackward(at);
      assert.equal(shape(doc), "D[S[p, _], T[]]");
    });

    it("never depresses a title without depressed titles - going down: a section a level down, or at the level of what's after it; Backspace back the same way", function () {
      const p = paragraph("p");
      const q = paragraph("q");
      const doc = document({ title: "D", paper, margins }, section("S", p), section("T", q, section("X")));
      const editing = tabulaEditing(sequenceOf(doc), { newSectionsBeside: () => false, depressedTitles: () => false });
      // Nothing after it: a section in S, at its own level at once.
      let at = editing.splitParagraph(editing.splitParagraph(textPosition(p, 1)));
      assert.equal(shape(doc), "D[S[p, _, [_]], T[q, X[]]]");
      editing.deleteBackward(editing.deleteBackward(at));
      // Before X: one of X's level, as X.
      at = editing.splitParagraph(editing.splitParagraph(textPosition(q, 1)));
      assert.equal(shape(doc), "D[S[p], T[q, _, [_], X[]]]");
      // Backspace: not depressed - unwrapped, the blank paragraph back.
      editing.deleteBackward(at);
      assert.equal(shape(doc), "D[S[p], T[q, _, X[]]]");
    });

    it("goes down before a depressed section as far as it is depressed - Enter setting it at its own level", function () {
      const p = paragraph("p");
      const deep = section({ title: "Deep", titleOffset: 1 }, paragraph("d"));
      const { doc, editing } = setUp(section("S", p, deep));
      let at = editing.splitParagraph(editing.splitParagraph(textPosition(p, 1)));
      assert.equal(shape(doc), "D[S[p, _, +1[_], Deep+1[d]]]");
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[S[p, _, [_], Deep+1[d]]]");
    });

    it("skips going down with newSectionsBeside: a section beside what's after it - or, with nothing after it, beside the section it's in; not right in a document", function () {
      const editingOf = (doc) => tabulaEditing(sequenceOf(doc), { newSectionsBeside: () => true });
      // Before Y: one of Y's level, as it looks.
      const p = paragraph("p");
      const outer = section("Outer", p, paragraph("x"), section("Y"));
      const doc = document({ title: "D", paper, margins }, outer, paragraph("top"));
      const editing = editingOf(doc);
      let at = editing.splitParagraph(editing.splitParagraph(textPosition(p, 1)));
      assert.equal(shape(doc), "D[Outer[p, _, [x], Y[]], top]");
      assert.ok(samePosition(at, textPosition(outer.children[2].title, 0)));
      // Enter: out - Outer split, what came after it taken along.
      at = editing.splitParagraph(at);
      assert.equal(shape(doc), "D[Outer[p, _], [x, Y[]], top]");
      // Backspace, Backspace, Backspace - one for each Enter: as it was.
      editing.deleteBackward(editing.deleteBackward(editing.deleteBackward(at)));
      assert.equal(shape(doc), "D[Outer[p, x, Y[]], top]");
      // With nothing after it: beside the section it's in.
      const q = paragraph("q");
      const lone = section("Lone", q);
      const other = document({ title: "D", paper, margins }, lone);
      const besides = editingOf(other);
      besides.splitParagraph(besides.splitParagraph(textPosition(q, 1)));
      assert.equal(shape(other), "D[Lone[q, _], [_]]");
      // Right in the document: stays in - a document has one title on top.
      const top = paragraph("top");
      const third = document({ title: "D", paper, margins }, top);
      const inDocument = editingOf(third);
      inDocument.splitParagraph(inDocument.splitParagraph(textPosition(top, 3)));
      assert.equal(shape(third), "D[top, _, [_]]");
    });

    it("undoes the Enters that made a section with as many Backspaces", function () {
      const p = paragraph("p");
      const { doc, editing } = setUp(p, paragraph("x"), section("Y"));
      const original = shape(doc);
      const at = editing.splitParagraph(editing.splitParagraph(textPosition(p, 1)));
      assert.equal(shape(doc), "D[p, _, +1[x], Y[]]");
      editing.deleteBackward(editing.deleteBackward(at));
      assert.equal(shape(doc), original);
    });

    it("makes a section holding an empty paragraph, on Enter on the last, empty paragraph", function () {
      const { doc, editing } = setUp(paragraph("p"), paragraph());
      editing.splitParagraph(textPosition(doc.children[1], 0));
      assert.equal(shape(doc), "D[p, _, +1[_]]");
    });

    it("splits a section off on Enter at its title's start even with text in the title - what came after it moved into it", function () {
      const s = section("S", paragraph("s"));
      const outer = section("Outer", paragraph("o"), s, section("T"));
      const { doc, editing } = setUp(outer);
      editing.splitParagraph(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[Outer[o], S[s, T[]]]");
    });

    it("keeps one title on top: Enter at the start of a title right in a document, or at a document's end, is refused - a depressed one set at its level first", function () {
      let refusals = 0;
      const s = section({ title: "S", titleOffset: 1 }, paragraph("s"));
      const doc = document({ title: "D", paper, margins }, paragraph("d"), s);
      const root = sequenceOf(doc);
      const editing = tabulaEditing(root, { refuse: () => { refusals++; } });
      // Depressed: set at its own level - a rung up.
      editing.splitParagraph(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[d, S[s]]");
      assert.equal(refusals, 0);
      // At its own level, right in the document: refused.
      editing.splitParagraph(textPosition(s.title, 0));
      editing.splitParagraph(flowStart(s));
      editing.splitParagraph(textPosition(doc.title, 0));
      editing.splitParagraph(flowEnd(doc));
      assert.equal(shape(doc), "D[d, S[s]]");
      assert.equal(root.children.length, 1);
      assert.equal(refusals, 4);
    });

    it("keeps a title with text, on Backspace at its start after a paragraph, as a paragraph before what the section held", function () {
      const s = section("Named", paragraph("in"));
      const { doc, editing } = setUp(paragraph("p"), s);
      // Going down (see setUp()): a rung down first - depressed - then a
      // paragraph.
      editing.deleteBackward(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[p, Named+1[in]]");
      // Its title a paragraph, an empty line before it - the caret at its
      // start.
      const at = editing.deleteBackward(textPosition(s.title, 0));
      assert.equal(shape(doc), "D[p, _, Named, in]");
      assert.ok(samePosition(at, textPosition(s.title, 0)));
      // An empty line there already: no second one.
      const t = section("Again", paragraph("a"));
      const { doc: other, editing: editOther } = setUp(paragraph("p"), paragraph(), t);
      editOther.deleteBackward(textPosition(t.title, 0));
      editOther.deleteBackward(textPosition(t.title, 0));
      assert.equal(shape(other), "D[p, _, Again, a]");
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
      // Backspace at the start of its title, going down (see setUp()): a
      // rung down - depressed, before S - and then a paragraph again.
      editing.deleteBackward(textPosition(x, 0));
      assert.equal(shape(doc), "D[p, Heading+1[y], S[], z]");
      editing.deleteBackward(textPosition(x, 0));
      assert.equal(shape(doc), "D[p, _, Heading, y, S[], z]");
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
      assert.ok(!editing.canPromote(a), "right in the document: one title on top");
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

    it("refuses Shift+Tab in the title of a section right in a document - one title on top", function () {
      let refusals = 0;
      const s = section("S", paragraph("s"));
      const doc = document({ title: "D", paper, margins }, paragraph("d"), s, paragraph("after"));
      const root = sequenceOf(doc);
      const editing = tabulaEditing(root, { refuse: () => { refusals++; } });
      editing.tab(textPosition(s.title, 0), { shift: true });
      assert.equal(root.children.length, 1);
      assert.equal(shape(doc), "D[d, S[s], after]");
      assert.equal(refusals, 1);
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
