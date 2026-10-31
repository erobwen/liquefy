import assert from "assert";
import { repeat, retractRepeater, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { PaperSequence, monospaceMeasurer, paperSizes, margins, mm } from "../../print/index.js";
import { document, section, paragraph, sequence as sequenceOf, paragraphText, isSection, textPosition, flowStart } from "../../model/flows.js";
import { InnerSequence, isFresh, anchoredSequences, dotPosition, isDot } from "../../model/sequences.js";
import { caretRows } from "../markers.js";
import { stepRight, stepLeft } from "../positions.js";
import { PageLayout } from "../../model/pageLayout.js";
import { rootPageLayout } from "../../model/pageLayout.js";
import { tabulaEditing } from "../editing.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { structuredTextPlugin, structuredText } from "../../plugins/structuredText/index.js";
import { framesPlugin, image } from "../../plugins/frames/index.js";
import { hydrateDocument, dehydrateDocument, HydratedDocument, createDocument, hydrateFile, dehydrateFile } from "../../shell/documents.js";

const paper = paperSizes.A4;

function setUp(children) {
  const doc = document({ title: "Book", paper, margins: margins(mm(25)) }, ...children);
  let refusals = 0;
  const editing = tabulaEditing(sequenceOf(doc), { refuse: () => { refusals++; } });
  return { doc, editing, refusals: () => refusals };
}

// Where its pages of their own are anchored: "flow:side" - a paragraph by its
// text, a section by its title, the document "Document".
function anchors(doc) {
  const name = (flow) => flow === doc ? "Document" : isSection(flow) ? paragraphText(flow.title) : paragraphText(flow);
  return anchoredSequences(doc).map(({ flow, side }) => name(flow) + ":" + side);
}

// The document laid out: its papers' text - and where pages of their own
// fall among them, "[]".
function laidOut(doc) {
  const seq = new PaperSequence();
  const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer() }).establish();
  const root = repeat(() => layout.renderOnto(seq), { independent: true });
  try {
    const result = [];
    seq.pages.forEach((format, index) => {
      if (seq.inserts.some((insert) => insert.page === index && insert.before)) result.push("[]");
      const texts = [...new Set(seq.linesOf(index).filter((line) => !line.runs.some((run) => run.placeholder)).map((line) => paragraphText(line.paragraph)))];
      result.push(texts.join(" ") || "·");
      if (seq.inserts.some((insert) => insert.page === index && !insert.before)) result.push("[]");
    });
    return result;
  } finally {
    retractRepeater(root);
    layout.dispose();
  }
}

