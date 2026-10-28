import { RenderContext } from "@liquefy/cascade.component";
import { browserLocation, documentHead } from "@liquefy/cascade.dom";
import { PrerenderedElementTarget } from "@liquefy/cascade.prerender/client";
import { ApplicationMenuFrame } from "./src/ApplicationMenuFrame.js";
import { IntroductionPage } from "./src/pages/IntroductionPage.js";
import { ShowcasePage } from "./src/pages/ShowcasePage.js";
import { GettingStartedPage } from "./src/pages/GettingStartedPage.js";
import { ConvenientUsagePage } from "./src/pages/ConvenientUsagePage.js";
import { ManualContentsPage, ManualChapterPage, chapters } from "./src/pages/ManualPage.js";
import { AdvancedUsagePage } from "./src/pages/AdvancedUsagePage.js";
import { ProgrammaticReactiveLayout } from "./src/pages/ProgrammaticReactiveLayout.js";
import { RecursiveDemo } from "./src/pages/RecursiveDemo.js";
import { HybridModalDialog } from "./src/pages/HybridModalDialog.js";
import { ThemesPage } from "./src/pages/ThemesPage.js";
import { HydrationPage } from "./src/pages/HydrationPage.js";
import { JsxPage } from "./src/pages/JsxPage.jsx";
import { AnimationPage } from "./src/pages/AnimationPage.js";
import { DrawerPage } from "./src/pages/DrawerPage.js";
import { FileSystemPage } from "./src/pages/fileSystem/FileSystemPage.js";
import { StorePage } from "./src/pages/StorePage.js";
import { FocusStorePage } from "./src/pages/FocusStorePage.js";
import { WordProcessorPage } from "./src/pages/WordProcessorPage.js";
import { ReactiveFormPage } from "./src/pages/ReactiveFormPage.js";
import { ToolbarEllipsisPage } from "./src/pages/ToolbarEllipsisPage.js";
import { ExamplesPage } from "./src/pages/ExamplesPage.js";
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

// A first visit to the app's own address starts with the showcase: decided
// in index.html, before anything is drawn.

// The examples, by what they show (see ExamplesPage): the showcase - the
// most impressive ones - is in the menu too; the rest only on the
// examples page, which the menu leads to (`menuParent`: the menu shows
// that link as the one you're at).
const exampleSections = [
  { title: "Showcase", description: "The most impressive ones - also in the menu." },
  { title: "Layout and UI patterns", description: "Layout from real measurements, and the components that need it." },
  { title: "Other ways to write a UI", description: "The same components, written as JSX or as plain data." },
  { title: "Classics", description: "The demo's first examples - small, and to the point." },
];
const examples = [
  { key: "focus-store", section: "Showcase", title: "Web Store", icon: "storefront", description: "A Cascade example: a web store where a product grows into a close-up over the greyed-out shelf, and flies into the cart.", component: new FocusStorePage().establish() },
  { key: "reactive-form", section: "Showcase", title: "Booking Form", icon: "flight_takeoff", description: "A Cascade example: a travel booking form whose validation and cost follow its data - every change animated.", component: new ReactiveFormPage().establish() },
  { key: "word-processor", section: "Showcase", title: "Word Processor", icon: "edit_document", description: "A Cascade example: a word processor laid out reactively onto pages, with cascade.print.", component: new WordProcessorPage().establish() },
  { key: "file-system", section: "Showcase", title: "File System", icon: "folder_open", description: "A Cascade example: a file system of tags and filter folders - search by category, and find the files that need sorting.", component: new FileSystemPage().establish() },
  { key: "programmatic-layout", section: "Layout and UI patterns", title: "Measured Layout", icon: "dashboard", description: "A Cascade example: layout decided in code, from measured sizes, rebuilt as they change.", component: new ProgrammaticReactiveLayout().establish() },
  { key: "toolbar-ellipsis", section: "Layout and UI patterns", title: "Overflowing Toolbar", icon: "more_horiz", description: "A Cascade example: a toolbar that moves what doesn't fit into an overflow menu.", component: new ToolbarEllipsisPage().establish() },
  { key: "hybrid-modal-dialog", section: "Layout and UI patterns", title: "Linkable Dialog", icon: "open_in_browser", description: "A Cascade example: a modal dialog with an address of its own.", component: new HybridModalDialog().establish() },
  { key: "drawer", section: "Layout and UI patterns", title: "Drawer", icon: "side_navigation", description: "A Cascade example: a drawer sliding in from any edge - modal or not, with a header or a panel of its own.", component: new DrawerPage().establish() },
  { key: "jsx", section: "Other ways to write a UI", title: "JSX", icon: "code", description: "A Cascade example: components written in JSX.", component: new JsxPage().establish() },
  { key: "hydration", section: "Other ways to write a UI", title: "UI as Data", icon: "data_object", description: "A Cascade example: a page written as a document - plain data - and hydrated into components.", component: new HydrationPage().establish() },
  { key: "recursive-demo", section: "Classics", title: "Recursive Tree", icon: "account_tree", description: "A Cascade example: a recursive component tree, rebuilt only where it changes.", component: new RecursiveDemo().establish() },
  { key: "animation", section: "Classics", title: "Animation Basics", icon: "animation", description: "A Cascade example: FLIP animations of elements moving, entering and leaving.", component: new AnimationPage().establish() },
  // { key: "store", title: "Web Store", description: "A Cascade example: a web store.", component: new StorePage().establish() },
].map((example) => example.section === "Showcase"
  ? { ...example, group: "Showcase" }
  : { ...example, inMenu: false, menuParent: "examples" });

