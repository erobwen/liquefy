import { Component } from "@liquefy/cascade.component";
import { div, hydrate } from "@liquefy/cascade.dom";
import { card, row, fitContainerStyle, themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { HighlightedCode } from "../components/code.js";
import { accentColor, pageColumn, pageGap, sectionTitle } from "../components/layout.js";
import source from "./HydrationPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A page written as a document instead of code:",
  points: [
    "One plain object: a tree of service queries, hydrated into components by the service locator.",
    "The document is pure data - it could come from a file or a server - and follows the app's theme like any other page.",
    "Beside it, the document itself: the very object the page was hydrated from.",
  ],
};

/**
 * Hydration - the same kind of page as IntroductionPage, but written as a
 * document instead of code: one plain object literal, a tree of service
 * queries (`{ type, name, properties }`, with further queries in
 * `properties.children`), and no calls to div(), h1() or any other
 * convenience function at all. build() just hands the whole document to
 * hydrate(), and the service locator in this page's render context builds
 * every node of it into a component - children first - exactly as if
 * build() had made those calls itself (see cascade.component's
 * ServiceLocator.js, hydrateQuery()).
 *
 * The document is pure data - it could just as well have come from a file
 * or a server - and it's hydrated with whatever services this page's
 * context holds: the button in it is a themed widget, so it follows the
 * app's theme like any other (try switching it on the Themes page). Nodes
 * without a key get one from their position, so a rebuild reconciles the
 * hydrated tree node for node instead of recreating it.
 *
 * Beside the page (under it, when narrow) is the document itself, as JSON:
 * the very object the page was hydrated from.
 */

const loremIpsum =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et " +
  "dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex " +
  "ea commodo consequat.";

const content = {
  type: "htmlElement",
  name: "div",
  properties: {
    children: [
      { type: "htmlElement", name: "h1", properties: { children: ["Hydration"] } },
      {
        type: "htmlElement",
        name: "p",
        properties: {
          children: [
            "Everything on this page was written as ",
            { type: "htmlElement", name: "b", properties: { style: { color: accentColor }, children: ["one plain object literal"] } },
            " - a document - and hydrated into components by the service locator, not built with convenience functions.",
          ],
        },
      },
      { type: "htmlElement", name: "p", properties: { children: [loremIpsum] } },
      { type: "htmlElement", name: "h2", properties: { children: ["Dolor sit amet"] } },
      {
        type: "htmlElement",
        name: "ul",
        properties: {
          children: [
            {
              type: "htmlElement",
              name: "li",
              properties: {
                children: [
                  { type: "htmlElement", name: "b", properties: { style: { color: accentColor }, children: ["Consectetur"] } },
                  " adipiscing elit, sed do eiusmod tempor.",
                ],
              },
            },
            {
              type: "htmlElement",
              name: "li",
              properties: {
                children: [
                  { type: "htmlElement", name: "b", properties: { style: { color: accentColor }, children: ["Incididunt"] } },
                  " ut labore et dolore magna aliqua.",
                ],
              },
            },
            {
              type: "htmlElement",
              name: "li",
              properties: {
                children: [
                  { type: "htmlElement", name: "b", properties: { style: { color: accentColor }, children: ["Ullamco"] } },
                  " laboris nisi ut aliquip ex ea commodo.",
                ],
              },
            },
          ],
        },
      },
      {
        type: "htmlElement",
        name: "blockquote",
        properties: {
          style: { borderLeft: "4px solid " + accentColor, margin: "16px 0", padding: "4px 16px", color: themeColor.textSoft },
          children: [
            "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
          ],
        },
      },
      { type: "htmlElement", name: "h2", properties: { children: ["Excepteur sint occaecat"] } },
      {
        type: "htmlElement",
        name: "ol",
        properties: {
          children: [
            { type: "htmlElement", name: "li", properties: { children: ["Cupidatat non proident."] } },
            { type: "htmlElement", name: "li", properties: { children: ["Sunt in culpa qui officia."] } },
            { type: "htmlElement", name: "li", properties: { children: ["Deserunt mollit anim id est laborum."] } },
          ],
        },
      },
      {
        type: "htmlElement",
        name: "p",
        properties: {
          children: [
            "Not only HTML: this is a themed widget, asked for the same way as everything else - ",
            { type: "widget", name: "button", properties: { children: ["A themed button"] } },
          ],
        },
      },
    ],
  },
};

// The page's document: the content above, on a themed card - asked for in
// the document, like the button in it.
const hydrationDocument = {
  type: "widget",
  name: "card",
  properties: {
    style: { maxWidth: "820px", padding: "8px 32px 24px", lineHeight: "1.55", boxSizing: "border-box" },
    children: [content],
  },
};

// Beside it - narrow, under it: the document itself, as the data it is.
const documentJson = JSON.stringify(hydrationDocument, null, 2);

// Narrower than this, the document's source goes under the page, not beside it.
const SIDE_PANEL_WIDTH = 900;

export class HydrationPage extends Component {
  build() {
    const wide = (this.renderContext.usableWidth || 1000) >= SIDE_PANEL_WIDTH;
    const sourcePanel = card(
      {
        key: "sourcePanel",
        style: wide
          ? { width: "44%", maxWidth: "600px", flex: "none", height: "calc(100% - 4px)", margin: "2px 2px 2px 0", display: "flex", flexDirection: "column", gap: "8px" }
          : { display: "flex", flexDirection: "column", gap: "8px" },
      },
      sectionTitle("sourceTitle", "The document this page was hydrated from"),
      new HighlightedCode({
        key: "sourceCode",
        source: documentJson,
        style: {
          fontSize: "12px", border: "1px solid " + themeColor.border, borderRadius: "6px", overflow: "auto",
          ...(wide ? { flex: "1 1 0", minHeight: 0 } : { maxHeight: "60vh" }),
        },
      }),
    );
    const actions = pageActions({ information, source, fileName: "src/pages/HydrationPage.js" });
    if (!wide) return pageColumn({ key: "page" }, actions, hydrate(hydrationDocument), sourcePanel);
    return row(
      { key: "page", style: { ...fitContainerStyle, gap: pageGap } },
      actions,
      // The page scrolls, the document beside it on its own.
      div(
        { key: "scrollPanel", style: { flex: "1 1 0", minWidth: 0, height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "0 4px 4px 0" } },
        hydrate(hydrationDocument),
      ),
      sourcePanel,
    );
  }
}
