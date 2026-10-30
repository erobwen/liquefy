import assert from "assert";
import { repeat, retractRepeater, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { PaperSequence, monospaceMeasurer, paperSizes, margins, mm } from "../../print/index.js";
import { document, section, paragraph, sequence as sequenceOf, paragraphText, isSection, textPosition, flowStart } from "../../model/flows.js";
import { InnerSequence, isFresh, anchoredSequences } from "../../model/sequences.js";
import { PageLayout } from "../../model/pageLayout.js";
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

  it("before the title, at its start: a cover - Ctrl+Backspace there takes it away", function () {
    const { doc, editing } = setUp([paragraph("text")]);
    editing.pageBreak(textPosition(doc.title, 0));
    assert.deepEqual(anchors(doc), ["Document:before"]);
    assert.deepEqual(laidOut(doc), ["[]", "Book text"]);
    editing.unanchor(textPosition(doc.title, 0));
    assert.deepEqual(anchors(doc), []);
  });

  it("are laid out after the page their paragraph ends on - the text going on there - and after a section, the rest on a fresh page", function () {
    const { doc, editing } = setUp([paragraph("before"), paragraph("after"), section("Next", paragraph("next"))]);
    editing.pageBreak(textPosition(doc.children[0], 0));
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
    doc.before.items[0] = createDocument(image);
    doc.before.items.push(null);
    editing.pageBreak(textPosition(doc.children[0].children[0], 4));
    doc.bookMode = true;
    const json = JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, doc))));
    assert.equal(json.properties.bookMode, true);
    assert.deepEqual(json.properties.before.properties.items.map((item) => item && item.name), ["image", null]);
    const back = hydrateDocument(json, services).model;
    assert.deepEqual(anchors(back), anchors(doc));
    assert.equal(back.before.items[0].documentType, image);
    assert.deepEqual(JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, back)))), json);
  });
});

describe("Pages of their own, printed on both sides", function () {
  // A document printed on both sides, laid out: each paper's side - and,
  // where pages of their own are, "[n]" (how many) - and its last line's x.
  function sides(doc, { firstSide = "recto" } = {}) {
    const seq = new PaperSequence();
    const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer(), firstSide }).establish();
    const root = repeat(() => layout.renderOnto(seq), { independent: true });
    try {
      const result = [];
      seq.pages.forEach((format, index) => {
        for (const insert of seq.inserts.filter((each) => each.page === index && each.before)) result.push("[" + insert.pages + (insert.pad ? "+blank" : "") + "]");
        const lines = seq.linesOf(index);
        // Its last line's x - body text, not a centred title.
        result.push(format.side + "@" + (lines.length ? lines[lines.length - 1].x / 1000 : "-"));
        for (const insert of seq.inserts.filter((each) => each.page === index && !each.before)) result.push("[" + insert.pages + "]");
      });
      return result;
    } finally {
      retractRepeater(root);
      layout.dispose();
    }
  }

  const book = (...children) => document({ title: "Book", paper, pageLayout: new PageLayout({ margins: { top: mm(20), bottom: mm(20), left: mm(30), right: mm(15) }, duplex: true }) }, ...children);
  const lots = (count) => Array.from({ length: count }, (_, index) => paragraph("Paragraph " + index + " - " + "words ".repeat(40)));

  it("count the papers after them on, past their pages - and leave the paper they come after as it is", function () {
    const doc = book(...lots(60));
    const plain = sides(doc);
    assert.deepEqual(plain.slice(0, 3), ["recto@30", "verso@15", "recto@30"]);
    // Pages of their own after the first paragraph: one page - a place.
    doc.children[0].after = new InnerSequence();
    const one = sides(doc);
    assert.deepEqual(one.slice(0, 4), ["recto@30", "[1]", "recto@30", "verso@15"], "the paper after them a right-hand one - after their left-hand page");
    // Two pages: the next a left-hand one again.
    doc.children[0].after.pageCounts[0] = 1;
    doc.children[0].after.items.push(null);
    assert.deepEqual(sides(doc).slice(0, 4), ["recto@30", "[2]", "verso@15", "recto@30"]);
  });

  it("before the title: a blank back after them, where they'd end on a right-hand page - the title's page a right-hand one", function () {
    const doc = book(paragraph("text"));
    doc.before = new InnerSequence();
    assert.deepEqual(sides(doc), ["[1+blank]", "recto@30"]);
    doc.before.items.push(null);
    assert.deepEqual(sides(doc), ["[2]", "recto@30"]);
  });

  it("start a document among them on the side they're told - its first page a left-hand one, after a right-hand one", function () {
    const doc = book(...lots(30));
    assert.deepEqual(sides(doc, { firstSide: "verso" }).slice(0, 2), ["verso@15", "recto@30"]);
  });
});

describe("A file's print settings", function () {
  it("are its root's - printed on both sides, saved as a sequence saying so; one side, the root as it was", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin);
    const { doc } = setUp([paragraph("text")]);
    const documents = [new HydratedDocument(structuredText, doc)];
    const plain = dehydrateFile(documents, { duplex: false });
    assert.equal(plain.type, "document");
    const both = JSON.parse(JSON.stringify(dehydrateFile(documents, { duplex: true })));
    assert.deepEqual([both.type, both.name, both.properties.print], ["sequence", "root", { duplex: true }]);
    const read = hydrateFile(both, services);
    assert.equal(read.print.duplex, true);
    assert.equal(read.documents.length, 1);
    assert.equal(hydrateFile(plain, services).print.duplex, false);
  });
});
