import { RenderContext } from "@liquefy/cascade.component";
import { DOMElementTarget } from "@liquefy/cascade.dom";
import { ApplicationMenuFrame } from "./src/ApplicationMenuFrame.js";
import { IntroductionPage } from "./src/pages/IntroductionPage.js";
import { ProgrammaticReactiveLayout } from "./src/pages/ProgrammaticReactiveLayout.js";
import { RecursiveDemo } from "./src/pages/RecursiveDemo.js";
import { HybridModalDialog } from "./src/pages/HybridModalDialog.js";
import { ThemesPage } from "./src/pages/ThemesPage.js";
import { HydrationPage } from "./src/pages/HydrationPage.js";
import { AnimationPage } from "./src/pages/AnimationPage.js";
import { rootServiceLocator } from "./src/services.js";

// Each page's own source, shown by the code button in the top bar (see
// src/components/code.js).
import introductionPageSource from "./src/pages/IntroductionPage.js?raw";
import programmaticReactiveLayoutSource from "./src/pages/ProgrammaticReactiveLayout.js?raw";
import recursiveDemoSource from "./src/pages/RecursiveDemo.js?raw";
import hybridModalDialogSource from "./src/pages/HybridModalDialog.js?raw";
import themesPageSource from "./src/pages/ThemesPage.js?raw";
import hydrationPageSource from "./src/pages/HydrationPage.js?raw";
import animationPageSource from "./src/pages/AnimationPage.js?raw";

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
const applicationMenuFrame = new ApplicationMenuFrame({
  rootServiceLocator,
  pages: [
    { key: "introduction", title: "Introduction", component: new IntroductionPage(), source: introductionPageSource, fileName: "src/pages/IntroductionPage.js" },
    { key: "programmatic-layout", title: "Programmatic Reactive Layout", component: new ProgrammaticReactiveLayout(), source: programmaticReactiveLayoutSource, fileName: "src/pages/ProgrammaticReactiveLayout.js" },
    { key: "recursive-demo", title: "Recursive Demo", component: new RecursiveDemo(), source: recursiveDemoSource, fileName: "src/pages/RecursiveDemo.js" },
    { key: "hybrid-modal-dialog", title: "Hybrid Modal Dialog", component: new HybridModalDialog(), source: hybridModalDialogSource, fileName: "src/pages/HybridModalDialog.js" },
    { key: "themes", title: "Themes", component: new ThemesPage(), source: themesPageSource, fileName: "src/pages/ThemesPage.js" },
    { key: "hydration", title: "Hydration", component: new HydrationPage(), source: hydrationPageSource, fileName: "src/pages/HydrationPage.js" },
    { key: "animation", title: "Animation", component: new AnimationPage(), source: animationPageSource, fileName: "src/pages/AnimationPage.js" },
  ],
});
applicationMenuFrame.renderOnto(context);
