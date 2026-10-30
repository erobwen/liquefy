/**
 * The space between papers, everywhere on the paper grey: between two
 * papers of a document, between two documents, among pages of their own -
 * one gap, `paperGap` (mm), whatever's on either side. A document's view
 * leaves half of it above and below itself (`surfacePadding`), so two of
 * them, one under the other, make one gap - and the creation dots between
 * them (see CreationDot.js) float over it, on the line where they meet,
 * taking no room (`dotLineStyle`).
 */
export const paperGap = 8;
export const surfaceInset = { vertical: paperGap / 2, horizontal: 8 };
export const surfacePadding = `${surfaceInset.vertical}mm ${surfaceInset.horizontal}mm`;

// A line with no height, a creation dot centred on it - over what's around.
export const dotLineStyle = {
  position: "relative", height: 0, width: "100%", flex: "none", zIndex: 2,
  display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible",
};
