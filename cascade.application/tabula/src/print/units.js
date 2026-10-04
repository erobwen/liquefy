/**
 * Lengths in cascade.print are integers in micrometers (µm) - a thousandth
 * of a millimeter - everywhere: in the model, on the paper sequence, in what
 * a text measurer returns. Integers, so positions add up exactly, and
 * whether a line still fits on a page never depends on a rounding error.
 *
 * The one exception is font size, which the model keeps in points, as
 * typography does (a 12 point font) - converted with pt() where a length is
 * needed. A point is 1/72 inch, 352.77... µm, so pt() rounds.
 */

export const MICROMETERS_PER_MM = 1000;
export const MICROMETERS_PER_INCH = 25400;

export function mm(millimeters) {
  return Math.round(millimeters * MICROMETERS_PER_MM);
}

export function inch(inches) {
  return Math.round(inches * MICROMETERS_PER_INCH);
}

export function pt(points) {
  return Math.round(points * MICROMETERS_PER_INCH / 72);
}

// A CSS pixel is 1/96 inch.
export function px(pixels) {
  return Math.round(pixels * MICROMETERS_PER_INCH / 96);
}

export function toPx(micrometers) {
  return micrometers * 96 / MICROMETERS_PER_INCH;
}

// Exact in micrometers, both of them.
export const paperSizes = Object.freeze({
  A4: Object.freeze({ width: 210000, height: 297000 }),
  letter: Object.freeze({ width: 215900, height: 279400 }),
});

// Margins on all four sides - one length, or { top, right, bottom, left }.
export function margins(all) {
  if (typeof(all) === "number") return Object.freeze({ top: all, right: all, bottom: all, left: all });
  return Object.freeze({ top: 0, right: 0, bottom: 0, left: 0, ...all });
}
