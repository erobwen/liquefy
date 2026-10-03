import { pt } from "../print/index.js";

/**
 * How a document looks - by where a part is, since parts hold no style of
 * their own (see ../model/parts.js): body text, and a section's title by how
 * deep the section is - the document's own title (0), a chapter's (1), a
 * section in it (2), and every level deeper (3 and on).
 *
 * Each is a paragraph's layout for cascade.print (see its Paragraph.js):
 * `font` - what a span is set in, unless it's bold or italic itself - and
 * align, lineSpacing, spaceBefore, spaceAfter, indents.
 */
const serif = "Georgia, 'Times New Roman', serif";
const sans = "'Helvetica Neue', Arial, sans-serif";
const font = (family, size, weight = 400, italic = false) => Object.freeze({ family, size, weight, italic });

export const typography = Object.freeze({
  body: Object.freeze({ font: font(serif, 11), lineSpacing: 1.15, spaceAfter: pt(6) }),
  titles: Object.freeze([
    Object.freeze({ font: font(sans, 24, 700), align: "center", spaceAfter: pt(24) }),
    Object.freeze({ font: font(sans, 17, 700), spaceBefore: pt(18), spaceAfter: pt(8) }),
    Object.freeze({ font: font(sans, 13.5, 700), spaceBefore: pt(14), spaceAfter: pt(5) }),
    Object.freeze({ font: font(sans, 11, 700, true), spaceBefore: pt(10), spaceAfter: pt(3) }),
  ]),
});

// The title of a section `depth` deep - the document's own at 0.
export function titleStyle(typography, depth) {
  const { titles } = typography;
  return titles[Math.min(depth, titles.length - 1)];
}
