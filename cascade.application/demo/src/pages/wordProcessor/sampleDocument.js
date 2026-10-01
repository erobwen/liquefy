import { observable } from "@liquefy/cascade.component";
import { paperSizes, margins, mm, pt } from "@liquefy/cascade.print";

// The word processor's styles - Word's model: paragraph styles, based on
// one another, and character styles for spans within a paragraph.
const serif = "Georgia, 'Times New Roman', serif";
const sans = "'Helvetica Neue', Arial, sans-serif";

const styles = {
  paragraph: {
    Normal: { font: { family: serif, size: 11 }, lineSpacing: 1.15, spaceAfter: pt(6) },
    Title: { basedOn: "Normal", font: { family: sans, size: 26, weight: 700 }, align: "center", spaceAfter: pt(4) },
    Subtitle: { basedOn: "Normal", font: { family: sans, size: 13, italic: true }, align: "center", spaceAfter: pt(24) },
    Heading1: { basedOn: "Normal", font: { family: sans, size: 16, weight: 700 }, spaceBefore: pt(18), spaceAfter: pt(6) },
    Heading2: { basedOn: "Heading1", font: { size: 13 }, spaceBefore: pt(12), spaceAfter: pt(4) },
    Quote: { basedOn: "Normal", font: { italic: true }, indentLeft: mm(12), indentRight: mm(12), spaceBefore: pt(6), spaceAfter: pt(12) },
    Body: { basedOn: "Normal", firstLineIndent: mm(6) },
  },
  character: {
    Strong: { font: { weight: 700 } },
    Emphasis: { font: { italic: true } },
    Code: { font: { family: "'Courier New', monospace", size: 10 } },
  },
};

// A paragraph: its style, then its spans - a string for plain text, or
// [style, text] for a span in a character style.
function paragraph(style, ...spans) {
  return observable({
    style,
    spans: observable(spans.map((span) => observable(typeof(span) === "string" ? { text: span } : { style: span[0], text: span[1] }))),
  });
}

export function sampleDocument() {
  return observable({
    styles: observable(styles),
    sections: observable([observable({
      paper: paperSizes.A4,
      margins: margins(mm(25)),
      paragraphs: observable([
        paragraph("Title", "Temporal Signals on Paper"),
        paragraph("Subtitle", "A word processor laid out by cascade.print"),

        paragraph("Heading1", "What you are looking at"),
        paragraph("Normal",
          "This document is a model - a sequence of paragraphs, each referring to a paragraph style, each holding spans of text with styles of their own. ",
          "It is laid out onto a ", ["Strong", "paper sequence"], ": a render target with no DOM in it at all, where every length is a whole number of micrometers. ",
          "What you see is that paper sequence drawn: each paper at its real size, white on grey, and the text placed on it line by line."),
        paragraph("Body",
          "The browser is only asked how wide a piece of text is, and how far a font reaches above and below its baseline. ",
          "Everything else - which word goes on which line, which line goes on which paper - is decided by cascade.print itself, ",
          "so the layout is exactly the same whether it is shown on screen, sent to a printer, or tested without any browser at all."),

        paragraph("Heading1", "Two steps for every paragraph"),
        paragraph("Normal",
          "A paragraph is laid out in two steps, each a repeater of its own. ",
          "The first ", ["Emphasis", "breaks it into lines"], ": its text is measured and divided for the width it is given. ",
          "That step does not know, or care, where on the paper the paragraph ends up."),
        paragraph("Body",
          "The second ", ["Emphasis", "places the lines"], ": it starts from wherever the paragraph before it left off, puts its lines down one after another, ",
          "and moves on to a new paper when one is full. It is the paragraph's render, onto the paper sequence - a temporal render target, ",
          "where every paragraph sees the paper sequence as the paragraphs before it left it."),
        paragraph("Quote",
          "Typing in one paragraph breaks only that paragraph into lines again. The paragraphs after it are only placed again - ",
          "and only until one of them ends up exactly where it was before. From there on, nothing is touched."),

        paragraph("Heading2", "Why it stops"),
        paragraph("Body",
          "What a paragraph leaves for the next is a frozen value: the paper it ended on, how far down it, and the space it wants after itself. ",
          "Frozen values are compared by content, not by identity. So when a paragraph is placed again and ends where it did before, ",
          "the next paragraph reads the same value it read last time - and has nothing to do."),

        paragraph("Heading1", "Micrometers"),
        paragraph("Normal",
          "Every length on the paper sequence is an integer in micrometers, a thousandth of a millimeter. ",
          "An A4 paper is ", ["Code", "210000 x 297000"], ", a US Letter ", ["Code", "215900 x 279400"], " - both exact. ",
          "Whole numbers add up exactly, so whether a line still fits at the bottom of a paper never depends on a rounding error."),
        paragraph("Body",
          "Font sizes alone are kept in points, as typography does. Shown on screen, micrometers become CSS millimeters - ",
          "so a paper is drawn at its real size, and zooming scales it as a whole."),

        paragraph("Heading1", "Papers"),
        paragraph("Normal",
          "Switch between A4 and Letter above: the section's paper changes, every paragraph gets a new width, ",
          "and the whole document is broken into lines and placed again. Zoom in and out: nothing is laid out again at all, ",
          "it is only drawn at another scale."),
        paragraph("Body",
          "Print sends the papers to the browser's print dialog, one sheet per paper, each the size of its paper and nothing around it. ",
          "What comes out of the printer is what is on the screen, because it is the same drawing of the same paper sequence."),

        paragraph("Heading1", "Typing"),
        paragraph("Normal",
          "Click anywhere in this text and start typing. Every line placed on a paper knows the paragraph it came from and which part of its text it holds, ",
          "so a click on a paper is turned into a place in the text, and the caret's place in the text back into a place on a paper. ",
          "An edit changes the model, the paragraph is laid out again - and the caret is drawn wherever the new layout puts it."),
        paragraph("Heading1", "What comes next"),
        paragraph("Body",
          "Selection, then the rules that look ahead - a heading that should never be the last thing on a paper, page numbers, ",
          "\"page 3 of 7\". Those are the interesting ones for temporal signals, since a paragraph can only see what came before it."),
        paragraph("Body",
          "Until then, this is a fine place to try things. Open the code button above to see how the page is put together, ",
          "or read cascade.print's own README for the model, the two steps, and the measurers."),
      ]),
    })]),
  });
}
