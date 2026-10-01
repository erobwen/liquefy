import assert from "assert";
import { Component, observable } from "@liquefy/cascade.component";
import { Section, contentWidth } from "../Section.js";
import { Paragraph } from "../Paragraph.js";
import { GapMarker } from "../GapMarker.js";
import { PaperSequence } from "../PaperSequence.js";
import { margins } from "../units.js";
import {
  position, gapPosition, isGapPosition, samePosition, caretRows, caretAt, hitTest, stepLeft, stepRight,
  rowAbove, rowBelow, sequenceStart, sequenceEnd, comparePositions, selectionRects,
} from "../positions.js";
import { measurer, font } from "./support/plainText.js";

// A list of plain paragraphs with a gap before, between and after them - as
// a model marks the places between its parts. 10 characters across a paper,
// lines 5000 µm tall; paragraphs 2000 µm apart, the gaps' carets 2000 tall.
class Note extends Paragraph {
  content() {
    return { spans: [{ text: this.source.text, font }], font, spaceAfter: 2000 };
  }
}

class Notes extends Section {
  setProperties({ list }) {
    this.list = list;
  }
  pageFormat() {
    return { width: 12000, height: 40000, margins: margins(1000) };
  }
  build() {
    const format = this.pageFormat();
    const width = contentWidth(format);
    const gap = (index) => new GapMarker({ key: "gap" + index, position: gapPosition(this.list, index), x: -500, height: 2000, format });
    const built = [gap(0)];
    this.list.items.forEach((item, index) => {
      built.push(new Note({ key: "note" + item.causality.id, source: item, width, format }), gap(index + 1));
    });
    return built;
  }
}

class Root extends Component {
  provide() {
    return { textMeasurer: measurer };
  }
  build() {
    return new Notes({ list: this.list });
  }
}

function layOut(texts) {
  const list = observable({ items: observable(texts.map((text) => observable({ text }))) });
  const sequence = new PaperSequence();
  new Root({ list }).renderOnto(sequence);
  return { list, sequence, items: list.items };
}

// Every caret row: a line's text, or the gap's index - with its top.
const rows = (sequence) => caretRows(sequence).map(({ row }) =>
  ("gap" in row ? "gap" + row.gap.index : row.runs.map((run) => run.text).join("")) + "@" + row.top);

const describePosition = (at) => isGapPosition(at) ? "gap" + at.index : at.paragraph.text + ":" + at.offset;

describe("Gaps between a model's parts", function () {
  it("are marked among the lines, in reading order - taking no room", function () {
    const { sequence } = layOut(["aa", "bb cc dd ee"]);
    assert.deepEqual(rows(sequence), ["gap0@1000", "aa@1000", "gap1@6000", "bb cc dd@8000", "ee@13000", "gap2@18000"]);
    // The lines are where they'd be without them.
    assert.deepEqual(sequence.linesOf(0).map((line) => line.top), [1000, 8000, 13000]);
  });

  it("have a caret where their marker is", function () {
    const { sequence, list } = layOut(["aa"]);
    assert.deepEqual(caretAt(sequence, gapPosition(list, 1), measurer), { page: 0, x: 500, top: 6000, height: 2000, gap: true });
    assert.ok(samePosition(gapPosition(list, 1), gapPosition(list, 1)));
    assert.ok(!samePosition(gapPosition(list, 1), gapPosition(list, 0)));
  });

  it("are stepped through with Left and Right, as every place in the text is", function () {
    const { sequence, items } = layOut(["ab", "cd"]);
    const walk = [];
    let at = sequenceStart(sequence);
    for (let i = 0; i < 12; i++) {
      walk.push(describePosition(at));
      const next = stepRight(sequence, at);
      if (samePosition(next, at)) break;
      at = next;
    }
    assert.deepEqual(walk, ["gap0", "ab:0", "ab:1", "ab:2", "gap1", "cd:0", "cd:1", "cd:2", "gap2"]);
    assert.ok(samePosition(at, sequenceEnd(sequence)));
    // And back.
    const back = [];
    for (let i = 0; i < 12; i++) {
      back.push(describePosition(at));
      const previous = stepLeft(sequence, at);
      if (samePosition(previous, at)) break;
      at = previous;
    }
    assert.deepEqual(back, walk.slice().reverse());
    assert.equal(items.length, 2);
  });

  it("step through a paragraph broken over lines without stopping twice at the break", function () {
    const { sequence } = layOut(["aaaa bbbb cc"]);
    const walk = [];
    let at = sequenceStart(sequence);
    for (let i = 0; i < 20; i++) {
      walk.push(describePosition(at));
      const next = stepRight(sequence, at);
      if (samePosition(next, at)) break;
      at = next;
    }
    // "aaaa bbbb " / "cc": 10, the start of the second line, once.
    assert.deepEqual(walk.filter((place) => place === "aaaa bbbb cc:10"), ["aaaa bbbb cc:10"]);
    assert.equal(walk.length, 1 + 13 + 1);
  });

  it("are rows for Up and Down", function () {
    const { sequence, items, list } = layOut(["aa", "bb"]);
    const fromA = position(items[0], 1);
    assert.ok(samePosition(rowBelow(sequence, fromA, 2000, measurer), gapPosition(list, 1)));
    assert.equal(describePosition(rowBelow(sequence, gapPosition(list, 1), 2000, measurer)), "bb:1");
    assert.ok(samePosition(rowAbove(sequence, fromA, 2000, measurer), gapPosition(list, 0)));
  });

  it("are found by a click between the lines - a click on a line finds the line", function () {
    const { sequence, list } = layOut(["aa", "bb"]);
    // Between "aa" (1000-6000) and "bb" (8000-13000): the gap at 6000.
    assert.ok(samePosition(hitTest(sequence, 0, 2000, 7000, measurer), gapPosition(list, 1)));
    assert.equal(describePosition(hitTest(sequence, 0, 2000, 3000, measurer)), "aa:1");
    assert.equal(describePosition(hitTest(sequence, 0, 2000, 9000, measurer)), "bb:1");
  });

  it("order with the text, and can end a selection", function () {
    const { sequence, items, list } = layOut(["aa", "bb"]);
    assert.ok(comparePositions(sequence, position(items[0], 2), gapPosition(list, 1)) < 0);
    assert.ok(comparePositions(sequence, gapPosition(list, 2), position(items[1], 0)) > 0);
    // From the gap before "aa" to the one between: all of "aa", and its
    // paragraph break.
    assert.deepEqual(selectionRects(sequence, gapPosition(list, 0), gapPosition(list, 1), measurer),
      [{ page: 0, x: 1000, top: 1000, width: 3000, height: 5000 }]);
  });

  it("follow the model - a part inserted, and the gaps after it", function () {
    const { sequence, items } = layOut(["aa", "bb"]);
    items.splice(1, 0, observable({ text: "new" }));
    assert.deepEqual(rows(sequence), ["gap0@1000", "aa@1000", "gap1@6000", "new@8000", "gap2@13000", "bb@15000", "gap3@20000"]);
  });
});
