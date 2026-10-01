import assert from "assert";
import { observable } from "@liquefy/cascade.component";
import { PaperSequence, margins } from "@liquefy/cascade.print";
import { WordDocument } from "../WordDocument.js";

// Every character 1000 µm wide; lines 5000 µm tall. A paper 12 x 22 mm with
// 1 mm margins holds 10 characters across and 4 lines down.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};
const smallPaper = { width: 12000, height: 22000 };

const paragraph = (text, style = "Normal") => observable({ style, spans: observable([observable({ text })]) });

function section(paragraphs, paper = smallPaper) {
  return observable({ paper, margins: margins(1000), paragraphs: observable(paragraphs) });
}

function layOut(sections, paragraphStyles = {}) {
  const document = observable({
    styles: observable({ paragraph: { Normal: {}, ...paragraphStyles } }),
    sections: observable(sections),
  });
  const sequence = new PaperSequence();
  const component = new WordDocument({ document, measurer });
  component.renderOnto(sequence);
  return { document, sequence, component };
}

// Each page: its lines, as text with the y of the line's top.
function pages(sequence) {
  return sequence.pages.map((page, index) =>
    sequence.linesOf(index).map((line) => line.runs.map((run) => run.text).join("") + "@" + line.top));
}

// The Paragraph components of the first section, in order.
function paragraphComponents(component) {
  const [firstSection] = component.currentBuild;
  return firstSection.currentBuild;
}

const counts = (components) => components.map((p) => [p.unobservable.breaks, p.unobservable.placements]);

