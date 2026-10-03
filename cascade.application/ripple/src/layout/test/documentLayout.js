import assert from "assert";
import { PaperSequence, pt } from "../../print/index.js";
import { document, section, paragraph, bold, sequence as sequenceOf, exitTitle } from "../../model/flows.js";
import { SequenceLayout, exitTitlePrefix } from "../DocumentLayout.js";
import { typography } from "../typography.js";
import { testDocument } from "../../model/testDocument.js";

// Every character 1000 µm wide, lines 5000 µm tall: a paper 22 x 42 mm with
// 1 mm margins holds 20 characters across and 8 lines down.
const measurer = {
  measure: (text) => text.length * 1000,
  metrics: () => ({ ascent: 4000, descent: 1000 }),
};
const paper = { width: 22000, height: 42000 };
const margins = { top: 1000, right: 1000, bottom: 1000, left: 1000 };

// No spacing, so lines fall on whole lines: only what the title level sets apart.
const plain = {
  body: { font: { family: "Body", size: 11, weight: 400, italic: false } },
  titles: [0, 1, 2, 3].map((depth) => ({ font: { family: "Title" + depth, size: 11, weight: 700, italic: depth >= 3 } })),
};

function layOut(doc, options = {}) {
  const sequence = new PaperSequence();
  new SequenceLayout({ sequence: sequenceOf(doc), measurer, typography: plain, ...options }).renderOnto(sequence);
  return sequence;
}

// Every line: its text, the font family it's set in, and its top.
const lines = (sequence) => sequence.pages.flatMap((format, page) =>
  sequence.linesOf(page).map((line) => [page, line.runs.map((run) => run.text).join(""), line.runs[0] ? line.runs[0].font.family : null, line.top]));

describe("Laying out a Ripple document", function () {
  it("renders every flow in reading order - a title by its section's title level, the rest as body text", function () {
    const doc = document({ title: "Book", paper, margins },
      paragraph("intro"),
      section("One", paragraph("text one"), section("One.one", paragraph("deep"))),
      section("Two"));
    assert.deepEqual(lines(layOut(doc)), [
      [0, "Book", "Title0", 1000],
      [0, "intro", "Body", 6000],
      [0, "One", "Title1", 11000],
      [0, "text one", "Body", 16000],
      [0, "One.one", "Title2", 21000],
      [0, "deep", "Body", 26000],
      [0, "Two", "Title1", 31000],
    ]);
  });

  it("styles a span on its own - bold, italic - and nothing else", function () {
    const doc = document({ title: "T", paper, margins }, paragraph("a ", bold("b")));
    const [, body] = layOut(doc).linesOf(0);
    assert.deepEqual(body.runs.map((run) => [run.text, run.font.weight]), [["a ", 400], ["b", 700]]);
  });

  it("flows onto the next paper - through the sections, as through anything", function () {
    const doc = document({ title: "Book", paper, margins },
      section("One", paragraph("aaaa"), paragraph("bbbb"), paragraph("cccc")),
      section("Two", paragraph("dddd"), paragraph("eeee"), paragraph("ffff")));
    const result = lines(layOut(doc));
    assert.deepEqual(result.map(([page, text]) => page + ":" + text),
      ["0:Book", "0:One", "0:aaaa", "0:bbbb", "0:cccc", "0:Two", "0:dddd", "0:eeee", "1:ffff"]);
  });

  it("follows the model: text edited, a section added and removed", function () {
    const intro = paragraph("intro");
    const doc = document({ title: "Book", paper, margins }, intro, section("One"));
    const sequence = layOut(doc);
    intro.spans[0].text = "introduction";
    doc.children.push(section("Two", paragraph("more")));
    assert.deepEqual(lines(sequence).map(([, text, family]) => text + "/" + family),
      ["Book/Title0", "introduction/Body", "One/Title1", "Two/Title1", "more/Body"]);
    doc.children.splice(1, 1);
    assert.deepEqual(lines(sequence).map(([, text]) => text), ["Book", "introduction", "Two", "more"]);
  });

  it("sets a title by its title level - a section's offset pushing it, and all inside it, further down", function () {
    const doc = document({ title: "Book", paper, margins, titleOffset: 1 },
      section({ title: "Deeper", titleOffset: 1 }, section("Inside")));
    assert.deepEqual(lines(layOut(doc)).map(([, text, family]) => text + "/" + family),
      ["Book/Title1", "Deeper/Title3", "Inside/Title3"]);  // levels 2, 4 and 5 - the last two as the deepest there is
  });

  it("shows an empty title as \"Title\", faintly - a placeholder, no text", function () {
    const doc = document({ title: "Book", paper, margins }, section("", paragraph("text")));
    const line = layOut(doc).linesOf(0)[1];
    assert.deepEqual(line.runs.map((run) => [run.text, !!run.placeholder]), [["Title", true]]);
    assert.equal(line.start, 0);
    assert.equal(line.end, 0);
    assert.ok(line.width > 0);
  });

  it("gives a section followed by a sibling of a lower title level an exit title - one level below its own - and takes it away when they no longer are", function () {
    const deep = section({ title: "Deep", titleOffset: 1 }, paragraph("in deep"));
    const doc = document({ title: "Book", paper, margins }, deep, section("Next"));
    const sequence = layOut(doc);
    assert.deepEqual(lines(sequence).map(([, text, family]) => text + "/" + family),
      ["Book/Title0", "Deep/Title2", "in deep/Body", exitTitlePrefix + "Deep/Title3", "Next/Title1"]);
    const exit = sequence.linesOf(0)[3];
    assert.equal(exit.paragraph, exitTitle(deep));
    deep.titleOffset = 0;
    assert.deepEqual(lines(sequence).map(([, text]) => text), ["Book", "Deep", "in deep", "Next"]);
  });

  it("lays out the test document with the real typography", function () {
    const sequence = new PaperSequence();
    new SequenceLayout({ sequence: sequenceOf(testDocument()), measurer }).renderOnto(sequence);
    const all = sequence.pages.flatMap((format, page) => sequence.linesOf(page));
    assert.ok(sequence.pages.length >= 1);
    // The document's title, largest and centered; a chapter's below it.
    assert.equal(all[0].runs[0].font.size, typography.titles[0].font.size);
    assert.equal(all[0].runs[0].text, "Ripple");
    assert.ok(all[0].x > margins.left);
    assert.ok(all.some((line) => line.runs.length > 0 && line.runs[0].font.size === typography.titles[1].font.size));
    assert.equal(typography.body.spaceAfter, pt(6));
  });
});
