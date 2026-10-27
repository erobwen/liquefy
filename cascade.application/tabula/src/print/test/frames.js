import assert from "assert";
import { breakIntoLines, runPrefixWidth } from "../lineBreaking.js";

// Every character 1000 µm wide, whatever the font; lines 5000 µm tall.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};

const font = { family: "Georgia", size: 10, weight: 400, italic: false };
const anchor = String.fromCharCode(0xfffc);
const frame = (placement, width, height) => ({ text: anchor, font, frame: { placement, width, height, source: placement } });
const textSpan = (text) => ({ text, font });

const lines = (spans, width) => breakIntoLines({ spans, font, width, measurer });
const texts = (result) => result.map((line) => line.runs.filter((run) => !run.frame).map((run) => run.text).join(""));

describe("breakIntoLines(), with frames", function () {
  it("puts a frame in line as a word as wide as it is, standing on the baseline - the line as tall as it", function () {
    const [line, ...rest] = lines([textSpan("aa "), frame("inline", 3000, 8000), textSpan(" bb")], 20000);
    assert.equal(rest.length, 0);
    assert.deepEqual([line.start, line.end, line.ascent, line.height], [0, 7, 8000, 9000]);
    assert.deepEqual(line.frames, [{ x: 3000, top: 0, width: 3000, height: 8000, source: "inline" }]);
    // One offset: a place before it and one after, its width apart.
    const run = line.runs.find((each) => each.frame);
    assert.deepEqual([run.start, runPrefixWidth(run, 0, measurer), runPrefixWidth(run, 1, measurer)], [3, 0, 3000]);
  });

  it("gives a frame on its own line a line of its own, centred - the text above and below it", function () {
    const result = lines([textSpan("aa "), frame("block", 6000, 10000), textSpan(" bb")], 20000);
    assert.deepEqual(texts(result), ["aa", "", "bb"]);
    const own = result[1];
    assert.deepEqual([own.start, own.end, own.x, own.height], [3, 5, 7000, 10000]);
    assert.deepEqual(own.frames, [{ x: 7000, top: 0, width: 6000, height: 10000, source: "block" }]);
  });

  it("flows the text around a frame at the side: the lines beside it narrower, the ones below it whole", function () {
    const result = lines([frame("left", 5000, 12000), textSpan("aaaa bbbb cccc dddd eeee")], 14000);
    // Beside it, room for 14000 - 5000 - a 4000 gap: one word a line, after it.
    assert.deepEqual(texts(result), ["aaaa", "bbbb", "cccc", "dddd eeee"]);
    assert.deepEqual(result.map((line) => line.x), [9000, 9000, 9000, 0]);
    assert.deepEqual(result[0].frames, [{ x: 0, top: 0, width: 5000, height: 12000, source: "left" }]);
    assert.equal(result[3].after, 0);
  });

  it("starts a frame at the side with the next line if there's text before it on its own - and ends the paragraph below it", function () {
    const result = lines([textSpan("aa "), frame("right", 5000, 12000)], 14000);
    assert.equal(result.length, 1);
    const [line] = result;
    // Below the line, at the right - the paragraph ending below it.
    assert.deepEqual(line.frames, [{ x: 9000, top: 5000, width: 5000, height: 12000, source: "right" }]);
    assert.equal(line.after, 12000);
  });
});
