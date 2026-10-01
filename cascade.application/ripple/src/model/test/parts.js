import assert from "assert";
import { isObservable } from "@liquefy/cascade.component";
import { Paragraph, Section, Document, document, section, paragraph, bold, italic, paragraphText, isSection, isParagraph } from "../parts.js";
import { testDocument } from "../testDocument.js";

const paper = { width: 100000, height: 100000 };
const margins = { top: 0, right: 0, bottom: 0, left: 0 };

describe("Ripple's document parts", function () {
  it("makes a paragraph of spans - styled only span by span", function () {
    const p = paragraph("plain ", bold("bold"), " and ", italic("italic"));
    assert.ok(p instanceof Paragraph && isParagraph(p) && isObservable(p));
    assert.deepEqual(p.spans.map((span) => [span.text, span.bold, span.italic]),
      [["plain ", false, false], ["bold", true, false], [" and ", false, false], ["italic", false, true]]);
    assert.equal(paragraphText(p), "plain bold and italic");
    assert.equal(p.style, undefined);
  });

  it("makes a section of a title and children - the title a paragraph", function () {
    const s = section("A title", paragraph("text"), section("Inner"));
    assert.ok(s instanceof Section && isSection(s));
    assert.ok(s.title instanceof Paragraph);
    assert.equal(paragraphText(s.title), "A title");
    assert.deepEqual(s.children.map((child) => isSection(child)), [false, true]);
    assert.ok(isObservable(s.children));
  });

  it("keeps a section's paragraphs before its sections", function () {
    assert.throws(() => section("Bad", section("Inner"), paragraph("after")), /paragraphs come before its sections/);
    assert.throws(() => section("Bad", "not a part"), /isn't a paragraph or a section/);
    assert.doesNotThrow(() => section("Good", paragraph("a"), paragraph("b"), section("c"), section("d")));
  });

  it("makes a document: the outermost section, with its paper", function () {
    const d = document({ title: "The book", paper, margins }, paragraph("intro"));
    assert.ok(d instanceof Document && d instanceof Section);
    assert.equal(paragraphText(d.title), "The book");
    assert.equal(d.paper, paper);
    assert.throws(() => section("Bad", d), /A document can't be inside a section/);
  });

  it("has a test document that follows the rules all the way down", function () {
    const check = (part, depth) => {
      if (!isSection(part)) return depth;
      return Math.max(depth, ...part.children.map((child) => check(child, depth + 1)));
    };
    const d = testDocument();
    assert.ok(d instanceof Document);
    assert.ok(check(d, 0) >= 4);
  });
});
