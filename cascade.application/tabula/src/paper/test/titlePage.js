import assert from "assert";
import { repeat, retractRepeater, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { PaperSequence, monospaceMeasurer, paperSizes, margins, mm } from "../../print/index.js";
import {
  document, section, paragraph, sequence as sequenceOf, paragraphText, isParagraph, isSection,
  textPosition, flowStart, samePosition,
} from "../../model/flows.js";
import { isBook, frontPages, hint } from "../../model/book.js";
import { PageLayout } from "../../model/pageLayout.js";
import { tabulaEditing } from "../editing.js";
import { SequenceLayout } from "../../layout/DocumentLayout.js";
import { structuredTextPlugin, structuredText } from "../../plugins/structuredText/index.js";
import { hydrateDocument, dehydrateDocument, HydratedDocument } from "../../shell/documents.js";

const paper = paperSizes.A4;

function setUp(children, { duplex = false } = {}) {
  const doc = document({ title: "Book", paper, pageLayout: new PageLayout({ margins: margins(mm(25)), duplex }) }, ...children);
  let refusals = 0;
  const editing = tabulaEditing(sequenceOf(doc), { refuse: () => { refusals++; } });
  return { doc, editing, refusals: () => refusals };
}

// The pages before the body, readable: "a | Book, b | _ || c" - each page's
// flows ("_" an empty paragraph, "Name[...]" a section), the title page
// with the title first, "||" before the body's page.
const text = (flow) => isParagraph(flow) ? paragraphText(flow) || "_" : paragraphText(flow.title) + "[...]";
function pages(doc) {
  return frontPages(doc).map((page) => (page.where === "body" ? "| " : "")
    + [...(page.where === "title" ? [paragraphText(doc.title)] : []), ...page.flows.map(text)].join(", ")).join(" | ");
}

// The document laid out: what's on each paper - its paragraphs' text, "·"
// for a paper with nothing on it.
function papers(doc) {
  const seq = new PaperSequence();
  const layout = new SequenceLayout({ sequence: sequenceOf(doc), measurer: monospaceMeasurer() }).establish();
  const root = repeat(() => layout.renderOnto(seq), { independent: true });
  try {
    return seq.pages.map((format, index) => {
      const lines = seq.linesOf(index).filter((line) => !line.runs.some((run) => run.placeholder));
      const texts = [...new Set(lines.map((line) => paragraphText(line.paragraph)))];
      return texts.length ? texts.join(" ") : "·";
    });
  } finally {
    retractRepeater(root);
    layout.dispose();
  }
}

describe("The start of a book", function () {
  describe("printed on one side", function () {
    it("isn't there to start with - Ctrl+Enter after the title makes a title page: a book", function () {
      const { doc, editing } = setUp([paragraph("a"), paragraph("b")]);
      assert.ok(!isBook(doc));
      const at = editing.pageBreak(textPosition(doc.title, 4));
      assert.equal(pages(doc), "Book | | a, b");
      assert.ok(isBook(doc));
      assert.ok(samePosition(at, textPosition(doc.children[0], 0)), "the caret at the body's start");
      assert.deepEqual(papers(doc), ["Book", "a b"]);
    });

    it("starts a page where Ctrl+Enter is pressed before the first section - at a paragraph's end, in its middle, past the last", function () {
      let { doc, editing } = setUp([paragraph("Subtitle"), paragraph("By someone"), section("One", paragraph("text"))]);
      editing.pageBreak(textPosition(doc.children[1], 10));
      // The body starting with its first section: that section starts a page.
      assert.equal(pages(doc), "Book, Subtitle, By someone | | ");
      assert.ok(doc.pageStarts.includes(doc.children[2]));
      ({ doc, editing } = setUp([paragraph("Subtitle and more")]));
      editing.pageBreak(textPosition(doc.children[0], 8));
      assert.equal(pages(doc), "Book, Subtitle | |  and more");
      ({ doc, editing } = setUp([paragraph("Subtitle")]));
      editing.pageBreak(textPosition(doc.children[0], 8));
      assert.equal(pages(doc), "Book, Subtitle | | _");
    });

    it("adds an empty page where a page starts already - hinting what's usually there - and Backspace takes it away", function () {
      const { doc, editing } = setUp([paragraph("text")]);
      editing.pageBreak(textPosition(doc.title, 4));
      const at = editing.pageBreak(textPosition(doc.children[0], 0));
      assert.equal(pages(doc), "Book | _ | | text");
      assert.equal(hint(doc, at.paragraph), "Copyright");
      editing.pageBreak(textPosition(doc.children[1], 0));
      assert.equal(pages(doc), "Book | _ | _ | | text");
      assert.equal(hint(doc, doc.children[1]), "Dedication");
      // Backspace on an empty page: the page gone, the caret at the end of the
      // page before.
      const back = editing.deleteBackward(textPosition(doc.children[1], 0));
      assert.equal(pages(doc), "Book | _ | | text");
      assert.ok(samePosition(back, textPosition(doc.children[0], 0)));
      // At the body's start: the break gone - and the empty page before it.
      editing.deleteBackward(textPosition(doc.children[1], 0));
      assert.equal(pages(doc), "Book, text");
      assert.ok(!isBook(doc));
    });

    it("has pages before the title: Ctrl+Enter at the title's start - half title, frontispiece - Backspace there takes them away", function () {
      const { doc, editing } = setUp([paragraph("text")]);
      const at = editing.pageBreak(textPosition(doc.title, 0));
      assert.equal(pages(doc), "_ | Book, text");
      assert.equal(at.paragraph, doc.front.children[0]);
      assert.equal(hint(doc, doc.front.children[0]), "Half title");
      editing.pageBreak(textPosition(doc.title, 0));
      assert.equal(hint(doc, doc.front.children[1]), "Frontispiece");
      assert.deepEqual(papers(doc), ["·", "·", "Book text"]);
      editing.deleteBackward(textPosition(doc.title, 0));
      editing.deleteBackward(textPosition(doc.title, 0));
      assert.equal(pages(doc), "Book, text");
    });

    it("refuses Ctrl+Enter in the body - no hard page breaks in the flow", function () {
      const { doc, editing, refusals } = setUp([paragraph("a"), section("One", paragraph("in it")), paragraph("after")]);
      const inSection = textPosition(doc.children[1].children[0], 2);
      assert.ok(samePosition(editing.pageBreak(inSection), inSection));
      assert.ok(samePosition(editing.pageBreak(textPosition(doc.children[2], 0)), textPosition(doc.children[2], 0)));
      assert.equal(refusals(), 2);
      assert.ok(!isBook(doc));
    });

    it("takes a break away with Delete at the end of the page before it - Backspace's mirror", function () {
      const { doc, editing } = setUp([paragraph("Subtitle"), paragraph("text")]);
      editing.pageBreak(textPosition(doc.children[0], 8));
      editing.deleteForward(textPosition(doc.children[0], 8));
      assert.equal(pages(doc), "Book, Subtitle, text");
    });

    it("keeps a page starting where it did as its first flow is made into another", function () {
      const { doc, editing } = setUp([paragraph("Subtitle")]);
      editing.pageBreak(textPosition(doc.children[0], 8));
      editing.splitParagraph(textPosition(doc.children[1], 0));
      assert.ok(isSection(doc.children[1]));
      assert.equal(pages(doc), "Book, Subtitle | | ");
      assert.ok(doc.pageStarts.includes(doc.children[1]));
    });

    it("starts its chapters on new pages, once it's a book - unless told not to", function () {
      const { doc, editing } = setUp([section("One", paragraph("one")), section("Two", paragraph("two"))]);
      assert.deepEqual(papers(doc), ["Book One one Two two"]);
      editing.pageBreak(textPosition(doc.title, 4));
      assert.deepEqual(papers(doc), ["Book", "One one", "Two two"]);
      doc.chaptersOnNewPage = false;
      assert.deepEqual(papers(doc), ["Book", "One one Two two"]);
    });
  });

  describe("printed on both sides", function () {
    it("has sheets: Ctrl+Enter after the title - the title page, its back the copyright page, the body on a right-hand page", function () {
      const { doc, editing } = setUp([paragraph("text")], { duplex: true });
      const at = editing.pageBreak(textPosition(doc.title, 4));
      assert.equal(pages(doc), "Book | _ | | text");
      assert.equal(hint(doc, doc.children[0]), "Copyright");
      assert.ok(samePosition(at, textPosition(doc.children[1], 0)), "the caret at the body's start");
      assert.deepEqual(papers(doc), ["Book", "·", "text"]);
      // Backspace at the body's start: undone, all of it.
      editing.deleteBackward(textPosition(doc.children[1], 0));
      assert.equal(pages(doc), "Book, text");
    });

    it("adds a sheet - two empty pages - where a page starts already; Backspace on one takes the sheet away", function () {
      const { doc, editing } = setUp([paragraph("text")], { duplex: true });
      editing.pageBreak(textPosition(doc.title, 4));
      const at = editing.pageBreak(textPosition(doc.children[0], 0));
      assert.equal(pages(doc), "Book | _ | _ | _ | | text");
      editing.deleteBackward(at);
      assert.equal(pages(doc), "Book | _ | | text");
    });

    it("starts its chapters - and its title, after pages before it - on right-hand pages: blank backs where needed", function () {
      const { doc, editing } = setUp([section("One", paragraph("one")), section("Two", paragraph("two"))], { duplex: true });
      editing.pageBreak(textPosition(doc.title, 4));
      // Title, its back (copyright), One, a blank back, Two.
      assert.deepEqual(papers(doc), ["Book", "·", "One one", "·", "Two two"]);
    });

    it("goes over to one side and back changing nothing - and from one side, with an odd page count, gets a blank back", function () {
      const { doc, editing } = setUp([paragraph("text"), section("One", paragraph("one"))], { duplex: true });
      editing.pageBreak(textPosition(doc.title, 4));
      const before = pages(doc);
      const onBoth = papers(doc);
      doc.pageLayout.duplex = false;
      assert.equal(pages(doc), before, "the same pages - the copyright page an empty page");
      doc.pageLayout.duplex = true;
      assert.equal(pages(doc), before);
      assert.deepEqual(papers(doc), onBoth);

      // On one side: a title page, the body after it - two pages. Both sides:
      // the body's chapter on a right-hand page, a blank back before it.
      const single = setUp([section("One", paragraph("one"))]);
      single.editing.pageBreak(textPosition(single.doc.title, 4));
      assert.deepEqual(papers(single.doc), ["Book", "One one"]);
      single.doc.pageLayout.duplex = true;
      assert.deepEqual(papers(single.doc), ["Book", "·", "One one"]);
    });
  });

  it("is saved - its front, where its pages start - and loaded back", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin);
    const { doc, editing } = setUp([paragraph("Subtitle"), paragraph("text")]);
    const plain = dehydrateDocument(new HydratedDocument(structuredText, doc));
    assert.deepEqual([plain.properties.front, plain.properties.breaks], [undefined, undefined], "nothing saved for none");
    editing.pageBreak(textPosition(doc.children[0], 8));
    editing.pageBreak(textPosition(doc.title, 0));
    const json = JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, doc))));
    assert.deepEqual([json.properties.front.length, json.properties.frontBreaks, json.properties.breaks], [1, [], [1]]);
    const back = hydrateDocument(json, services).model;
    assert.equal(pages(back), pages(doc));
    assert.deepEqual(JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, back)))), json);
  });
});
