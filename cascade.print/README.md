# cascade.print

Cascade for print: a document's model laid out reactively onto a sequence of
papers - paragraphs broken into lines and placed page by page. No DOM: every
length is an integer in micrometers, and text is measured by whatever measurer
the document is given.

```js
import { observable } from "@liquefy/cascade.component";
import { PrintDocument, PaperSequence, monospaceMeasurer, paperSizes, margins, mm, pt } from "@liquefy/cascade.print";

const document = observable({
  styles: observable({
    paragraph: {
      Normal: { font: { family: "Georgia", size: 11 }, spaceAfter: pt(8) },
      Heading1: { basedOn: "Normal", font: { size: 18, weight: 700 }, spaceBefore: pt(12) },
    },
    character: { Strong: { font: { weight: 700 } } },
  }),
  sections: observable([observable({
    paper: paperSizes.A4,
    margins: margins(mm(25)),
    paragraphs: observable([
      observable({ style: "Heading1", spans: observable([observable({ text: "Hello" })]) }),
      observable({ style: "Normal", spans: observable([
        observable({ text: "A " }),
        observable({ text: "bold", style: "Strong" }),
        observable({ text: " word." }),
      ]) }),
    ]),
  })]),
});

const papers = new PaperSequence();
new PrintDocument({ document, measurer: monospaceMeasurer() }).renderOnto(papers);
papers.pages.length;   // how many papers
papers.linesOf(0);     // the lines on the first, positioned on it
```

## The model

Word's: sections (a paper size and margins each), each a sequence of
paragraphs; a paragraph refers to a paragraph style and holds spans, each with
its own character style or font. Styles resolve as in Word - defaults, the
paragraph style and those it is based on, the character style, the span's own
font (see `src/styles.js`).

## Two steps per paragraph

A paragraph is laid out in two repeaters of its own (see `src/Paragraph.js`):

1. **Breaking into lines** - measured and divided for the width it's given.
   Independent of where the paragraph is placed, so it reruns only when its
   text, the styles or the width change.
2. **Placing the lines** - its render, onto the paper sequence, from where
   the paragraph before it left off (`PaperSequence.flow`), onto a new paper
   when one is full.

So an edit breaks one paragraph again, and the paragraphs after it are only
placed again - and only until one ends where it did before.

## Measurers

A measurer answers `measure(text, font)` (a width) and `metrics(font)` (`{
ascent, descent }`), in µm. `monospaceMeasurer()` needs no fonts, for tests
and anywhere without a browser.
