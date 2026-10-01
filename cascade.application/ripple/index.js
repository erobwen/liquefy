import { RenderContext, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { Ripple } from "./src/Ripple.js";

// The services every component in the app gets: real DOM elements, then the
// basic theme's widgets, then a marked placeholder for anything nobody
// provides (see cascade.component's ServiceLocator.js).
const serviceLocator = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator());

// The app is created here, not built by anyone - so it's established here
// (see cascade.component's Component.establish()). It lives as long as the
// page does.
const ripple = new Ripple().establish();
ripple.renderOnto(DOMElementTarget.forElement(document.getElementById("application")), new RenderContext({ serviceLocator }));
