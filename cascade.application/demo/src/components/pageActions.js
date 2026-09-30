import { Component, callback } from "@liquefy/cascade.component";
import { p, ul, li, text } from "@liquefy/cascade.dom";
import { iconButton, alert, popover, portalSource } from "@liquefy/cascade.ui";
import { CodeButton } from "./code.js";

/**
 * A page's own buttons in the app's top bar, just before the page title -
 * ported from the Flow demo's per-page portalSource(informationButton(),
 * displayCodeButton()) (there, they sat off to the right). Put the result
 * anywhere in the page's build() - or, for a page that renders itself,
 * create it in initialization and render it: it renders nothing where it
 * stands, and shows the buttons in the top bar's portal (see
 * ApplicationMenuFrame, which provides it as `topBarPortal`, found by that
 * name) for as long as the page is shown.
 *
 *  - information: what the information button shows (optional) - plain
 *    data, `{ summary, points }`: a sentence, and a list of points. Only for
 *    a page with no room of its own for it (one that fills the work area:
 *    a form, a grid): a page with room shows it first on the page itself,
 *    with informationBox() below - one or the other, never both.
 *  - source, fileName: the page's own code, for the code button - a
 *    page's module imports itself for it: `import source from "./X.js?raw"`.
 */
export function pageActions({ information, source, fileName }) {
  return portalSource(
    { portal: "topBarPortal" },
    information ? new InformationButton({ key: "information", ...information }) : null,
    new CodeButton({ source, fileName }),
  );
}

// An information button: shows `summary` and `points` in a popover
// beside it.
export class InformationButton extends Component {
  setProperties({ summary, points }) {
    this.summary = summary || "";
    this.points = points || [];
  }

  initialState() {
    return { open: false, anchor: null };
  }

  build() {
    return [
      iconButton({
        icon: "info",
        title: "About this page",
        style: { color: "#74b9ff" },
      }, (event) => {
        // The button itself - the popover follows it, should it move.
        this.anchor = event.currentTarget;
        this.open = true;
      }),
      popover(
        { anchor: this.anchor, showing: this.open, close: callback("close", () => { this.open = false; }) },
        informationBox(
          { summary: this.summary, points: this.points },
          { boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)", maxWidth: "640px" },
        ),
      ),
    ];
  }
}

/**
 * A page's information - `{ summary, points }`, as for pageActions() - in an
 * info alert: shown first on a page that has room for it, and in the
 * information button's popover for one that hasn't. A `key` is optional -
 * given, the box is keyed with it.
 */
export function informationBox({ key, summary, points }, style) {
  // The list is keyed, as it may be hidden (showIf), and so are its points.
  const prefix = key || "information";
  return alert(
    { key, style: { lineHeight: "1.4", flex: "none", ...style } },
    p({ style: { margin: 0 } }, text(summary)),
    ul(
      { key: prefix + "Points", style: { margin: "8px 0 0 0", paddingLeft: "20px" } },
      (points || []).map((point, index) => li({ key: prefix + "Point" + index }, text(point))),
    ).showIf(!!points && points.length > 0),
  );
}
