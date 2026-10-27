import assert from "assert";
import { ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { mm, paperSizes, margins } from "../../print/index.js";
import { document, paragraph, section, sequence, textPosition, flowEnd, paragraphText } from "../flows.js";
import { FrameAnchor, anchorAt, frameSize } from "../frames.js";
import { tabulaEditing } from "../../paper/editing.js";
import { structuredTextPlugin, structuredText } from "../../plugins/structuredText/index.js";
import { framesPlugin, image, table, shape, pageNumber } from "../../plugins/frames/index.js";
import { createDocument, hydrateDocument, dehydrateDocument, rootDocumentTypes, frameTypes } from "../../shell/documents.js";

const anchorCharacter = String.fromCharCode(0xfffc);
const spansOf = (p) => p.spans.map((span) => span.anchor ? "[frame]" : span.text);

function setUp(...spans) {
  const p = paragraph(...spans);
  const s = section("S", paragraph("in it"));
  const doc = document({ title: "D", paper: paperSizes.A4, margins: margins(mm(25)) }, p, s);
  let refusals = 0;
  const editing = tabulaEditing(sequence(doc), { refuse: () => { refusals++; } });
  return { p, s, doc, editing, refusals: () => refusals };
}

describe("Frames", function () {
  it("are inserted where the caret is, in the text: an anchor - one character - the caret after it", function () {
    const { p, editing } = setUp("abcd");
    const content = createDocument(image);
    const after = editing.insert(textPosition(p, 2), content);
    assert.deepEqual(spansOf(p), ["ab", "[frame]", "cd"]);
    assert.equal(paragraphText(p), "ab" + anchorCharacter + "cd");
    assert.deepEqual([after.paragraph, after.offset], [p, 3]);
    const anchor = p.spans[1].anchor;
    assert.ok(anchor instanceof FrameAnchor);
    assert.equal(anchor.content, content);
    // The frame the caret is at: right after it - or right before it.
    assert.equal(anchorAt(after), anchor);
    assert.equal(anchorAt(textPosition(p, 2)), anchor);
    assert.equal(anchorAt(textPosition(p, 1)), null);
  });

  it("are never typed into: typing beside one goes into the text beside it - or a span of its own", function () {
    const { p, editing } = setUp("abcd");
    editing.insert(textPosition(p, 2), createDocument(image));
    editing.insertText(textPosition(p, 3), "X");
    editing.insertText(textPosition(p, 2), "Y");
    assert.deepEqual(spansOf(p), ["abY", "[frame]", "Xcd"]);
    // At the very start, before one; at the very end, after one.
    const { p: q, editing: other } = setUp("");
    other.insert(textPosition(q, 0), createDocument(table));
    other.insertText(textPosition(q, 0), "<");
    other.insertText(textPosition(q, 2), ">");
    assert.deepEqual(spansOf(q), ["<", "[frame]", ">"]);
    // Nor typed: its character pasted is dropped.
    other.insertText(textPosition(q, 3), "a" + anchorCharacter + "b");
    assert.deepEqual(spansOf(q), ["<", "[frame]", ">ab"]);
  });

  it("go with their text - split off with it, joined with it - and are taken out as a character is", function () {
    const { p, doc, editing } = setUp("abcd");
    editing.insert(textPosition(p, 2), createDocument(image));
    const next = editing.splitParagraph(textPosition(p, 2));
    assert.deepEqual(spansOf(p), ["ab"]);
    assert.deepEqual(spansOf(next.paragraph), ["[frame]", "cd"]);
    const joined = editing.deleteBackward(next);
    assert.deepEqual(spansOf(doc.children[0]), ["ab", "[frame]", "cd"]);
    editing.deleteBackward(textPosition(joined.paragraph, 3));
    assert.deepEqual(spansOf(doc.children[0]), ["ab", "cd"]);
  });

  it("are refused at a place with no text to go in - a section's end - nothing changed", function () {
    const { s, doc, editing, refusals } = setUp("abcd");
    const at = flowEnd(s);
    assert.equal(editing.insert(at, createDocument(image)), at);
    assert.equal(refusals(), 1);
    assert.deepEqual(spansOf(doc.children[0]), ["abcd"]);
  });

  it("are as tall as their content's proportions make them, at most as wide as there's room for", function () {
    const anchor = new FrameAnchor({ content: createDocument(table), width: mm(90) });
    // Three columns of 30, three rows of 8: 90 by 24.
    assert.deepEqual(frameSize(anchor), { width: mm(90), height: mm(24) });
    assert.deepEqual(frameSize(anchor, mm(45)), { width: mm(45), height: mm(12) });
    anchor.content.model.rows = [["", ""]];
    assert.deepEqual(frameSize(anchor, mm(45)), { width: mm(45), height: mm(6) });
  });

  it("are saved with their text, what's in them by its own plugin - and loaded back", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin, framesPlugin);
    const { doc } = setUp("a", { anchor: new FrameAnchor({ content: createDocument(image), placement: "left", width: mm(50) }) }, "b");
    const json = JSON.parse(JSON.stringify(dehydrateDocument({ documentType: structuredText, model: doc }, services)));
    const spans = json.properties.children[0].spans;
    assert.deepEqual(spans[1], { frame: { placement: "left", width: mm(50), content: { type: "document", name: "image", properties: { src: null, aspectRatio: 4 / 3 } } } });
    const back = hydrateDocument(json, services);
    const anchor = back.model.children[0].spans[1].anchor;
    assert.deepEqual([anchor.placement, anchor.width, anchor.content.documentType], ["left", mm(50), image]);
    assert.deepEqual(dehydrateDocument(back, services), json);
  });

  it("hold the kinds that have a frame - created in another document, never at the root - each where it can be", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin, framesPlugin);
    assert.deepEqual(rootDocumentTypes(services), [structuredText]);
    assert.deepEqual(frameTypes(services), [image, table, shape, pageNumber]);
    assert.deepEqual(frameTypes(services, "text"), [image, table]);
    assert.deepEqual(frameTypes(services, "page"), [image, shape, pageNumber]);
  });
});