describe("Pages of their own - inner sequences", function () {
  it("are made with Ctrl+Enter in the text - after its paragraph - and climb out a step with each Ctrl+Enter, back in with Ctrl+Backspace", function () {
    const { doc, editing, refusals } = setUp([section("Chapter", section("Part", paragraph("text")))]);
    const at = textPosition(doc.children[0].children[0].children[0], 2);
    editing.pageBreak(at);
    assert.deepEqual(anchors(doc), ["text:after"]);
    assert.ok(isFresh(doc.children[0].children[0].children[0].after), "a place, nothing chosen");
    editing.pageBreak(at);
    assert.deepEqual(anchors(doc), ["Part:after"]);
    editing.pageBreak(at);
    assert.deepEqual(anchors(doc), ["Chapter:after"]);
    editing.pageBreak(at);
    assert.deepEqual(anchors(doc), ["Document:after"]);
    editing.pageBreak(at);
    assert.equal(refusals(), 1, "no further out");
    // And back in, step by step - and gone.
    editing.unanchor(at);
    editing.unanchor(at);
    editing.unanchor(at);
    assert.deepEqual(anchors(doc), ["text:after"]);
    editing.unanchor(at);
    assert.deepEqual(anchors(doc), []);
    editing.unanchor(at);
    assert.equal(refusals(), 2);
  });

  it("stay where they are once something is chosen in them - Ctrl+Enter makes another, a step out", function () {
    const { doc, editing, refusals } = setUp([section("Chapter", paragraph("text"))]);
    const text = doc.children[0].children[0];
    editing.pageBreak(textPosition(text, 0));
    text.after.items[0] = createDocument(image);
    editing.pageBreak(textPosition(text, 0));
    assert.deepEqual(anchors(doc), ["text:after", "Chapter:after"]);
    editing.unanchor(textPosition(text, 0));
    editing.unanchor(textPosition(text, 0));
    assert.deepEqual(anchors(doc), ["text:after"]);
    assert.equal(refusals(), 1, "what's chosen isn't taken away so");
  });

  it("at a chapter's start: book mode - again, pages before the chapter; Ctrl+Backspace undoes each", function () {
    const { doc, editing } = setUp([section("One", paragraph("one")), section("Two", paragraph("two"))]);
    const two = doc.children[1];
    editing.pageBreak(textPosition(two.title, 0));
    assert.ok(doc.bookMode);
    assert.deepEqual(laidOut(doc), ["Book", "One one", "Two two"]);
    editing.pageBreak(flowStart(two));
    assert.deepEqual(anchors(doc), ["Two:before"]);
    assert.deepEqual(laidOut(doc), ["Book", "One one", "[]", "Two two"]);
    editing.unanchor(textPosition(two.title, 0));
    assert.deepEqual(anchors(doc), []);
    editing.unanchor(textPosition(two.title, 0));
    assert.ok(!doc.bookMode);
    assert.deepEqual(laidOut(doc), ["Book One one Two two"]);
  });

  it("not before the title, at its start - a cover is created before the document, in the file - but after it", function () {
    const { doc, editing } = setUp([paragraph("text")]);
    editing.pageBreak(textPosition(doc.title, 0));
    assert.deepEqual(anchors(doc), ["Book:after"]);
    editing.unanchor(textPosition(doc.title, 0));
    assert.deepEqual(anchors(doc), []);
  });

  it("are laid out after the page their paragraph ends on - a page break, the text after them on a fresh page, unless it runs on - and after a section, the rest on a fresh page", function () {
    const { doc, editing } = setUp([paragraph("before"), paragraph("after"), section("Next", paragraph("next"))]);
    editing.pageBreak(textPosition(doc.children[0], 0));
    assert.equal(doc.children[0].after.items.length, 0, "empty: a page break");
    assert.deepEqual(laidOut(doc), ["Book before", "[]", "after Next next"]);
    doc.children[0].after.runOn = true;
    assert.deepEqual(laidOut(doc), ["Book before after Next next", "[]"]);
    doc.children[0].after = null;
    doc.children[2].before = new InnerSequence();
    assert.deepEqual(laidOut(doc), ["Book before after", "[]", "Next next"]);
  });

  it("stay anchored as their flow's place is taken - a paragraph joined to the one before, a section made on its line, a paragraph split", function () {
    const { doc, editing } = setUp([paragraph("one"), paragraph("two")]);
    editing.pageBreak(textPosition(doc.children[1], 0));
    editing.deleteBackward(textPosition(doc.children[1], 0));
    assert.deepEqual(anchors(doc), ["onetwo:after"]);
    // Split in the middle: after its end - the second half.
    editing.splitParagraph(textPosition(doc.children[0], 3));
    assert.deepEqual(anchors(doc), ["two:after"]);
    // An empty line made a section: after it.
    const empty = setUp([paragraph("a"), paragraph("")]);
    empty.editing.pageBreak(textPosition(empty.doc.children[1], 0));
    empty.editing.splitParagraph(textPosition(empty.doc.children[1], 0));
    assert.ok(isSection(empty.doc.children[1]));
    assert.equal(anchoredSequences(empty.doc).length, 1);
    assert.ok(isSection(anchoredSequences(empty.doc)[0].flow));
  });

  it("are saved where they're anchored - places as null, documents as their kinds save them - book mode too", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin, framesPlugin);
    const { doc, editing } = setUp([section("One", paragraph("text"))]);
    editing.pageBreak(textPosition(doc.title, 0));
    doc.title.after.items[0] = createDocument(image);
    doc.title.after.items.push(null);
    editing.pageBreak(textPosition(doc.children[0].children[0], 4));
    doc.bookMode = true;
    const json = JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, doc))));
    assert.equal(json.properties.bookMode, true);
    assert.deepEqual(json.properties.title.properties.after.properties.items.map((item) => item && item.name), ["image", null]);
    const back = hydrateDocument(json, services).model;
    assert.deepEqual(anchors(back), anchors(doc));
    assert.equal(back.title.after.items[0].documentType, image);
    assert.deepEqual(JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, back)))), json);
  });
});

