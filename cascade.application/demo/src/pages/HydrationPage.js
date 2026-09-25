import { Component } from "@liquefy/cascade.component";
import { hydrate } from "@liquefy/cascade.dom";
import { pageActions } from "../components/pageActions.js";
import source from "./HydrationPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A page written as a document instead of code:",
  points: [
    "One plain object: a tree of service queries, hydrated into components by the service locator.",
    "The document is pure data - it could come from a file or a server - and follows the app's theme like any other page.",
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
 */
const element = (name, properties) => ({ type: "htmlElement", name, properties });

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
            { type: "htmlElement", name: "b", properties: { style: { color: "blue" }, children: ["one plain object literal"] } },
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
                  { type: "htmlElement", name: "b", properties: { style: { color: "blue" }, children: ["Consectetur"] } },
                  " adipiscing elit, sed do eiusmod tempor.",
                ],
              },
            },
            {
              type: "htmlElement",
              name: "li",
              properties: {
                children: [
                  { type: "htmlElement", name: "b", properties: { style: { color: "blue" }, children: ["Incididunt"] } },
                  " ut labore et dolore magna aliqua.",
                ],
              },
            },
            {
              type: "htmlElement",
              name: "li",
              properties: {
                children: [
                  { type: "htmlElement", name: "b", properties: { style: { color: "blue" }, children: ["Ullamco"] } },
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
          style: { borderLeft: "4px solid #b2bec3", margin: "16px 0", padding: "4px 16px", color: "#636e72" },
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

// The page itself: the document above, plus - also as data - a way to
// see the document this page was hydrated from.
const hydrationDocument = element("div", {
  style: { maxWidth: 720, lineHeight: "1.5" },
  children: [
    content,
    element("details", {
      style: { marginTop: "24px" },
      children: [
        element("summary", { style: { cursor: "pointer" }, children: ["Show the document this page was hydrated from"] }),
        element("pre", {
          style: { fontSize: "12px", background: "#f5f6fa", border: "1px solid #dfe6e9", padding: "12px", overflow: "auto", lineHeight: "1.3" },
          children: [JSON.stringify(content, null, 2)],
        }),
      ],
    }),
  ],
});

export class HydrationPage extends Component {
  build() {
    return [pageActions(this, { information, source, fileName: "src/pages/HydrationPage.js" }), hydrate(hydrationDocument)];
  }
}
