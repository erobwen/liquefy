/**
 * Style resolution, as in Word: what a piece of text looks like is the
 * document's defaults, then its paragraph style (and the styles that one is
 * based on, furthest first), then its character style, then whatever is set
 * on the span itself - each layer overriding only what it sets.
 *
 * A stylesheet:
 *
 *   {
 *     paragraph: {
 *       Normal: { font: { family: "Georgia", size: 11 }, spaceAfter: pt(8) },
 *       Heading1: { basedOn: "Normal", font: { size: 18, weight: 700 }, spaceBefore: pt(12) },
 *     },
 *     character: {
 *       Strong: { font: { weight: 700 } },
 *     },
 *   }
 *
 * A paragraph style: `font`, `align` ("left", "center", "right"),
 * `lineSpacing` (a multiple of the font's own line height), `spaceBefore`,
 * `spaceAfter`, `indentLeft`, `indentRight`, `firstLineIndent` - lengths in
 * µm, font size in points (see units.js). A character style: `font`.
 */

export const defaultFont = Object.freeze({ family: "serif", size: 11, weight: 400, italic: false });

export const defaultParagraphStyle = Object.freeze({
  font: defaultFont,
  align: "left",
  lineSpacing: 1,
  spaceBefore: 0,
  spaceAfter: 0,
  indentLeft: 0,
  indentRight: 0,
  firstLineIndent: 0,
});

// A paragraph style with everything it is based on applied. A name the
// stylesheet doesn't have resolves to the defaults; a basedOn cycle stops
// where it comes round.
export function resolveParagraphStyle(stylesheet, name) {
  const styles = (stylesheet && stylesheet.paragraph) || {};
  const chain = [];
  const seen = new Set();
  for (let scan = name; scan && styles[scan] && !seen.has(scan); scan = styles[scan].basedOn) {
    seen.add(scan);
    chain.unshift(styles[scan]);
  }
  let result = defaultParagraphStyle;
  for (const style of chain) result = mergeStyle(result, style);
  return result;
}

// The font of a span, in a paragraph of `paragraphStyle` (resolved).
export function resolveFont(stylesheet, paragraphStyle, span) {
  const characterStyles = (stylesheet && stylesheet.character) || {};
  const characterStyle = span.style ? characterStyles[span.style] : null;
  return {
    ...paragraphStyle.font,
    ...(characterStyle && characterStyle.font),
    ...span.font,
  };
}

function mergeStyle(base, style) {
  const merged = { ...base };
  for (const key in style) {
    if (key === "basedOn") continue;
    merged[key] = key === "font" ? { ...base.font, ...style.font } : style[key];
  }
  return merged;
}
