import { RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget, FlipAnimationContainer, browserLocation } from "@liquefy/cascade.dom";
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
import { StorePage } from "./src/pages/StorePage.js";
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
// demo is the one deployed from main (see src/versionNotice.js).
const application = document.getElementById("application");
setUpVersionNotice(application);
const target = DOMElementTarget.forElement(application);

// Every animation at half its natural pace - so what happens in the demo is
// easy to follow.
FlipAnimationContainer.speed = 0.5;

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
    { key: "introduction", title: "Introduction", icon: "info", component: new IntroductionPage().establish() },
    { key: "getting-started", title: "Getting Started", component: new GettingStartedPage().establish() },
    { key: "convenient-usage", title: "Convenient Usage", component: new ConvenientUsagePage().establish() },
    { key: "advanced-usage", title: "Advanced Usage", component: new AdvancedUsagePage().establish() },
    { key: "programmatic-layout", group: "Examples", title: "Programmatic Reactive Layout", component: new ProgrammaticReactiveLayout().establish() },
    { key: "toolbar-ellipsis", group: "Examples", title: "Toolbar Ellipsis", component: new ToolbarEllipsisPage().establish() },
    { key: "recursive-demo", group: "Examples", title: "Recursive Demo", component: new RecursiveDemo().establish() },
    { key: "reactive-form", group: "Examples", title: "Reactive Form", component: new ReactiveFormPage().establish() },
    { key: "hybrid-modal-dialog", group: "Examples", title: "Hybrid Modal Dialog", component: new HybridModalDialog().establish() },
    { key: "hydration", group: "Examples", title: "Hydration", component: new HydrationPage().establish() },
    { key: "jsx", group: "Examples", title: "JSX", component: new JsxPage().establish() },
    { key: "animation", group: "Examples", title: "Animation", component: new AnimationPage().establish() },
    { key: "store", group: "Examples", title: "Web Store", component: new StorePage().establish() },
    { key: "word-processor", group: "Examples", title: "Word Processor", component: new WordProcessorPage().establish() },
    { key: "themes", title: "Themes", icon: "palette", component: new ThemesPage().establish() },
  ],
}).establish();
applicationMenuFrame.renderOnto(target, context);
