import { pt } from "../print/index.js";

/**
 * How a document looks - by where a flow is, since flows hold no style of
 * their own (see ../model/flows.js): body text, and a section's title by its
 * title level - a document's own title (1), a chapter's (2), a section in it
 * (3), and every level deeper (4 and on).
 *
 * Each is a paragraph's layout for cascade.print (see its Paragraph.js):
 * `font` - what a span is set in, unless it's bold or italic itself - and
 * align, lineSpacing, spaceBefore, spaceAfter, indents. And
 * `paragraphIndent`: in a document indenting its paragraphs rather than
 * spacing them apart, how far in the first line of a paragraph following
 * another goes.
 */
const serif = "Georgia, 'Times New Roman', serif";
const sans = "'Helvetica Neue', Arial, sans-serif";
const font = (family, size, weight = 400, italic = false) => Object.freeze({ family, size, weight, italic });

export const typography = Object.freeze({
  body: Object.freeze({ font: font(serif, 11), lineSpacing: 1.15, spaceAfter: pt(6) }),
  paragraphIndent: pt(16),
  titles: Object.freeze([
    Object.freeze({ font: font(sans, 24, 700), align: "center", spaceAfter: pt(24) }),
    Object.freeze({ font: font(sans, 17, 700), spaceBefore: pt(18), spaceAfter: pt(8) }),
    Object.freeze({ font: font(sans, 13.5, 700), spaceBefore: pt(14), spaceAfter: pt(5) }),
    Object.freeze({ font: font(sans, 11, 700, true), spaceBefore: pt(10), spaceAfter: pt(3) }),
  ]),
});

// The title at a title level - 1 the highest.
export function titleStyle(typography, level) {
  const { titles } = typography;
  return titles[Math.max(0, Math.min(level - 1, titles.length - 1))];
}