describe("Pages of their own, at their creation dots", function () {
  it("are made by Ctrl+Enter empty - a page break - the caret to its creation dot", function () {
    const { doc, editing } = setUp([paragraph("text")]);
    const at = editing.pageBreak(textPosition(doc.children[0], 2));
    assert.ok(isDot(at));
    assert.deepEqual([at.flow, at.index], [doc.children[0].after, 0]);
    assert.equal(doc.children[0].after.items.length, 0);
  });

  it("climb with Ctrl+Enter there, whatever is in them - and come back in with Ctrl+Backspace, after what's last in what they were after", function () {
    const { doc, editing, refusals } = setUp([section("Chapter", paragraph("one"), paragraph("two"))]);
    const two = doc.children[0].children[1];
    const at = editing.pageBreak(textPosition(two, 0));
    at.flow.items.push(createDocument(image));
    assert.ok(samePlace(editing.pageBreak(at), at), "the caret stays with them");
    assert.deepEqual(anchors(doc), ["Chapter:after"]);
    editing.pageBreak(at);
    assert.deepEqual(anchors(doc), ["Document:after"]);
    editing.pageBreak(at);
    assert.equal(refusals(), 1, "the document's end: no further, for now");
    editing.unanchor(at);
    assert.deepEqual(anchors(doc), ["Chapter:after"]);
    editing.unanchor(at);
    assert.deepEqual(anchors(doc), ["two:after"]);
    // After a paragraph, with something in them: they stay.
    editing.unanchor(at);
    assert.deepEqual([anchors(doc), refusals()], [["two:after"], 2]);
  });

  it("empty, are taken away by Delete there - the caret back at the end of the paragraph they were after", function () {
    const { doc, editing, refusals } = setUp([paragraph("text")]);
    const at = editing.pageBreak(textPosition(doc.children[0], 0));
    const back = editing.removeBreak(at);
    assert.deepEqual(anchors(doc), []);
    assert.deepEqual([back.paragraph, back.offset], [doc.children[0], 4]);
    const again = editing.pageBreak(textPosition(doc.children[0], 0));
    again.flow.items.push(null);
    editing.removeBreak(again);
    assert.deepEqual([anchors(doc), refusals()], [["text:after"], 1]);
  });

  it("are where the caret goes, in reading order - after the paragraph's end, one before each item and one after the last", function () {
    const { doc, editing } = setUp([paragraph("one"), paragraph("two")]);
    const at = editing.pageBreak(textPosition(doc.children[0], 0));
    const seq = new PaperSequence();
    const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer() }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      const rows = () => caretRows(seq, sequenceOf(doc));
      // Empty: one dot - after "one"'s end, before "two"'s start.
      const after = stepRight(rows(), textPosition(doc.children[0], 3));
      assert.ok(samePlace(stepRight(rows(), after), at), "from the paragraph's end, the dot");
      assert.equal(stepRight(rows(), at).edge, "start", "and on, the next paragraph's start");
      at.flow.items.push(null);
      assert.ok(samePlace(stepRight(rows(), at), dotPosition(at.flow, 1)), "one item: a dot before it, one after");
      assert.ok(samePlace(stepLeft(rows(), dotPosition(at.flow, 1)), at));
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  });
});

const samePlace = (a, b) => a.flow === b.flow && a.edge === b.edge && a.index === b.index;

