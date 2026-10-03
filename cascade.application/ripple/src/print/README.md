# cascade.print - Ripple's copy

Ripple's own copy of `cascade.print` (`/cascade.print`), taken on 2026-10-02 so
Ripple can change it freely while it finds its shape - no need to ask whether a
change belongs in the shared package. Imported by path (`./index.js`,
`./dom.js` here), not as `@liquefy/cascade.print`; `src/` of the original is
flattened into this folder. What's below is the original's README, as it was;
whatever turns out reusable can be moved back later.

---

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

A position is a place in a paragraph's text - `{ paragraph, offset, lineEnd }`,
`paragraph` being a paragraph's `source` - never a place on paper, so a new
layout never makes it wrong (`src/positions.js`). Between positions and
papers: `hitTest()` - the place in the text nearest a point on a paper -
`caretAt()` and `selectionRects()` - where a place, or a stretch, of the text
is on the papers - and the moves that depend on the layout: `lineStart`,
`lineEnd`, `lineAbove`, `lineBelow`.

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
  knows nothing of the model: what an edit does is the model's, given as
  `editing` - `insertText`, `deleteBackward`, `deleteForward`,
  `splitParagraph`, `deleteBetween`, `moveLeft`, `moveRight`,
  `documentStart`, `documentEnd`, `orderedRange`, `wordAt`, `paragraphAt`,
  each taking and returning positions. For a toolbar: `selection()`,
  `apply(change)`, and `shortcuts`/`onShortcut` for Ctrl/Cmd plus a key.
- `printPaperSequence(sequence, { title })` - the browser's print dialog, one
  sheet per paper at its own size, printed from a hidden document of its own so
  nothing of the app around the papers gets onto paper.

The layout and the view are two roots: a model's sections rendered onto a
`PaperSequence`, and a view rendering that sequence onto the DOM (see the
demo's `WordProcessorPage`).
