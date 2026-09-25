import { Component } from "@liquefy/cascade.component";
import { p, ul, li, text } from "@liquefy/cascade.dom";
import { iconButton, alert, popover, portalContents } from "@liquefy/cascade.ui";
import { CodeButton } from "./code.js";

/**
 * A page's own buttons in the app's top bar, just before the page title -
 * ported from the Flow demo's per-page portalContents(informationButton(),
 * displayCodeButton()) (there, they sat off to the right). Put the result
 * anywhere in the page's build() - or, for a page that renders itself,
 * create it in initialization and render it: it renders nothing where it
 * stands, and shows the buttons in the top bar's portal (see
 * ApplicationMenuFrame, which provides it as `topBarPortal`, found by that
 * name) for as long as the page is shown.
 *
 *  - information: what the information button shows (optional) - plain
 *    data, `{ summary, points }`: a sentence, and a list of points.
 *  - source, fileName: the page's own code, for the code button - a
 *    page's module imports itself for it: `import source from "./X.js?raw"`.
 */
export function pageActions({ information, source, fileName }) {
  return portalContents(
    { key: "pageActions", portal: "topBarPortal" },
    information ? new InformationButton({ key: "information", ...information }) : null,
    new CodeButton({ key: "code", source, fileName }),
  );
}

// An information button: shows `summary` and `points` in a popover
// beside it.
export class InformationButton extends Component {
  setProperties({ summary, points }) {
    this.summary = summary || "";
    this.points = points || [];
  }

  initializeState() {
    return { open: false, anchor: null };
  }

  build() {
    return [
      iconButton({
        key: "button",
        icon: "info",
        title: "About this page",
        style: { color: "#74b9ff" },
      }, (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        this.anchor = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        this.open = true;
      }),
      popover(
        { key: "popover", anchor: this.anchor, showing: this.open, close: () => { this.open = false; } },
        alert(
          { key: "information", style: { boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)", maxWidth: "640px", lineHeight: "1.4" } },
          p({ key: "summary", style: { margin: 0 } }, text({ key: "summaryText", text: this.summary })),
          ul(
            { key: "points", style: { margin: "8px 0 0 0", paddingLeft: "20px" } },
            this.points.map((point, index) => li({ key: "point" + index }, text({ key: "pointText" + index, text: point }))),
          ).show(this.points.length > 0),
        ),
      ),
    ];
  }
}
