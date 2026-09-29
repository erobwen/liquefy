import { Component } from "@liquefy/cascade.component";
import { div, h1, h2, p, a, code, text } from "@liquefy/cascade.dom";
import { themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { HighlightedCode } from "../components/code.js";
import { article, emphasis, nextPage } from "../components/layout.js";
import { HelloWorld } from "./gettingStarted/HelloWorld.js";
import helloWorldSource from "./gettingStarted/HelloWorld.js?raw";
import source from "./GettingStartedPage.js?raw";

/**
 * Getting Started - from an empty folder to a running Cascade app: a
 * logotype and a counter. The app itself runs at the top of the page - the
 * very component the page shows the code of (./gettingStarted/HelloWorld.js,
 * imported both as a component and as its source) - with this app's own
 * services, so it follows the app's theme like everything else.
 *
 * The steps were followed as written, in a fresh Vite project, with the
 * packages from npm.
 */

const createProject = `npm create vite@latest hello-cascade -- --template vanilla
cd hello-cascade
npm install @liquefy/cascade.ui`;

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hello Cascade</title>
  </head>
  <body style="margin: 0; padding: 24px; font-family: sans-serif;">
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`;

const mainJs = `import { RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { HelloWorld } from "./HelloWorld.js";

// The render target: where it all goes - the #app element in index.html.
const target = DOMElementTarget.forElement(document.getElementById("app"));

// The service locator - here, the basic theme: it provides the themed
// widgets your components ask for (button(), card(), ...). HTML elements
// (div(), h1(), ...) are real DOM elements unless a locator says otherwise.
new HelloWorld().renderOnto(target, new RenderContext({ serviceLocator: basicTheme }));`;

const runIt = `npm run dev`;

const iconFonts = `<!-- Material Symbols: the basic theme's icons. Material Icons: the Material theme's. -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />`;

const materialTheme = `npm install @liquefy/cascade.ui.material`;

const materialMainJs = `import { materialTheme } from "@liquefy/cascade.ui.material";

new HelloWorld().renderOnto(target, new RenderContext({ serviceLocator: materialTheme }));`;

const codeStyle = { margin: "8px 0 16px 0", border: "1px solid " + themeColor.border, borderRadius: "8px", overflow: "auto", lineHeight: "1.4" };

const codeBlock = (key, sourceText, language) => new HighlightedCode({ key, source: sourceText, language, style: codeStyle });

// A file name in running text.
const file = (key, name) => code({ key, style: { fontSize: "0.95em" } }, text({ key: key + "Text", text: name }));

export class GettingStartedPage extends Component {
  build() {
    return article(
      { key: "gettingStarted" },
      pageActions({ source, fileName: "src/pages/GettingStartedPage.js" }),
      h1("Getting Started"),
      p(
        "From an empty folder to a running Cascade app, with a logotype and a counter - ",
        emphasis("this one"),
        ", running right here:",
      ),
      div({ key: "live", style: { margin: "16px 0 24px 0" } }, new HelloWorld({ key: "helloWorld" })),

      h2("1. Create a project"),
      p(
        "Any bundler that handles ES modules will do - here, a fresh ", a({ key: "vite", href: "https://vite.dev" }, text({ key: "viteText", text: "Vite" })),
        " project. One package brings in the rest of Cascade with it:",
      ),
      codeBlock("createProject", createProject, "bash"),
      p(
        "You can delete what Vite put in ", file("srcFolder", "src/"), " as an example - ",
        file("counterJs", "counter.js"), ", ", file("styleCss", "style.css"), " and ", file("assets", "assets/"), ".",
      ),

      h2("2. The page"),
      p(
        "Replace ", file("indexHtml", "index.html"), " with this - all it needs is an element for the app to render into:",
      ),
      codeBlock("indexHtml", indexHtml, "html"),

      h2("3. The render target and the service locator"),
      p(
        "Two things tie an app to the page. The ",
        emphasis("render target"), " is where it all goes: here, the ", file("appId", "#app"), " element. The ",
        emphasis("service locator"), ", provided to every component through the render context, is where components ",
        "get what they build with - here, the basic theme, providing ",
        "a themed widget when they ask for ", file("buttonCall", "button()"),
        ". Nothing in an app names a theme: change the service locator, and the whole app changes with it.",
      ),
      p("In ", file("mainJs", "src/main.js"), ":"),
      codeBlock("mainJs", mainJs, "javascript"),

      h2("4. Your first component"),
      p(
        "In ", file("helloWorldJs", "src/HelloWorld.js"), " - the app at the top of this page, as it is. ",
        file("initialState", "initialState()"), " sets up its state; ", file("build", "build()"),
        " describes what it shows, and runs again whenever something it read changes - only what actually changed ",
        "is updated in the page. Each run's result is matched to the previous one - the same kind of component in ",
        "the same place is the same component - so its state and its elements are kept. Only what can move, appear ",
        "or disappear among its siblings - the items of a list - needs a key.",
      ),
      codeBlock("helloWorld", helloWorldSource, "javascript"),

      h2("5. Run it"),
      codeBlock("runIt", runIt, "bash"),
      p("Open the address it prints - typically http://localhost:5173 - and count."),

      h2("Next steps"),
      p(
        "Try the Material theme: install it, and render with it instead of the basic one - the same app, every widget ",
        "replaced.",
      ),
      codeBlock("materialInstall", materialTheme, "bash"),
      codeBlock("materialMain", materialMainJs, "javascript"),
      p(
        "Using icons (", file("iconCall", "icon()"), ", ", file("iconButtonCall", "iconButton()"), ")? Link the icon fonts the themes draw them ",
        "with, in ", file("indexHtmlHead", "index.html"), "'s head:",
      ),
      codeBlock("iconFonts", iconFonts, "html"),
      p(
        "Every page of this demo has a button in the top bar showing its own code - there's a lot more to see: ",
        "layout from real measurements, animations, routing, portals, themes and their colors. And each package ",
        "has a README of its own, from ",
        a({ key: "readme", href: "https://github.com/erobwen/liquefy#cascade" }, text({ key: "readmeText", text: "the repository's" })),
        " on.",
      ),
      nextPage({ key: "convenient", path: "convenient-usage", label: "Ready for more? On to Convenient Usage →" }),
    );
  }
}
