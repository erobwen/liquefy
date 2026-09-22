import { RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "@liquefy/cascade.dom";
import { ApplicationMenuFrame } from "./src/ApplicationMenuFrame.js";
import { IntroductionPage } from "./src/pages/IntroductionPage.js";
import { ProgrammaticReactiveLayout } from "./src/pages/ProgrammaticReactiveLayout.js";
import { RecursiveDemo } from "./src/pages/RecursiveDemo.js";

// ApplicationMenuFrame is build()-only (see its own class doc), so this
// starts it directly on a DOMTarget root - DOMElementBoundsProvider's own
// div lands as a *direct* child of #application, with no intermediate
// bridging div in between.
const context = new RenderContext(DOMTarget.forElement(document.getElementById("application")));

const applicationMenuFrame = new ApplicationMenuFrame({
  pages: [
    { key: "introduction", title: "Introduction", component: new IntroductionPage() },
    { key: "programmatic-layout", title: "Programmatic Reactive Layout", component: new ProgrammaticReactiveLayout() },
    { key: "recursive-demo", title: "Recursive Demo", component: new RecursiveDemo() },
  ],
});
applicationMenuFrame.renderOnto(context);