describe("Pages of their own, printed on both sides", function () {
  // A document printed on both sides, laid out: each paper's side and its
  // last line's x - and, where pages of their own are, theirs, in brackets,
  // or how many: "[n]" (and "+blank" - a blank back after them).
  function sides(doc, { firstSide = null, inner = false } = {}) {
    const seq = new PaperSequence();
    seq.firstSide = firstSide;
    const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer() }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      return papers(seq, inner);
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  }
  function papers(seq, inner) {
    const result = [];
    const insert = (each) => inner
      ? "[" + each.items.map(({ pages }) => pages ? papers(pages, inner).join(" ") : "place").join(" | ") + (each.pad ? " +blank" : "") + "]"
      : "[" + each.pages + (each.pad ? "+blank" : "") + "]";
    seq.pages.forEach((format, index) => {
      for (const each of seq.inserts.filter((one) => one.page === index && one.before)) result.push(insert(each));
      const lines = seq.linesOf(index);
      // Its last line's x - body text, not a centred title.
      result.push(format.side + "@" + (lines.length ? lines[lines.length - 1].x / 1000 : "-"));
      for (const each of seq.inserts.filter((one) => one.page === index && !one.before)) result.push(insert(each));
    });
    return result;
  }

  const book = (...children) => document({ title: "Book", paper, pageLayout: new PageLayout({ margins: { top: mm(20), bottom: mm(20), left: mm(30), right: mm(15) }, duplex: true }) }, ...children);
  const lots = (count) => Array.from({ length: count }, (_, index) => paragraph("Paragraph " + index + " - " + "words ".repeat(40)));

  it("count the papers after them on, past their pages - and leave the paper they come after as it is", function () {
    const doc = book(...lots(60));
    const plain = sides(doc);
    assert.deepEqual(plain.slice(0, 3), ["recto@30", "verso@15", "recto@30"]);
    // Pages of their own after the first paragraph, the text running on:
    // one page - a place.
    doc.children[0].after = new InnerSequence([null], { runOn: true });
    const one = sides(doc);
    assert.deepEqual(one.slice(0, 4), ["recto@30", "[1]", "recto@30", "verso@15"], "the paper after them a right-hand one - after their left-hand page");
    // Two pages: the next a left-hand one again.
    doc.children[0].after.items.push(null);
    assert.deepEqual(sides(doc).slice(0, 4), ["recto@30", "[2]", "verso@15", "recto@30"]);
  });

  it("lay out a document in them with the one they're in - on its paper, its sides going on from there - and count on past its pages", function () {
    const doc = book(...lots(60));
    // A structured text of its own - no page settings of its own.
    const own = structuredText.create();
    own.children.splice(0, 1, ...lots(30));
    doc.children[0].after = new InnerSequence([new HydratedDocument(structuredText, own)]);
    const laidOut = sides(doc, { inner: true });
    // Its pages: the book's paper and margins - its first a left-hand one,
    // after the book's right-hand page - three of them...
    assert.deepEqual(laidOut.slice(0, 2), ["recto@30", "[verso@15 recto@30 verso@15]"]);
    // ... so the book's next a right-hand one.
    assert.deepEqual(laidOut.slice(2, 4), ["recto@30", "verso@15"]);
    // Shorter, two pages: the next a left-hand one.
    own.children.splice(20);
    assert.deepEqual(sides(doc, { inner: true }).slice(0, 4), ["recto@30", "[verso@15 recto@30]", "verso@15", "recto@30"]);
  });

  it("before the title: a blank back after them, where they'd end on a right-hand page - the title's page a right-hand one", function () {
    const doc = book(paragraph("text"));
    doc.before = new InnerSequence([null]);
    assert.deepEqual(sides(doc), ["[1+blank]", "recto@30"]);
    doc.before.items.push(null);
    assert.deepEqual(sides(doc), ["[2]", "recto@30"]);
  });

  it("follow a document in them as it's edited - laid out once, with the one they're in", function () {
    const doc = book(...lots(60));
    const own = structuredText.create();
    own.children.splice(0, 1, ...lots(30));
    doc.children[0].after = new InnerSequence([new HydratedDocument(structuredText, own)]);
    const seq = new PaperSequence();
    const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer() }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      assert.deepEqual(papers(seq, true).slice(0, 3), ["recto@30", "[verso@15 recto@30 verso@15]", "recto@30"]);
      own.children.splice(20);
      assert.deepEqual(papers(seq, true).slice(0, 3), ["recto@30", "[verso@15 recto@30]", "verso@15"]);
      // And the book's margins changed: its pages' too.
      doc.pageLayout.margins = { ...doc.pageLayout.margins, left: mm(40) };
      assert.deepEqual(papers(seq, true).slice(0, 2), ["recto@40", "[verso@15 recto@40]"]);
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  });

  it("are numbered on from the page they follow - and the pages after them on, past them", function () {
    const doc = book(...lots(60));
    const own = structuredText.create();
    own.children.splice(0, 1, ...lots(30));
    doc.children[0].after = new InnerSequence([null, new HydratedDocument(structuredText, own)], { runOn: true });
    doc.before = new InnerSequence([null]);
    const seq = new PaperSequence();
    const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer() }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      // A cover and its blank back: 1 and 2 - the title page 3; then a
      // place, 4, and the document after it, 5 to 7; the book on from 8.
      const numbers = seq.pages.map((format, index) => seq.numberOf(index));
      assert.deepEqual(numbers.slice(0, 3), [3, 8, 9]);
      const after = seq.inserts.find((insert) => !insert.before);
      const own = after.items[1].pages;
      assert.deepEqual([own.numberOf(0), own.numberOf(own.pages.length - 1)], [5, 7]);
      // The last of them all - theirs, too: "of" counts the whole book.
      const last = 7 + seq.pages.length - 1;
      assert.equal(seq.lastNumberOf(0), last);
      assert.equal(own.lastNumberOf(0), last);
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  });

  it("start a document among them on the side their paper sequence starts on - its first page a left-hand one, after a right-hand one", function () {
    const doc = book(...lots(30));
    assert.deepEqual(sides(doc, { firstSide: "verso" }).slice(0, 2), ["verso@15", "recto@30"]);
  });
});