// The word processor's model laid out with cascade.print: what its styles,
// sections and spans mean on the papers - and that a change to the model
// lays out only what it reaches.
describe("Laying out the word processor's model", function () {
  it("places paragraphs line by line, down the paper and onto the next", function () {
    const { sequence } = layOut([section([
      paragraph("aaaa bbbb cccc"),
      paragraph("dddd eeee"),
    ])]);
    assert.deepEqual(pages(sequence), [
      ["aaaa bbbb@1000", "cccc@6000", "dddd eeee@11000"],
    ]);
    const { sequence: longer } = layOut([section([
      paragraph("aaaa bbbb cccc"),
      paragraph("dddd eeee ffff gggg"),
    ])]);
    assert.deepEqual(pages(longer), [
      ["aaaa bbbb@1000", "cccc@6000", "dddd eeee@11000", "ffff gggg@16000"],
    ]);
    const { sequence: overflowing } = layOut([section([
      paragraph("aaaa bbbb cccc"),
      paragraph("dddd eeee ffff gggg hhhh"),
    ])]);
    assert.deepEqual(pages(overflowing), [
      ["aaaa bbbb@1000", "cccc@6000", "dddd eeee@11000", "ffff gggg@16000"],
      ["hhhh@1000"],
    ]);
  });

  it("positions every line on its paper, with its baseline, its paragraph and its place in it", function () {
    const first = paragraph("aaaa bbbb cccc");
    const { sequence } = layOut([section([first])]);
    const [line0, line1] = sequence.linesOf(0);
    assert.equal(line0.x, 1000);
    assert.equal(line0.baseline, 5000);
    assert.equal(line1.paragraph, first);
    assert.deepEqual([line1.index, line1.start, line1.end], [1, 10, 14]);
    assert.deepEqual(sequence.pages[0], { width: 12000, height: 22000, margins: margins(1000) });
  });

  it("spaces paragraphs apart - but not at the top of a paper", function () {
    const { sequence } = layOut([section([
      paragraph("aaaa bbbb cccc"),
      paragraph("dddd", "Spaced"),
      paragraph("eeee", "Spaced"),
    ])], { Spaced: { spaceBefore: 2000, spaceAfter: 1000 } });
    assert.deepEqual(pages(sequence), [
      ["aaaa bbbb@1000", "cccc@6000", "dddd@13000"],
      ["eeee@1000"],
    ]);
  });

  it("starts every section on a paper of its own", function () {
    const letterSized = { width: 14000, height: 22000 };
    const { sequence } = layOut([
      section([paragraph("aaaa")]),
      section([paragraph("bbbb")], letterSized),
    ]);
    assert.deepEqual(pages(sequence), [["aaaa@1000"], ["bbbb@1000"]]);
    assert.equal(sequence.pages[1].width, 14000);
  });

  it("breaks only the edited paragraph again - and places nothing after it again if it ends where it did", function () {
    const edited = paragraph("aaaa bbbb");
    const { sequence, component } = layOut([section([
      edited,
      paragraph("cccc"),
      paragraph("dddd"),
    ])]);
    const components = paragraphComponents(component);
    assert.deepEqual(counts(components), [[1, 1], [1, 1], [1, 1]]);

    edited.spans[0].text = "aaaa bbbbb";
    assert.deepEqual(counts(components), [[2, 2], [1, 1], [1, 1]]);
    assert.deepEqual(pages(sequence), [["aaaa bbbbb@1000", "cccc@6000", "dddd@11000"]]);
  });

  it("places the paragraphs after an edit that adds a line again, without breaking them again", function () {
    const edited = paragraph("aaaa bbbb");
    const { sequence, component } = layOut([section([
      edited,
      paragraph("cccc"),
      paragraph("dddd"),
    ])]);
    const components = paragraphComponents(component);

    edited.spans[0].text = "aaaa bbbb cccc dddd";
    assert.deepEqual(counts(components), [[2, 2], [1, 2], [1, 2]]);
    assert.deepEqual(pages(sequence), [
      ["aaaa bbbb@1000", "cccc dddd@6000", "cccc@11000", "dddd@16000"],
    ]);

    edited.spans[0].text = "aaaa bbbb cccc dddd eeee";
    assert.deepEqual(counts(components), [[3, 3], [1, 3], [1, 3]]);
    assert.deepEqual(pages(sequence), [
      ["aaaa bbbb@1000", "cccc dddd@6000", "eeee@11000", "cccc@16000"],
      ["dddd@1000"],
    ]);

    // And back: the paper the last paragraph ran onto is gone again.
    edited.spans[0].text = "aaaa";
    assert.deepEqual(pages(sequence), [["aaaa@1000", "cccc@6000", "dddd@11000"]]);
    assert.equal(sequence.linesOf(1).length, 0);
  });

  it("keeps the other paragraphs' lines when one is inserted", function () {
    const { document, sequence, component } = layOut([section([
      paragraph("bbbb"),
      paragraph("cccc"),
    ])]);
    const [b, c] = paragraphComponents(component);

    document.sections[0].paragraphs.unshift(paragraph("aaaa"));
    assert.deepEqual(pages(sequence), [["aaaa@1000", "bbbb@6000", "cccc@11000"]]);
    const [a, b2, c2] = paragraphComponents(component);
    assert.equal(b2, b);
    assert.equal(c2, c);
    assert.deepEqual(counts([a, b, c]), [[1, 1], [1, 2], [1, 2]]);
  });

  it("takes a removed paragraph's lines off the paper, and stops breaking it", function () {
    const removed = paragraph("bbbb");
    const { document, sequence, component } = layOut([section([
      paragraph("aaaa"),
      removed,
      paragraph("cccc"),
    ])]);
    const [, gone] = paragraphComponents(component);
    document.sections[0].paragraphs.splice(1, 1);
    assert.deepEqual(pages(sequence), [["aaaa@1000", "cccc@6000"]]);
    removed.spans[0].text = "bbbb bbbb";
    assert.equal(gone.unobservable.breaks, 1);
  });

  it("breaks every paragraph again when the styles change", function () {
    const { document, sequence, component } = layOut([section([
      paragraph("aaaa bbbb"),
      paragraph("cccc"),
    ])]);
    document.styles.paragraph = { Normal: { indentLeft: 2000 } };
    assert.deepEqual(pages(sequence), [["aaaa@1000", "bbbb@6000", "cccc@11000"]]);
    assert.equal(sequence.linesOf(0)[0].x, 3000);
    assert.deepEqual(counts(paragraphComponents(component)), [[2, 2], [2, 2]]);
  });
});
