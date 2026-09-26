import { Component, callback } from "@liquefy/cascade.component";
import { a, b, div, text } from "@liquefy/cascade.dom";
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
 *  - nextPage(): the way on, to another page of the app.
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