describe("A file's root", function () {
  it("holds its page settings - what it's designed for - its print settings, and what's in it", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin);
    const documents = [new HydratedDocument(structuredText, structuredText.create())];
    const pageLayout = rootPageLayout({ landscape: true, duplex: true });
    const json = JSON.parse(JSON.stringify(dehydrateFile(documents, { duplex: true }, pageLayout)));
    assert.deepEqual([json.type, json.name, json.properties.print], ["root", "tabula", { duplex: true }]);
    // The base: every setting, no content.
    assert.deepEqual(json.properties.pageLayout.properties, { paper: "A4", landscape: true, margins: margins(mm(25)), duplex: true });
    assert.deepEqual(Object.keys(json.properties.items[0].properties.pageLayout.properties), ["first", "middle", "last"], "the document's derived: content, no settings");
    const read = hydrateFile(json, services);
    assert.deepEqual([read.print.duplex, read.pageLayout.landscape, read.documents.length], [true, true, 1]);
  });

  it("read from a file from before it - a document, a list, a sequence saying how it's printed - takes its page settings from its first document", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin, framesPlugin);
    const letter = (title, margin) => document({ title, paper: paperSizes.letter, margins: margins(mm(margin)) }, paragraph("text"));
    const old = [letter("One", 20), letter("Two", 30)].map((each) => JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, each)))));
    const { documents, pageLayout, print } = hydrateFile({ type: "sequence", name: "root", properties: { print: { duplex: true }, items: old } }, services);
    assert.deepEqual([pageLayout.paper, pageLayout.margins.top, print.duplex], [paperSizes.letter, mm(20), true]);
    // The first, none of its own left; the second, only what's apart.
    assert.ok(!documents[0].model.pageLayout.hasSettings());
    assert.deepEqual([documents[1].model.pageLayout.paper, documents[1].model.pageLayout.margins.top], [undefined, mm(30)]);
  });

  it("read from a file from before it, puts a document's cover before it - at the top", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin, framesPlugin);
    const doc = document({ title: "Book", paper }, paragraph("text"));
    doc.before = new InnerSequence([createDocument(image), null]);
    const old = JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, doc))));
    const { documents } = hydrateFile(old, services);
    assert.deepEqual(documents.map((each) => each.documentType.name), ["image", "structuredText"]);
    assert.equal(documents[1].model.before, null);
  });
});
