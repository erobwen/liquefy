# cascade.print

Cascade for print: text laid out reactively onto a sequence of papers -
paragraphs broken into lines and placed page by page - shown, edited at a
caret, and printed. No DOM in the layout: every length is an integer in
micrometers, and text is measured by whatever measurer it's given.

cascade.print knows nothing of any document model. A model says what its
sections and paragraphs are - which paper a section is on, what a
paragraph's text and fonts are - and cascade.print does the rest. The
Cascade demo's word processor (`cascade.application/demo/src/pages/wordProcessor`)
is one such model: Word's, with paragraph and character styles.

```js
import { Component, observable } from "@liquefy/cascade.component";
import { Section, Paragraph, PaperSequence, contentWidth, monospaceMeasurer, paperSizes, margins, mm } from "@liquefy/cascade.print";

const font = { family: "Georgia, serif", size: 11, weight: 400, italic: false };

// A paragraph of the model: what it's made of.
class NoteParagraph extends Paragraph {
  content() {
    return { spans: [{ text: this.source.text, font }], font, spaceAfter: mm(3) };
  }
}

// A section of the model: its paper, and its paragraphs on it.
class NotesSection extends Section {
  pageFormat() {
    return { ...paperSizes.A4, margins: margins(mm(25)) };
  }
  build() {
    const format = this.pageFormat();
    return this.notes.map((note) =>
      new NoteParagraph({ key: note.id, source: note, width: contentWidth(format), format }));
  }
}

// The measurer, provided to the paragraphs as `textMeasurer`.
class Notes extends Component {
  provide() {
    return { textMeasurer: monospaceMeasurer() };
  }
  build() {
    return new NotesSection({ notes: this.notes });
  }
}

const papers = new PaperSequence();
new Notes({ notes: observable([observable({ id: "a", text: "Hello, paper." })]) }).renderOnto(papers);
papers.pages.length;   // how many papers
papers.linesOf(0);     // the lines on the first, positioned on it
```

## Two steps per paragraph

A `Paragraph` is laid out in two repeaters of its own (see `src/Paragraph.js`):

1. **Breaking into lines** - its `content()` measured and divided for the
   width it's given. Independent of where the paragraph is placed, so it
   reruns only when what content() read changes, or the width.
2. **Placing the lines** - its render, onto the paper sequence, from where
   the paragraph before it left off (`PaperSequence.flow`), onto a new paper
   when one is full.

So an edit breaks one paragraph again, and the paragraphs after it are only
placed again - and only until one ends where it did before.

`content()` returns the paragraph's text with its fonts already resolved,
and how it's laid out:

```js
{
  spans: [{ text, font }],   // font: { family, size, weight, italic }, size in points
  font,                      // the paragraph's own - the height of an empty one
  align, lineSpacing, indentLeft, indentRight, firstLineIndent, spaceBefore, spaceAfter,
}
```

Every placed line keeps the paragraph's `source` - typically the model's own
paragraph object - and its range in the paragraph's text: what positions
refer to.

## Positions

A position is a place a caret can be (`src/positions.js`), of two kinds:

- In a paragraph's text - `{ paragraph, offset, lineEnd }`, `paragraph` being
  a paragraph's `source`.
- A gap between a model's parts - `gapPosition(list, index)`: before item
  `index` of `list`, whatever the model's list is. A model marks its gaps on the
  papers with `GapMarker` components among its paragraphs: each places a caret
  row where the text has got to, and takes no room. One gap belongs to one
  list, so "after A" and "before B" are the same gap, and the end of a nested
  list and the place after it are two - told apart by the `x` the model gives
  their markers.

Neither is a place on paper, so a new layout never makes one wrong. Besides
its lines, the paper sequence keeps **caret rows** (`rowsOf(page)`): every
line, and every gap, in reading order. Everything the caret does works on
them:

- `caretAt()`, `selectionRects()` - where a place, or a stretch, is on the
  papers.
- `hitTest()` - the place nearest a point: on the line it's on, or the nearest
  row; of gaps the same way away, the nearest across.
- `stepLeft`, `stepRight` - through every place in reading order, gaps
  included; `rowAbove`, `rowBelow` - up and down, gaps being rows;
  `lineStart`, `lineEnd`; `sequenceStart`, `sequenceEnd`.
- `comparePositions`, `orderedRange` - reading order, for selections.

None of this needs the model: `PaperEditor` moves its caret with them, so a
model only gives it its edits.

## Measurers

A measurer answers `measure(text, font)` (a width) and `metrics(font)`
(`{ ascent, descent }`), in µm. `monospaceMeasurer()` needs no fonts, for
tests and anywhere without a browser.

## In the browser

`@liquefy/cascade.print/dom` (needs `@liquefy/cascade.dom`):

- `domMeasurer()` - measures text on a canvas; the DOM as a measuring device
  only. A font finishing loading makes every paragraph break its lines again.
- `paperSequenceView({ sequence, zoom })` - the papers on screen, at their real
  size (µm become CSS millimeters), white with a shadow on grey. Each paper
  reads only its own lines.
- `paperEditor({ sequence, measurer, editing, zoom })` - the papers with a
  caret and a selection: click, drag, Shift, double and triple click, the
  arrows, Home, End, Ctrl/Cmd+A; typing, Backspace, Delete, Enter. Keyboard
  input goes through a hidden textarea, so input methods work. The editor
  knows nothing of the model: the caret moves through the caret rows (see
  Positions), and what an edit does is the model's, given as `editing` -
  `insertText`, `deleteBackward`, `deleteForward`, `splitParagraph`,
  `deleteBetween`, `wordAt`, `paragraphAt`, each taking and returning
  positions. Without `editing`, it's a caret only. For a toolbar: `selection()`,
  `apply(change)`, and `shortcuts`/`onShortcut` for Ctrl/Cmd plus a key.
- `printPaperSequence(sequence, { title })` - the browser's print dialog, one
  sheet per paper at its own size, printed from a hidden document of its own so
  nothing of the app around the papers gets onto paper.

The layout and the view are two roots: a model's sections rendered onto a
`PaperSequence`, and a view rendering that sequence onto the DOM (see the
demo's `WordProcessorPage`).
