import { RenderContext } from "@liquefy/cascade.component";
import { browserLocation, documentHead } from "@liquefy/cascade.dom";
import { PrerenderedElementTarget } from "@liquefy/cascade.prerender/client";
import { ApplicationMenuFrame } from "./src/ApplicationMenuFrame.js";
import { IntroductionPage } from "./src/pages/IntroductionPage.js";
import { GettingStartedPage } from "./src/pages/GettingStartedPage.js";
import { ConvenientUsagePage } from "./src/pages/ConvenientUsagePage.js";
import { AdvancedUsagePage } from "./src/pages/AdvancedUsagePage.js";
import { ProgrammaticReactiveLayout } from "./src/pages/ProgrammaticReactiveLayout.js";
import { RecursiveDemo } from "./src/pages/RecursiveDemo.js";
import { HybridModalDialog } from "./src/pages/HybridModalDialog.js";
import { ThemesPage } from "./src/pages/ThemesPage.js";
import { HydrationPage } from "./src/pages/HydrationPage.js";
import { JsxPage } from "./src/pages/JsxPage.jsx";
import { AnimationPage } from "./src/pages/AnimationPage.js";
import { DrawerPage } from "./src/pages/DrawerPage.js";
import { StorePage } from "./src/pages/StorePage.js";
import { FocusStorePage } from "./src/pages/FocusStorePage.js";
import { WordProcessorPage } from "./src/pages/WordProcessorPage.js";
import { ReactiveFormPage } from "./src/pages/ReactiveFormPage.js";
import { ToolbarEllipsisPage } from "./src/pages/ToolbarEllipsisPage.js";
import { rootServiceLocator } from "./src/services.js";
import { setUpVersionNotice } from "./src/versionNotice.js";
import faviconSvg from "../../cascade/images/favicon.svg";
import faviconPng from "../../cascade/images/favicon.png";

// The Cascade favicon - the SVG where the browser takes one (sharp at any
// size), the PNG otherwise, and for iOS home screens. Added from here
// rather than in index.html: the images live outside this demo, where only
// an import reaches them (Vite serves them, and bundles them in a build).
for (const [rel, type, href, sizes] of [
  ["icon", "image/png", faviconPng, "255x255"],
  ["icon", "image/svg+xml", faviconSvg, "any"],
  ["apple-touch-icon", "image/png", faviconPng, "255x255"],
]) {
  const link = document.createElement("link");
  Object.assign(link, { rel, type, href });
  link.setAttribute("sizes", sizes);
  document.head.appendChild(link);
}


// ApplicationMenuFrame is build()-only (see its own class doc), so this
// starts it directly on a DOMElementTarget root - DOMElementBoundsProvider's own
// div lands as a *direct* child of #application, with no intermediate
// bridging div in between.
//
// Where it all goes: the #application element - below a notice, where the
// demo is the one deployed from main (see src/versionNotice.js). Its pages
// are prerendered (see vite.config.js): a PrerenderedElementTarget replaces
// the snapshot a page came with by the live app.
const application = document.getElementById("application");
setUpVersionNotice(application);
const target = PrerenderedElementTarget.forElement(application);

// The services every component in the app gets (HTML elements, the current
// theme's widgets, ...) are provided from here, by the root render context
// - see src/services.js.
const context = new RenderContext({ serviceLocator: rootServiceLocator });

// Handed to the root component too, which provides it to the whole app as
// `rootServiceLocator` - the only way to *change* the app's services (see
// src/services.js).
// Which page is shown follows the URL - below wherever the app is served
// from (Vite's base).
const location = browserLocation({ base: import.meta.env.BASE_URL });

// The root and its pages are created here, not built by anyone - so they're
// established here (see cascade.component's Component.establish()). They
// live as long as the app does: nothing to dispose of.
const applicationMenuFrame = new ApplicationMenuFrame({
  rootServiceLocator,
  location,
  pages: [
    { key: "introduction", title: "Introduction", icon: "info", description: "Cascade, a reactive front end framework built on temporal signals: components rendered straight onto the real DOM in one pass.", component: new IntroductionPage().establish() },
    { key: "getting-started", title: "Getting Started", description: "Getting started with Cascade: components, build(), and rendering onto the DOM.", component: new GettingStartedPage().establish() },
    { key: "convenient-usage", title: "Convenient Usage", description: "Convenient usage of Cascade: the everyday patterns for building components and keeping state.", component: new ConvenientUsagePage().establish() },
    { key: "advanced-usage", title: "Advanced Usage", description: "Advanced usage of Cascade: render(), targets, contexts, services and the other hard parts.", component: new AdvancedUsagePage().establish() },
    // Examples
    { key: "reactive-form", group: "Examples", title: "Reactive Form", description: "A Cascade example: a form whose validation and derived values follow its data.", component: new ReactiveFormPage().establish() },
    { key: "focus-store", group: "Examples", title: "Focus Store", description: "A Cascade example: a web store where a product grows into a close-up over the greyed-out shelf.", component: new FocusStorePage().establish() },
    { key: "toolbar-ellipsis", group: "Examples", title: "Toolbar Ellipsis", description: "A Cascade example: a toolbar that moves what doesn't fit into an overflow menu.", component: new ToolbarEllipsisPage().establish() },
    // { key: "store", group: "Examples", title: "Web Store", description: "A Cascade example: a web store.", component: new StorePage().establish() },
    { key: "hybrid-modal-dialog", group: "Examples", title: "Hybrid Modal Dialog", description: "A Cascade example: a modal dialog with an address of its own.", component: new HybridModalDialog().establish() },
    { key: "word-processor", group: "Examples", title: "Word Processor", description: "A Cascade example: a word processor laid out reactively onto pages, with cascade.print.", component: new WordProcessorPage().establish() },
    { key: "hydration", group: "Examples", title: "Hydration", description: "A Cascade example: a page written as a document - plain data - and hydrated into components.", component: new HydrationPage().establish() },
    { key: "jsx", group: "Examples", title: "JSX", description: "A Cascade example: components written in JSX.", component: new JsxPage().establish() },
    { key: "programmatic-layout", group: "Examples", title: "Programmatic Reactive Layout", description: "A Cascade example: layout decided in code, from measured sizes, rebuilt as they change.", component: new ProgrammaticReactiveLayout().establish() },
    { key: "recursive-demo", group: "Examples", title: "Recursive Example", description: "A Cascade example: a recursive component tree, rebuilt only where it changes.", component: new RecursiveDemo().establish() },
    { key: "animation", group: "Examples", title: "Animation", description: "A Cascade example: FLIP animations of elements moving, entering and leaving.", component: new AnimationPage().establish() },
    { key: "drawer", group: "Examples", title: "Drawer", description: "A Cascade example: a drawer sliding in from any edge - modal or not, with a header or a panel of its own.", component: new DrawerPage().establish() },
    
    //Themes
    { key: "themes", title: "Themes", icon: "palette", description: "Cascade's themes: the same app with basic and Material widgets, in any color.", component: new ThemesPage().establish() },
  ],
}).establish();
applicationMenuFrame.renderOnto(target, context);

// The head follows the page shown: its title, its description, and its own
// address - what search engines and link previews read (and what a
// prerendered page is written with, see vite.config.js).
documentHead(() => {
  const page = applicationMenuFrame.currentPage();
  const first = page === applicationMenuFrame.pages[0];
  return {
    title: first ? "Cascade" : page.title + " - Cascade",
    description: page.description,
    canonical: location.href(applicationMenuFrame.pathOf(page)),
  };
});
