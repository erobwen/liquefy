import assert from "assert";
import { isObservable } from "@liquefy/cascade.component";
import { Paragraph, Section, Document, document, section, paragraph, bold, italic, paragraphText, isSection, isParagraph, titleLevel, hasExitTitle, exitTitle } from "../flows.js";
import { testDocument } from "../testDocument.js";

const paper = { width: 100000, height: 100000 };
const margins = { top: 0, right: 0, bottom: 0, left: 0 };

describe("Ripple's document flows", function () {
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

  it("gives every section a title level - its parent's + 1 + its own offset - and a paragraph an infinite one", function () {
    const inner = section({ title: "Inner", titleOffset: 2 });
    const outer = section("Outer", paragraph("p"), inner);
    assert.equal(titleLevel(outer), 1);
    assert.equal(titleLevel(inner, titleLevel(outer)), 4);
    assert.equal(titleLevel(paragraph("p"), 3), Infinity);
    const offsetRoot = document({ title: "D", paper, margins, titleOffset: 1 });
    assert.equal(titleLevel(offsetRoot), 2);
  });

  it("gives a section an exit title when a sibling of a higher title level follows it - a paragraph, or a section further down", function () {
    const deep = section({ title: "Deep", titleOffset: 1 });
    const plain = section("Plain");
    assert.ok(hasExitTitle(plain, paragraph("p"), 1));  // 2, then infinite
    assert.ok(hasExitTitle(plain, deep, 1));     // 2, then 3
    assert.ok(!hasExitTitle(deep, plain, 1));    // 3, then 2
    assert.ok(!hasExitTitle(plain, section("Also plain"), 1));
    assert.ok(!hasExitTitle(plain, null, 1));    // the last: nothing follows
    assert.ok(!hasExitTitle(paragraph("p"), plain, 1));
    // The same exit title, every time it's asked for.
    assert.equal(exitTitle(deep), exitTitle(deep));
    assert.equal(exitTitle(deep).exitOf, deep);
  });

  it("takes paragraphs and sections as a section's children, in any order - nothing else", function () {
    assert.doesNotThrow(() => section("Good", section("Inner"), paragraph("after")));
    assert.throws(() => section("Bad", "not a flow"), /isn't a paragraph or a section/);
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
    const check = (flow, depth) => {
      if (!isSection(flow)) return depth;
      return Math.max(depth, ...flow.children.map((child) => check(child, depth + 1)));
    };
    const d = testDocument();
    assert.ok(d instanceof Document);
    assert.ok(check(d, 0) >= 4);
  });
});
