import { b, div, text } from "@liquefy/cascade.dom";
import { card, column, fitContainerStyle, overflowVisibleStyle, themeColor } from "@liquefy/cascade.ui";

/**
 * The demo's shared page layout - so every page spaces itself the same way,
 * and none has to say how. What things look like (surfaces, controls) is
 * the theme's; this is only how a page is laid out with them.
 *
 *  - pageColumn(): a page as tall as its content - the work area around it
 *    scrolls.
 *  - fullPage(): a page filling the work area exactly - for pages that lay
 *    out within the room they're given (a toolbar at the bottom, panels
 *    spread out, ...).
 *  - article(): text to read, on a surface of its own, at a readable width.
 *  - sectionTitle(): a small heading, above a group of things on a page.
 *  - emphasis(): a highlighted phrase in running text.
 */

// The space between the parts of a page - everywhere.
export const pageGap = "16px";

// Emphasis - the accent color of the theme's color scheme.
export const accentColor = themeColor.accent;

const toChildren = (children) => children.map((child) => typeof(child) === "string" ? text(child) : child);

export function pageColumn(properties, ...children) {
  return column(
    { ...properties, style: { ...overflowVisibleStyle, boxSizing: "border-box", width: "100%", gap: pageGap, ...properties.style } },
    ...children,
  );
}

export function fullPage(properties, ...children) {
  return column(
    { ...properties, style: { ...fitContainerStyle, gap: pageGap, ...properties.style } },
    ...children,
  );
}

export function article(properties, ...children) {
  return card(
    { ...properties, style: { maxWidth: "820px", padding: "8px 32px 24px", lineHeight: "1.55", boxSizing: "border-box", ...properties.style } },
    ...children,
  );
}

export function sectionTitle(key, title) {
  return div({ key, style: { fontWeight: "bold", fontSize: "15px", margin: "4px 0 0 0" } }, text({ key: key + "Text", text: title }));
}

export function emphasis(...children) {
  return b({ style: { color: accentColor } }, ...toChildren(children));
}
