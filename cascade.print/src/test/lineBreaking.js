import assert from "assert";
import { breakIntoLines } from "../lineBreaking.js";

// Every character 1000 µm wide, whatever the font; lines 5000 µm tall.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};

const font = { family: "Georgia", size: 10, weight: 400, italic: false };
const bold = { ...font, weight: 700 };

// Spans as { text } - or { text, style: "Strong" }, in bold.
function lines(spans, width, layout = {}) {
  const resolved = spans.map((span) => ({ text: span.text, font: span.style === "Strong" ? bold : font }));
  return breakIntoLines({ spans: resolved, font, width, measurer, ...layout });
}

const texts = (result) => result.map((line) => line.runs.map((run) => run.text).join(""));

describe("breakIntoLines()", function () {
  it("fills lines word by word, breaking at whitespace", function () {
    const result = lines([{ text: "aaa bbb ccc dd" }], 7000);
    assert.deepEqual(texts(result), ["aaa bbb", "ccc dd"]);
    assert.deepEqual(result.map((line) => line.width), [7000, 6000]);
  });

  it("keeps the whitespace at a break in the line's range, not in its runs or width", function () {
    const result = lines([{ text: "aaa bbb" }], 5000);
    assert.deepEqual(texts(result), ["aaa", "bbb"]);
    assert.deepEqual(result.map((line) => [line.start, line.end]), [[0, 4], [4, 7]]);
    assert.equal(result[0].width, 3000);
    // What a caret after it, or a selection through it, needs to know.
    assert.deepEqual(result.map((line) => [line.trailing, line.last]), [[" ", false], ["", true]]);
  });

  it("doesn't break a word that crosses spans - and gives each font a run of its own", function () {
    const result = lines([{ text: "aa bo" }, { text: "ld", style: "Strong" }, { text: "er cc" }], 7000);
    assert.deepEqual(texts(result), ["aa", "bolder", "cc"]);
    assert.deepEqual(result[1].runs.map((run) => [run.text, run.font.weight, run.x, run.start]),
      [["bo", 400, 0, 3], ["ld", 700, 2000, 5], ["er", 400, 4000, 7]]);
  });

  it("breaks a word wider than a line between characters", function () {
    const result = lines([{ text: "abcdefghij kl" }], 4000);
    assert.deepEqual(texts(result), ["abcd", "efgh", "ij", "kl"]);
    assert.deepEqual(result.map((line) => [line.start, line.end]), [[0, 4], [4, 8], [8, 11], [11, 13]]);
  });

  it("gives an empty paragraph one line, as tall as its font", function () {
    const result = lines([], 4000);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].runs, []);
    assert.equal(result[0].height, 5000);
  });

  it("indents, aligns and spaces lines as the paragraph style says", function () {
    const indented = lines([{ text: "aa bb cc" }], 8000, { indentLeft: 1000, indentRight: 1000, firstLineIndent: 2000 });
    assert.deepEqual(texts(indented), ["aa", "bb cc"]);
    assert.deepEqual(indented.map((line) => line.x), [3000, 1000]);

    const centered = lines([{ text: "aa" }], 6000, { align: "center" });
    assert.equal(centered[0].x, 2000);
    const right = lines([{ text: "aa" }], 6000, { align: "right" });
    assert.equal(right[0].x, 4000);

    const spaced = lines([{ text: "aa" }], 6000, { lineSpacing: 1.5 });
    assert.equal(spaced[0].height, 7500);
    assert.equal(spaced[0].ascent, 4000);
  });
});
