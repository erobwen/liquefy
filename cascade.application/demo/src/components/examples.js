import { div, code, text } from "@liquefy/cascade.dom";
import { themeColor } from "@liquefy/cascade.ui";
import { HighlightedCode } from "./code.js";

// For the pages that show examples and their code - Convenient Usage and
// Advanced Usage.

const codeStyle = { margin: "8px 0 16px 0", border: "1px solid " + themeColor.border, borderRadius: "8px", overflow: "auto", lineHeight: "1.4" };
export const codeBlock = (sourceText) => new HighlightedCode({ source: sourceText, style: codeStyle });

// An example, running: on a stage of its own.
export const stage = (child) => div(
  { style: { margin: "8px 0 12px 0", padding: "20px", borderRadius: "8px", background: themeColor.page, overflow: "visible" } },
  child,
);

// A name from the code, in running text.
export const name = (value) => code({ style: { fontSize: "0.95em" } }, text(value));
