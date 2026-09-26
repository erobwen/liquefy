import { Component, callback } from "@liquefy/cascade.component";
import { text, div, span, elementBoundsProvider, fitTextWithinWidth } from "@liquefy/cascade.dom";
import { controlPanel, textField, icon, row, column, centerMiddle, fillerStyle, centerMiddleStyle, themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { fullPage, accentColor } from "../components/layout.js";
import surface from "../../../../cascade/images/surface.jpg";
import source from "./ProgrammaticReactiveLayout.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "Components that know their own pixel budget can use the space more efficiently - no CSS media queries.",
  points: [
    "The cells aren't given a size: a flexbox layout spreads them over the page. Each cell measures itself, and what's in it adapts to what it measured.",
    "Resize the window, or change rows and columns, and watch every cell follow.",
    "Text sized to fit its width, a box keeping its aspect ratio, and a cell that picks what to show by the room it has - sub component choice and composition can depend on available area.",
    "No bounds are computed anywhere: the measuring is done by elementBoundsProvider(), one for every cell, and styled like any element.",
  ],
};

const MAX_CELLS = 8;
const GAP = "6px";

/**
 * Programmatic Reactive Layout - ported from flow.application/demo's
 * programmaticReactiveLayout.js: a rows/columns control panel, and a grid
 * of cells, each adapting its content to the room it has.
 *
 * Unlike Flow, nothing here computes bounds: the grid is plain flexbox - a
 * column of filler rows of filler cells - and every cell is an
 * elementBoundsProvider(), styled as the cell, measuring itself. Its direct
 * child, the cell's content, reads what it measured as
 * this.renderContext.width/height, from build(). (Directly: an element in
 * between would give the content a render context of its own, without the
 * measurement.)
 */
export class ProgrammaticReactiveLayout extends Component {
  initializeState() {
    return { rows: 3, columns: 3 };
  }

  build() {
    const rows = [];
    for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
      const cells = [];
      for (let columnIndex = 0; columnIndex < this.columns; columnIndex++) {
        cells.push(this.cell(rowIndex, columnIndex));
      }
      rows.push(row({ key: "row" + rowIndex, style: { ...fillerStyle, gap: GAP } }, cells));
    }

    return fullPage(
      { key: "page" },
      pageActions({ information, source, fileName: "src/pages/ProgrammaticReactiveLayout.js" }),
      controlPanel(
        { key: "controls" },
        this.numberField("rows", "Rows"),
        this.numberField("columns", "Columns"),
      ),
      column({ key: "grid", style: { ...fillerStyle, gap: GAP } }, rows),
    );
  }

  // A cell: a bounds provider, styled as the cell, with the content as its
  // direct child. Keyed by position, so a cell stays the same cell - its
  // aspect ratio, say - however rows and columns change around it.
  cell(rowIndex, columnIndex) {
    const key = "cell" + rowIndex + "x" + columnIndex;
    const Kind = cellKinds[(rowIndex + columnIndex) % cellKinds.length];
    return elementBoundsProvider({
      key,
      style: { ...fillerStyle, ...centerMiddleStyle, minWidth: 0, borderRadius: "8px", ...Kind.cellStyle },
      child: new Kind({ key: key + "Content" }),
    });
  }

  numberField(property, caption) {
    return textField({
      key: property + "Field",
      label: caption,
      type: "number",
      value: this[property],
      onInput: callback(property, (value) => {
        const number = parseInt(value, 10);
        if (number >= 1) this[property] = Math.min(MAX_CELLS, number);
      }),
    });
  }
}

// Text on one line, as large as fits `width` - but no larger than
// `maxFontSize`.
function fittedText({ key, text: content, width, maxFontSize = Infinity, style }) {
  const fontSize = Math.min(maxFontSize, fitTextWithinWidth(content, width));
  return span(
    { key, style: { whiteSpace: "pre", lineHeight: "1.2", fontSize: fontSize + "px", ...style } },
    text({ key: key + "Text", text: content }),
  );
}

/**
 * Bounds Display - what the cell measured, on a background photo.
 */
