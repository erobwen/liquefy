import { Component, callback, isObservable } from "@liquefy/cascade.component";
import { hydrate, serviceQueries } from "@liquefy/cascade.dom";
import { themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { HighlightedCode } from "../components/code.js";
import { accentColor, pageGap, pagePadding } from "../components/layout.js";
import source from "./JsxPage.jsx?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A page written in JSX:",
  points: [
    "Vite compiles each JSX tag to a call into cascade.dom's JSX runtime, which returns a service query, not a component.",
    "The whole JSX expression is a document, the same kind the Hydration page is written as, and hydrate() hands it to the service locator.",
    "Callbacks ride along as plain properties, from the JSX to the query to the component the locator makes of it.",
    "Beside it: the very document this build produced, rebuilt on every click.",
  ],
};

// <widget.button>, <widget.card>: the current theme's widgets.
const widget = serviceQueries("widget");

// The document as JSON - with what JSON can't hold named instead.
const describe = (document) => JSON.stringify(document, (key, value) => {
  if (typeof(value) === "function") return "ƒ callback";
  if (isObservable(value)) return "[component " + value.constructor.name + "]";
  return value;
}, 2);

/**
 * JSX - a page written in JSX, the whole way from tag to component:
 *
 *  1. Vite compiles the tags (this file is .jsx - see vite.config.js) to
 *     calls into cascade.dom's JSX runtime (cascade.DOM/src/jsx-runtime.js).
 *  2. Each call returns a service query - `<h1>` is
 *     `{ type: "htmlElement", name: "h1", properties }`, `<widget.button>`
 *     is `{ type: "widget", name: "button", properties }` - so the JSX
 *     expression as a whole is a document, plain data, like the one the
 *     Hydration page is written as.
 *  3. hydrate() hands that document to the service locator in this page's
 *     render context, which builds every node of it into a component.
 *
 * The callbacks - named ones here (callback()), so they're the same
 * function rebuild after rebuild - are just properties all the way: in the
 * JSX, in the queries, and in the button the theme makes.
 */
export class JsxPage extends Component {
  initialState() {
    return { count: 0 };
  }

  build() {
    const counter = (
      <widget.card style={{ flex: "1 1 320px", maxWidth: "560px", padding: "8px 32px 24px", lineHeight: "1.55", boxSizing: "border-box" }}>
        <h1>Hello JSX</h1>
        <p>
          This card is written in <b style={{ color: accentColor }}>JSX</b>, compiled to service
          queries, and hydrated by the service locator.
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <widget.button variant="filled" onClick={callback("count", () => { this.count++; })}>
            Count is {this.count}
          </widget.button>
          <widget.button disabled={this.count === 0} onClick={callback("reset", () => { this.count = 0; })}>
            Reset
          </widget.button>
        </div>
        <ul>
          {Array.from({ length: this.count }, (_, index) => <li key={"click" + index}>Click number {index + 1}</li>)}
        </ul>
      </widget.card>
    );

    return hydrate(
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: pageGap, padding: pagePadding, height: "100%", overflowY: "auto", boxSizing: "border-box" }}>
        {pageActions({ information, source, fileName: "src/pages/JsxPage.jsx" })}
        {counter}
        <widget.card style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontWeight: "bold", fontSize: "15px" }}>The document this build produced from the JSX</div>
          <HighlightedCode
            source={describe(counter)}
            style={{ fontSize: "12px", border: "1px solid " + themeColor.border, borderRadius: "6px", overflow: "auto", maxHeight: "70vh" }}
          />
        </widget.card>
      </div>
    );
  }
}
