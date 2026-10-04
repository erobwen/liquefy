/**
 * How a paper sequence is drawn in the DOM - shared by what shows it on
 * screen (PaperSequenceView.js) and what prints it (printPaperSequence.js),
 * so the two are the same drawing. Lengths in CSS millimeters, straight from
 * the micrometers on the paper sequence: a paper is drawn at its real size,
 * and printed at it.
 */

export const cssMm = (micrometers) => micrometers / 1000 + "mm";

// A paper: { width, height } of a page on the paper sequence. Its lines are
// placed inside it.
export function paperStyle(format) {
  return {
    position: "relative",
    flex: "none",
    boxSizing: "border-box",
    width: cssMm(format.width),
    height: cssMm(format.height),
    overflow: "hidden",
    background: "white",
    color: "black",
  };
}

// A run of text, on its line (see cascade.print's Paragraph.js for a placed
// line). Placed on the line's baseline: its line box is exactly as tall as
// its font reaches above and below the baseline, so the baseline is its
// ascent down from its top.
// A placeholder's text: the light blue of a marker area's edge (see Ripple's
// paper/RipplePaperView.js).
export const placeholderColor = "rgba(66, 133, 244, 0.35)";

export function runStyle(line, run) {
  const font = run.font;
  return {
    position: "absolute",
    left: cssMm(line.x + run.x),
    top: cssMm(line.baseline - run.ascent),
    lineHeight: cssMm(run.ascent + run.descent),
    whiteSpace: "pre",
    fontFamily: font.family,
    fontSize: font.size + "pt",
    fontWeight: font.weight,
    fontStyle: font.italic ? "italic" : "normal",
    // In place of text there isn't (see lineBreaking.js): faint, the light
    // blue of a marker area's edge.
    ...(run.placeholder ? { color: placeholderColor } : {}),
  };
}
