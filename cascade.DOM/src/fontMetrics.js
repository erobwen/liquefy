/**
 * Text measurement, for components that size text to the room they're
 * given - the room itself typically measured by elementBoundsProvider().
 *
 * Measured on a canvas, never in the document: nothing is laid out, and
 * nothing that renders is disturbed. A text's width grows in proportion to
 * its font size, so one measurement at a reference size tells the font
 * size for any width (Flow's fitTextWithinWidth() searched for it, laying
 * out a div ten times over).
 */

const REFERENCE_FONT_SIZE = 100;
const widths = new Map();
let canvasContext = null;

// The font family the document's text is in, unless one is given.
function defaultFontFamily() {
  return document.defaultView.getComputedStyle(document.body).fontFamily || "sans-serif";
}

/**
 * The width of `text` at a font size, in pixels. Options: fontSize
 * (default 13), fontWeight (default 400), fontFamily (default the
 * document body's).
 */
export function textWidth(text, { fontSize = 13, fontWeight = 400, fontFamily = defaultFontFamily() } = {}) {
  const key = fontWeight + " " + fontFamily + "|" + text;
  let width = widths.get(key);
  if (width === undefined) {
    if (!canvasContext) canvasContext = document.createElement("canvas").getContext("2d");
    canvasContext.font = fontWeight + " " + REFERENCE_FONT_SIZE + "px " + fontFamily;
    width = canvasContext.measureText(text).width;
    widths.set(key, width);
  }
  return width * fontSize / REFERENCE_FONT_SIZE;
}

/**
 * The font size at which `text`, on one line, is `targetWidth` wide.
 * Options: fontWeight, fontFamily (as for textWidth()).
 */
export function fitTextWithinWidth(text, targetWidth, options = {}) {
  const width = textWidth(text, { ...options, fontSize: REFERENCE_FONT_SIZE });
  if (!(width > 0)) return 0;
  return Math.max(0, targetWidth) * REFERENCE_FONT_SIZE / width;
}