class BoundsDisplay extends Component {
  static cellStyle = {
    backgroundImage: `url(${surface})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    border: "1px solid " + themeColor.chromeDark,
  };

  build() {
    const { width, height } = this.renderContext;
    return fittedText({
      key: "bounds",
      text: "Bounds: " + Math.round(width) + " x " + Math.round(height),
      width: width * 0.8,
      maxFontSize: 16,
      style: { padding: "4px 8px", borderRadius: "4px", backgroundColor: "rgba(255, 255, 255, 0.6)", color: themeColor.text },
    });
  }
}

/**
 * String Display - a text as wide as the cell.
 */
class StringDisplay extends Component {
  static cellStyle = { border: "1px solid " + themeColor.border, backgroundColor: themeColor.surface, color: themeColor.text };

  build() {
    const { width, height } = this.renderContext;
    return fittedText({
      key: "string",
      text: "Text that fits the width of its container",
      // Its border and a margin off - and never taller than the cell.
      width: width - 12,
      maxFontSize: height * 0.8,
    });
  }
}

/**
 * Fixed Aspect Ratio Display - a box keeping a ratio of its own, as large
 * as fits the cell.
 */
class FixedAspectRatioDisplay extends Component {
  static cellStyle = { border: "1px solid " + themeColor.border, backgroundColor: themeColor.page };

  initializeState() {
    return { aspectRatio: (Math.random() * 4 + 1) / (Math.random() * 4 + 1) };
  }

  build() {
    const { width: cellWidth, height: cellHeight } = this.renderContext;
    const padding = Math.min(10, cellWidth * 0.1, cellHeight * 0.1);
    let width = Math.max(0, cellWidth - padding * 2);
    let height = width / this.aspectRatio;
    if (height > cellHeight - padding * 2) {
      height = Math.max(0, cellHeight - padding * 2);
      width = height * this.aspectRatio;
    }
    return centerMiddle(
      {
        key: "box",
        style: {
          flex: "none", width: width + "px", height: height + "px", boxSizing: "border-box",
          border: "1px solid " + accentColor, borderRadius: "6px", backgroundColor: themeColor.accentLight, color: themeColor.accentDark, overflow: "hidden",
        },
      },
      fittedText({
        key: "ratio",
        text: "Width / Height = " + (Math.round(this.aspectRatio * 100) / 100),
        width: width * 0.8,
        maxFontSize: 16,
      }),
    );
  }
}

/**
 * Responsive Display - not just sized to its room: what it shows depends on
 * it. An icon when it's cramped, a caption when there's a little more room,
 * a whole description when there's plenty.
 */
class ResponsiveDisplay extends Component {
  static cellStyle = { border: "1px solid " + themeColor.chromeDark, backgroundColor: themeColor.chrome, color: themeColor.onChrome };

  build() {
    const { width, height } = this.renderContext;
    const glyph = (size) => icon({ key: "icon", name: "dashboard", style: { fontSize: size + "px", flex: "none" } });
    if (width < 140 || height < 60) {
      return glyph(Math.max(12, Math.min(48, width * 0.5, height * 0.6)));
    }
    if (width < 280 || height < 140) {
      return row(
        { key: "compact", style: { alignItems: "center", gap: "8px" } },
        glyph(32),
        span({ key: "caption", style: { fontWeight: "bold" } }, text({ key: "captionText", text: "Adaptive" })),
      );
    }
    return column(
      { key: "full", style: { alignItems: "center", gap: "8px", padding: "12px", textAlign: "center" } },
      glyph(48),
      span({ key: "title", style: { fontWeight: "bold", fontSize: "18px" } }, text({ key: "titleText", text: "Adaptive composition" })),
      div({ key: "description", style: { fontSize: "13px", opacity: 0.85, maxWidth: "260px" } }, text({
        key: "descriptionText",
        text: "With room to spare, this cell shows a whole description. Make it smaller: first a caption, then just the icon.",
      })),
    );
  }
}

const cellKinds = [BoundsDisplay, StringDisplay, FixedAspectRatioDisplay, ResponsiveDisplay];
