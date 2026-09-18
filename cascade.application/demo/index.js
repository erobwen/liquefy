import { RenderContext } from "@liquefy/cascade.component";
import { DOMTargetElement } from "@liquefy/cascade.dom";
import { ApplicationMenuFrame } from "./src/ApplicationMenuFrame.js";
import { IntroductionPage } from "./src/pages/IntroductionPage.js";
import { ProgrammaticReactiveLayout } from "./src/pages/ProgrammaticReactiveLayout.js";

const root = DOMTargetElement.forElement(document.getElementById("application"));
const context = new RenderContext(root);

const applicationMenuFrame = new ApplicationMenuFrame({
  pages: [
    { key: "introduction", title: "Introduction", component: new IntroductionPage() },
    { key: "programmatic-layout", title: "Programmatic Reactive Layout", component: new ProgrammaticReactiveLayout() },
  ],
});
applicationMenuFrame.renderOnto(context);

window.addEventListener("resize", () => {
  applicationMenuFrame.unobservable.repeater.restart();
});
