import { RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget, browserLocation } from "@liquefy/cascade.dom";
import { ApplicationMenuFrame } from "./src/ApplicationMenuFrame.js";
import { IntroductionPage } from "./src/pages/IntroductionPage.js";
import { ProgrammaticReactiveLayout } from "./src/pages/ProgrammaticReactiveLayout.js";
import { RecursiveDemo } from "./src/pages/RecursiveDemo.js";
import { HybridModalDialog } from "./src/pages/HybridModalDialog.js";
import { ThemesPage } from "./src/pages/ThemesPage.js";
import { HydrationPage } from "./src/pages/HydrationPage.js";
import { AnimationPage } from "./src/pages/AnimationPage.js";
import { StorePage } from "./src/pages/StorePage.js";
import { rootServiceLocator } from "./src/services.js";
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
// The services every component in the app gets (HTML elements, the current
// theme's widgets, ...) travel down from here - see src/services.js.
const context = new RenderContext(DOMElementTarget.forElement(document.getElementById("application")), { serviceLocator: rootServiceLocator });

// Handed to the root component too, which provides it to the whole app as
// `rootServiceLocator` - the only way to *change* the app's services (see
// src/services.js).
// Which page is shown follows the URL - below wherever the app is served
// from (Vite's base).
const location = browserLocation({ base: import.meta.env.BASE_URL });

const applicationMenuFrame = new ApplicationMenuFrame({
  rootServiceLocator,
  location,
  pages: [
    { key: "introduction", title: "Introduction", component: new IntroductionPage() },
    { key: "programmatic-layout", title: "Programmatic Reactive Layout", component: new ProgrammaticReactiveLayout() },
    { key: "recursive-demo", title: "Recursive Demo", component: new RecursiveDemo() },
    { key: "hybrid-modal-dialog", title: "Hybrid Modal Dialog", component: new HybridModalDialog() },
    { key: "themes", title: "Themes", component: new ThemesPage() },
    { key: "hydration", title: "Hydration", component: new HydrationPage() },
    { key: "animation", title: "Animation", component: new AnimationPage() },
    { key: "store", title: "Web Store", component: new StorePage() },
  ],
});
applicationMenuFrame.renderOnto(context);
