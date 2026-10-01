import assert from "assert";
import { observable } from "@liquefy/cascade.component";
import { position } from "../editing.js";
import { toggleBold, toggleItalic, isFormatted, setParagraphStyle, setAlignment, paragraphFormatAt, fontAt } from "../formatting.js";
import { paragraphStyleOf } from "../styles.js";

const paragraph = (style, ...texts) => observable({ style, spans: observable(texts.map((text) => observable({ text }))) });

function documentOf(...paragraphs) {
  return observable({
    styles: observable({
      paragraph: { Normal: {}, Heading: { font: { weight: 700, size: 16 } } },
      character: {},
    }),
    sections: observable([observable({ paragraphs: observable(paragraphs) })]),
  });
}

// Each span as text, with its direct font: "text{weight:700}".
const spans = (p) => p.spans.map((span) => span.text + (span.font ? JSON.stringify(span.font).replace(/"/g, "") : ""));
const bold = (font) => font.weight >= 600;

describe("Formatting the model", function () {
  it("makes selected text bold - splitting spans where the selection ends - and back again, leaving it as it was", function () {
    const p = paragraph("Normal", "one two three");
    const document = documentOf(p);
    toggleBold(document, position(p, 4), position(p, 7));
    assert.deepEqual(spans(p), ["one ", "two{weight:700}", " three"]);
    assert.ok(isFormatted(document, position(p, 7), position(p, 4), bold));
    assert.ok(!isFormatted(document, position(p, 2), position(p, 5), bold));
    toggleBold(document, position(p, 7), position(p, 4));
    assert.deepEqual(spans(p), ["one two three"]);
  });

  it("makes a selection only partly bold all bold, and italic on top", function () {
    const p = paragraph("Normal", "one two three");
    const document = documentOf(p);
    toggleBold(document, position(p, 4), position(p, 7));
    toggleBold(document, position(p, 0), position(p, 7));
    assert.deepEqual(spans(p), ["one two{weight:700}", " three"]);
    toggleItalic(document, position(p, 2), position(p, 9));
    assert.deepEqual(spans(p), ["on{weight:700}", "e two{weight:700,italic:true}", " t{italic:true}", "hree"]);
  });

  it("unbolds text whose style makes it bold with direct formatting - and bolds it again with none", function () {
    const heading = paragraph("Heading", "Title");
    const document = documentOf(heading);
    assert.ok(isFormatted(document, position(heading, 0), position(heading, 5), bold));
    toggleBold(document, position(heading, 0), position(heading, 5));
    assert.deepEqual(spans(heading), ["Title{weight:400}"]);
    toggleBold(document, position(heading, 0), position(heading, 5));
    assert.deepEqual(spans(heading), ["Title"]);
  });

  it("formats across paragraphs", function () {
    const first = paragraph("Normal", "aaaa");
    const second = paragraph("Normal", "bbbb");
    const document = documentOf(first, second);
    toggleItalic(document, position(first, 2), position(second, 2));
    assert.deepEqual([spans(first), spans(second)], [["aa", "aa{italic:true}"], ["bb{italic:true}", "bb"]]);
    assert.ok(fontAt(document, position(second, 2)).italic);
    assert.ok(!fontAt(document, position(second, 3)).italic);
  });

  it("sets the style and the alignment of every paragraph a selection touches", function () {
    const first = paragraph("Normal", "aaaa");
    const second = paragraph("Normal", "bbbb");
    const third = paragraph("Normal", "cccc");
    const document = documentOf(first, second, third);
    setParagraphStyle(document, position(second, 1), position(first, 3), "Heading");
    assert.deepEqual([first.style, second.style, third.style], ["Heading", "Heading", "Normal"]);
    setAlignment(document, position(second, 0), position(third, 0), "center");
    assert.deepEqual(paragraphFormatAt(document, position(second, 0)), { style: "Heading", align: "center" });
    assert.equal(paragraphStyleOf(document.styles, first).align, "left");
    assert.equal(paragraphStyleOf(document.styles, third).align, "center");
    // Direct alignment stays when the style changes, as in Word.
    setParagraphStyle(document, position(third, 0), position(third, 0), "Heading");
    assert.equal(paragraphStyleOf(document.styles, third).align, "center");
  });
});
