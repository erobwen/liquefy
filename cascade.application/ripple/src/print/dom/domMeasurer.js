import { observable } from "@liquefy/cascade.component";
import { px } from "../units.js";

// Measured at one size, scaled to any other: a text's width grows in
// proportion to its font size (see cascade.dom's fontMetrics.js).
const REFERENCE_SIZE = 100;

// How many widths are kept: placing a caret measures every prefix of a run,
// so a long document would otherwise keep a width for each, for good.
// Beyond it, the cache starts over - what's measured next is measured anew.
const MAX_CACHED_WIDTHS = 20000;

/**
 * A text measurer for the browser (see monospaceMeasurer.js for what a
 * measurer is): the DOM as a measuring device, and nothing more - line
 * breaking is cascade.print's own. Measured on a canvas, so nothing in the
 * document is laid out to measure.
 *
 * A font's `family` is CSS: `"Georgia, serif"`, `"'Times New Roman', serif"`.
 *
 * A font that finishes loading after text was measured in it changes every
 * measurement: whatever measured with this measurer - a paragraph's line
 * breaking - measures again, and nothing else does.
 *
 * It listens for fonts loading on its document for as long as it's in use:
 * whoever creates it calls dispose() once done with it, and that listener
 * - and what it has cached - goes.
 */
export function domMeasurer({ document: doc = globalThis.document } = {}) {
  const fonts = observable({ loaded: 0 });
  const widths = new Map();
  const reaches = new Map();
  let canvas = null;

  const fontsLoaded = () => {
    widths.clear();
    reaches.clear();
    fonts.loaded++;
  };
  const fontSet = doc.fonts && doc.fonts.addEventListener ? doc.fonts : null;
  if (fontSet) fontSet.addEventListener("loadingdone", fontsLoaded);

  function context(font) {
    if (!canvas) canvas = doc.createElement("canvas").getContext("2d");
    canvas.font = (font.italic ? "italic " : "") + font.weight + " " + REFERENCE_SIZE + "px " + font.family;
    return canvas;
  }

  // From the reference size to the font's own, in CSS pixels (a point is
  // 96/72 of one).
  const scale = (font) => font.size * 96 / 72 / REFERENCE_SIZE;
  const fontKey = (font) => (font.italic ? "i" : "n") + font.weight + "|" + font.family;

  return {
    measure(text, font) {
      fonts.loaded;
      const key = fontKey(font) + "|" + text;
      let width = widths.get(key);
      if (width === undefined) {
        width = context(font).measureText(text).width;
        if (widths.size >= MAX_CACHED_WIDTHS) widths.clear();
        widths.set(key, width);
      }
      return px(width * scale(font));
    },

    metrics(font) {
      fonts.loaded;
      const key = fontKey(font);
      let reach = reaches.get(key);
      if (reach === undefined) {
        // The font's own ascent and descent - the ones CSS lays a line out
        // with - where the browser has them; a guess where it doesn't.
        const measured = context(font).measureText("Hg");
        reach = {
          ascent: measured.fontBoundingBoxAscent ?? REFERENCE_SIZE * 0.8,
          descent: measured.fontBoundingBoxDescent ?? REFERENCE_SIZE * 0.2,
        };
        reaches.set(key, reach);
      }
      return { ascent: px(reach.ascent * scale(font)), descent: px(reach.descent * scale(font)) };
    },

    // Done with: no longer listening for fonts loading, nothing cached.
    dispose() {
      if (fontSet) fontSet.removeEventListener("loadingdone", fontsLoaded);
      widths.clear();
      reaches.clear();
      canvas = null;
    },
  };
}
