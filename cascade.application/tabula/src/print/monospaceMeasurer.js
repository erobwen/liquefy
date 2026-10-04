import { pt } from "./units.js";

/**
 * A text measurer - what line breaking asks how wide a piece of text is,
 * and how tall a font's lines are. cascade.print measures nothing itself:
 * a measurer is provided to the paragraphs - inherited as `textMeasurer`
 * (see Paragraph.js) - so the same layout runs on the real fonts of a
 * browser, or on anything else.
 *
 *   measure(text, font)  - its width, in µm
 *   metrics(font)        - { ascent, descent }, in µm: how far the font's
 *                          lines reach above and below the baseline
 *
 * `font` is a resolved font: { family, size, weight, italic }, size in
 * points - family as CSS has it ("Georgia, serif").
 *
 * This one needs no fonts at all: every character is as wide as `advance`
 * times the font size - the measurer for tests, and for laying out anywhere
 * there is no browser.
 */
export function monospaceMeasurer({ advance = 0.6, ascent = 0.8, descent = 0.2 } = {}) {
  return {
    measure(text, font) {
      return text.length * pt(font.size * advance);
    },
    metrics(font) {
      return { ascent: pt(font.size * ascent), descent: pt(font.size * descent) };
    },
  };
}
