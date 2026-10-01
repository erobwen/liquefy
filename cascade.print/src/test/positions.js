import assert from "assert";
import { observable } from "@liquefy/cascade.component";
import { PrintDocument } from "../PrintDocument.js";
import { PaperSequence } from "../PaperSequence.js";
import { margins } from "../units.js";
import { position } from "../editing.js";
import { caretAt, hitTest, lineStart, lineEnd, lineAbove, lineBelow } from "../positions.js";

// Every character 1000 µm wide; lines 5000 µm tall, baseline 4000 down. A
// paper 12 x 22 mm with 1 mm margins: 10 characters across, 4 lines down.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};

const paragraph = (text) => observable({ style: "Normal", spans: observable([observable({ text })]) });

function layOut(paragraphs) {
  const document = observable({
    styles: observable({ paragraph: { Normal: {} } }),
    sections: observable([observable({ paper: { width: 12000, height: 22000 }, margins: margins(1000), paragraphs: observable(paragraphs) })]),
  });
  const sequence = new PaperSequence();
  new PrintDocument({ document, measurer }).renderOnto(sequence);
  return sequence;
}

describe("Positions on the papers", function () {
  // "aaaa bbbb " / "cccc" - broken after the space at 10.
  const first = paragraph("aaaa bbbb cccc");
  const second = paragraph("dd ee ff gg hh");
  const sequence = layOut([first, second, paragraph("x"), paragraph("y")]);

  it("puts the caret between characters, on its line", function () {
    assert.deepEqual(caretAt(sequence, position(first, 0), measurer), { page: 0, x: 1000, top: 1000, height: 5000 });
    assert.deepEqual(caretAt(sequence, position(first, 3), measurer), { page: 0, x: 4000, top: 1000, height: 5000 });
    assert.deepEqual(caretAt(sequence, position(first, 12), measurer), { page: 0, x: 3000, top: 6000, height: 5000 });
  });

  it("puts a position at a line break at the start of the next line - or, at a line end, after the space it was broken at", function () {
    assert.deepEqual(caretAt(sequence, position(first, 10), measurer), { page: 0, x: 1000, top: 6000, height: 5000 });
    assert.deepEqual(caretAt(sequence, position(first, 10, true), measurer), { page: 0, x: 11000, top: 1000, height: 5000 });
  });

  it("finds the place in the text nearest a point - on the nearest line, past either end of it", function () {
    assert.deepEqual(hitTest(sequence, 0, 3400, 2000, measurer), position(first, 2));
    assert.deepEqual(hitTest(sequence, 0, 3600, 2000, measurer), position(first, 3));
    assert.deepEqual(hitTest(sequence, 0, 0, 0, measurer), position(first, 0));
    // Past the end of a broken line: after the space, at its end.
    assert.deepEqual(hitTest(sequence, 0, 11500, 2000, measurer), position(first, 10, true));
    // Past the end of a paragraph's last line.
    assert.deepEqual(hitTest(sequence, 0, 11500, 7000, measurer), position(first, 14));
    // On the next paper - "x", then "y".
    assert.equal(hitTest(sequence, 1, 1000, 1000, measurer).paragraph.spans[0].text, "x");
    assert.equal(hitTest(sequence, 1, 1000, 9000, measurer).paragraph.spans[0].text, "y");
  });

  it("goes to the start and end of a line", function () {
    assert.deepEqual(lineStart(sequence, position(first, 12)), position(first, 10));
    assert.deepEqual(lineEnd(sequence, position(first, 2)), position(first, 10, true));
    assert.deepEqual(lineEnd(sequence, position(first, 12)), position(first, 14));
  });

  it("goes up and down a line at a goal x - onto the next paper, and to the very start and end beyond", function () {
    assert.deepEqual(lineBelow(sequence, position(first, 3), 4000, measurer), position(first, 13));
    // Past the end of the shorter line: its end.
    assert.deepEqual(lineBelow(sequence, position(first, 8), 9000, measurer), position(first, 14));
    // From that short line, back up at the goal x.
    assert.deepEqual(lineAbove(sequence, position(first, 14), 9000, measurer), position(first, 8));
    assert.deepEqual(lineAbove(sequence, position(first, 3), 4000, measurer), position(first, 0));
    // From the last line on the first paper ("gg hh") to the first on the
    // next ("x"), and back.
    const [x, y] = sequence.linesOf(1).map((line) => line.paragraph);
    assert.deepEqual(lineBelow(sequence, position(second, 9), 1000, measurer), position(x, 0));
    assert.deepEqual(lineAbove(sequence, position(x, 0), 3000, measurer), position(second, 11));
    assert.deepEqual(lineBelow(sequence, position(y, 0), 1000, measurer), position(y, 1));
  });
});