// The root and its pages are created here, not built by anyone - so they're
// established here (see cascade.component's Component.establish()). They
// live as long as the app does: nothing to dispose of.
const applicationMenuFrame = new ApplicationMenuFrame({
  rootServiceLocator,
  location,
  // The showcase is reached by the logotype, not from the menu.
  logoPage: "showcase",
  // The manual's chapters take room: opened when wanted.
  collapsibleGroups: ["Reference Manual"],
  pages: [
    { key: "introduction", title: "Introduction", icon: "info", description: "Cascade, a reactive front end framework built on temporal signals: components rendered straight onto the real DOM in one pass.", component: new IntroductionPage().establish() },
    { key: "showcase", title: "Showcase", icon: "auto_awesome", fullScreen: true, inMenu: false, description: "Cascade, the reactive front end framework built on temporal signals - one page that reveals itself as you scroll.", component: new ShowcasePage().establish() },
    // The guide
    { key: "getting-started", group: "Guide", title: "Getting Started", description: "Getting started with Cascade: components, build(), and rendering onto the DOM.", component: new GettingStartedPage().establish() },
    { key: "convenient-usage", group: "Guide", title: "Everyday Usage", description: "Everyday usage of Cascade: the patterns for building components and keeping state.", component: new ConvenientUsagePage().establish() },
    { key: "advanced-usage", group: "Guide", title: "Advanced Usage", description: "Advanced usage of Cascade: render(), targets, contexts, services and the other hard parts.", component: new AdvancedUsagePage().establish() },
    // The reference manual - cascade/docs/manual, a page per chapter.
    { key: "manual", group: "Reference Manual", title: "Contents and Search", description: "The Cascade reference manual: everything to know before building with Cascade, chapter by chapter - and a search through all of it.", component: new ManualContentsPage().establish() },
    ...chapters.map((chapter) => ({
      key: chapter.key, group: "Reference Manual", title: chapter.menuTitle,
      description: "The Cascade reference manual - " + chapter.title + ".",
      component: new ManualChapterPage({ chapter }).establish(),
    })),
    // The examples - the showcase in the menu, then the way to all of them.
    ...examples,
    { key: "examples", group: "Showcase", title: "All Examples", icon: "apps", description: "Every Cascade example in the demo - the showcase, layout and UI patterns, other ways to write a UI, and the classics.", component: new ExamplesPage({ examples, sections: exampleSections }).establish() },
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
