import { Component, callback } from "@liquefy/cascade.component";
import { a, b, div, text } from "@liquefy/cascade.dom";
import { card, column, fitContainerStyle, overflowVisibleStyle, themeColor } from "@liquefy/cascade.ui";

/**
 * The demo's shared page layout - so every page spaces itself the same way,
 * and none has to say how. What things look like (surfaces, controls) is
 * the theme's; this is only how a page is laid out with them.
 *
 * Every page owns its scrolling: the work area around it never scrolls, it
 * only gives the page its room. A page as tall as its content scrolls in a
 * panel of its own - so its scroll position is its own, and it starts from
 * the top when it's shown - and one laid out within its room doesn't scroll
 * at all.
 *
 *  - pageColumn(): a page as tall as its content, in a scroll panel of its
 *    own.
 *  - fullPage(): a page filling its room exactly - for pages that lay out
 *    within the room they're given (a toolbar at the bottom, panels spread
 *    out, ...). No scrolling.
 *  - article(): text to read, on a surface of its own, at a readable width -
 *    in a scroll panel of its own.
 *  - pagePadding: the margin every page keeps to its room's edges - for a
 *    page making its own outermost element.
 *  - sectionTitle(): a small heading, above a group of things on a page.
 *  - emphasis(): a highlighted phrase in running text.
 *  - nextPage(): the way on, to another page of the app.
 */

// The space between the parts of a page - everywhere.
export const pageGap = "16px";

// The margin to the page's room: inside a scroll panel, so the scroll bar
// sits at the room's edge, and cards' shadows aren't clipped.
export const pagePadding = "16px";

// A scroll panel filling the page's room, the page's content inside.
function scrollPanel(key, content) {
  return div({ key: key + "Scroll", style: { ...fitContainerStyle, overflowY: "auto", padding: pagePadding } }, content);
}

// Emphasis - the accent color of the theme's color scheme.
export const accentColor = themeColor.accent;

const toChildren = (children) => children.map((child) => typeof(child) === "string" ? text(child) : child);

export function pageColumn(properties, ...children) {
  return scrollPanel(properties.key, column(
    { ...properties, style: { ...overflowVisibleStyle, boxSizing: "border-box", width: "100%", gap: pageGap, ...properties.style } },
    ...children,
  ));
}

export function fullPage(properties, ...children) {
  return column(
    { ...properties, style: { ...fitContainerStyle, gap: pageGap, padding: pagePadding, ...properties.style } },
    ...children,
  );
}

export function article(properties, ...children) {
  return scrollPanel(properties.key, card(
    { ...properties, style: { maxWidth: "820px", padding: "8px 32px 24px", lineHeight: "1.55", boxSizing: "border-box", ...properties.style } },
    ...children,
  ));
}

export function sectionTitle(key, title) {
  return div({ key, style: { fontWeight: "bold", fontSize: "15px", margin: "4px 0 0 0" } }, text({ key: key + "Text", text: title }));
}

export function emphasis(...children) {
  return b({ style: { color: accentColor } }, ...toChildren(children));
}

/**
 * nextPage({ key, path, label }) - the way on, to another page of the app:
 * a real link to its address (open it in a new tab, copy it) - and a plain
 * click goes there without loading the app anew, as the menu does.
 */
export function nextPage(properties) {
  return new NextPage(properties);
}

class NextPage extends Component {
  setProperties({ path, label }) {
    this.path = path;
    this.label = label;
  }

  build() {
    const location = this.inherit("location");
    return div(
      {
        key: "nextPage",
        style: {
          margin: "24px 0 8px 0", padding: "16px 20px", borderRadius: "8px",
          background: themeColor.accentLight, borderLeft: "4px solid " + themeColor.accent,
        },
      },
      a(
        {
          key: "link",
          href: location.href(this.path),
          style: { color: themeColor.accentDark, fontWeight: "bold", fontSize: "17px", textDecoration: "none" },
          onclick: callback("go", (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            location.navigate(this.path);
          }),
        },
        text({ key: "linkText", text: this.label }),
      ),
    );
  }
}
