import assert from "assert";
import { observable } from "@liquefy/cascade.component";
import {
  position, paragraphText, insertText, deleteBackward, deleteForward, splitParagraph, moveLeft, moveRight, documentStart, documentEnd,
  deleteBetween, comparePositions, samePosition, wordAt,
} from "../editing.js";

// A paragraph: its style, then spans - a string, or [characterStyle, text].
const paragraph = (style, ...spans) => observable({
  style,
  spans: observable(spans.map((span) => observable(typeof(span) === "string" ? { text: span } : { style: span[0], text: span[1] }))),
});

function documentOf(...sections) {
  return observable({
    styles: observable({ paragraph: { Normal: {}, Heading: { nextStyle: "Normal" } } }),
    sections: observable(sections.map((paragraphs) => observable({ paragraphs: observable(paragraphs) }))),
  });
}

// Each paragraph as "style: text", spans in character styles as [style:text].
const contents = (document) => document.sections.flatMap((section) => section.paragraphs.map((p) =>
  p.style + ": " + p.spans.map((span) => span.style ? "[" + span.style + ":" + span.text + "]" : span.text).join("|")));

describe("Editing the model", function () {
  it("inserts text into the span the position is in - at a boundary, the one before", function () {
    const p = paragraph("Normal", "a ", ["Strong", "bold"], " word");
    const document = documentOf([p]);
    let at = insertText(document, position(p, 6), "er");
    assert.deepEqual(contents(document), ["Normal: a |[Strong:bolder]| word"]);
    assert.equal(at.offset, 8);
    at = insertText(document, position(p, 2), "very ");
    assert.deepEqual(contents(document), ["Normal: a very |[Strong:bolder]| word"]);
  });

  it("splits the paragraph at line breaks in inserted text", function () {
    const p = paragraph("Normal", "ab");
    const document = documentOf([p]);
    const at = insertText(document, position(p, 1), "1\n2\n3");
    assert.deepEqual(contents(document), ["Normal: a1", "Normal: 2", "Normal: 3b"]);
    assert.equal(paragraphText(at.paragraph), "3b");
    assert.equal(at.offset, 1);
  });

  it("deletes backward and forward - across spans, and an emoji as one character", function () {
    const p = paragraph("Normal", "ab", ["Strong", "c"], "d😀e");
    const document = documentOf([p]);
    let at = deleteBackward(document, position(p, 3));
    assert.deepEqual(contents(document), ["Normal: ab|d😀e"]);
    assert.equal(at.offset, 2);
    at = deleteForward(document, position(p, 3));
    assert.deepEqual(contents(document), ["Normal: ab|de"]);
    at = deleteBackward(document, position(p, 4));
    assert.deepEqual(contents(document), ["Normal: ab|d"]);
  });

  it("keeps the formatting of a paragraph whose text is all deleted, for what's typed next", function () {
    const p = paragraph("Normal", ["Strong", "x"]);
    const document = documentOf([p]);
    const at = deleteBackward(document, position(p, 1));
    assert.deepEqual(contents(document), ["Normal: [Strong:]"]);
    insertText(document, at, "y");
    assert.deepEqual(contents(document), ["Normal: [Strong:y]"]);
  });

  it("merges paragraphs at a paragraph break - also across sections", function () {
    const first = paragraph("Normal", "one");
    const second = paragraph("Normal", ["Strong", "two"]);
    const third = paragraph("Normal", "three");
    const document = documentOf([first, second], [third]);
    let at = deleteBackward(document, position(second, 0));
    assert.deepEqual(contents(document), ["Normal: one|[Strong:two]", "Normal: three"]);
    assert.equal(at.paragraph, first);
    assert.equal(at.offset, 3);
    at = deleteForward(document, position(first, 6));
    assert.deepEqual(contents(document), ["Normal: one|[Strong:two]|three"]);
    // The second section, empty, is gone - it would still be a paper.
    assert.equal(document.sections.length, 1);
    // Nothing before the first, nothing after the last.
    assert.equal(deleteBackward(document, position(first, 0)).offset, 0);
    assert.equal(deleteForward(document, position(first, 11)).offset, 11);
  });

  it("splits a paragraph at Enter, both halves in its style - or the next style, at the end of one that names it", function () {
    const heading = paragraph("Heading", "Title", ["Strong", "Bold"]);
    const document = documentOf([heading]);
    let at = splitParagraph(document, position(heading, 7));
    assert.deepEqual(contents(document), ["Heading: Title|[Strong:Bo]", "Heading: [Strong:ld]"]);
    at = splitParagraph(document, position(at.paragraph, 2));
    assert.deepEqual(contents(document), ["Heading: Title|[Strong:Bo]", "Heading: [Strong:ld]", "Normal: [Strong:]"]);
    assert.equal(at.offset, 0);
    // At the start: an empty paragraph before, formatted as the text there.
    splitParagraph(document, position(heading, 0));
    assert.deepEqual(contents(document).slice(0, 2), ["Heading: ", "Heading: Title|[Strong:Bo]"]);
  });

  it("deletes a selection within a paragraph - either way round", function () {
    const p = paragraph("Normal", "ab", ["Strong", "cd"], "ef");
    const document = documentOf([p]);
    const at = deleteBetween(document, position(p, 5), position(p, 1));
    assert.deepEqual(contents(document), ["Normal: a|f"]);
    assert.equal(at.offset, 1);
  });

  it("deletes a selection across paragraphs and sections: its two ends become one paragraph, in the first one's style", function () {
    const first = paragraph("Heading", "one two");
    const second = paragraph("Normal", "three");
    const third = paragraph("Normal", "four five");
    const fourth = paragraph("Normal", "six");
    const document = documentOf([first, second], [third], [fourth]);
    const at = deleteBetween(document, position(third, 5), position(first, 4));
    assert.deepEqual(contents(document), ["Heading: one |five", "Normal: six"]);
    assert.equal(document.sections.length, 2);
    assert.equal(at.paragraph, first);
    assert.equal(at.offset, 4);
  });

  it("orders positions in the document", function () {
    const first = paragraph("Normal", "ab");
    const second = paragraph("Normal", "cd");
    const document = documentOf([first], [second]);
    assert.ok(comparePositions(document, position(first, 2), position(second, 0)) < 0);
    assert.ok(comparePositions(document, position(second, 0), position(first, 2)) > 0);
    assert.equal(comparePositions(document, position(first, 1), position(first, 1)), 0);
    assert.ok(samePosition(position(first, 1), position(first, 1, true)));
  });

  it("finds the word at a position - or the space between words", function () {
    const p = paragraph("Normal", "Two wor", ["Strong", "ds"], ", don't  go.");
    assert.deepEqual(wordAt(p, 5), [4, 9]);
    assert.deepEqual(wordAt(p, 9), [4, 9]);
    assert.deepEqual(wordAt(p, 0), [0, 3]);
    assert.deepEqual(wordAt(p, 13), [11, 16]);
    assert.deepEqual(wordAt(p, 17), [16, 18]);
  });

  it("moves left and right through the text, into the paragraphs before and after", function () {
    const first = paragraph("Normal", "ab");
    const second = paragraph("Normal", "c");
    const document = documentOf([first, second]);
    assert.deepEqual(moveRight(document, position(first, 2)), position(second, 0));
    assert.deepEqual(moveLeft(document, position(second, 0)), position(first, 2));
    assert.deepEqual(moveLeft(document, position(first, 0)), position(first, 0));
    assert.deepEqual(moveRight(document, position(second, 1)), position(second, 1));
    assert.deepEqual(documentStart(document), position(first, 0));
    assert.deepEqual(documentEnd(document), position(second, 1));
  });
});
