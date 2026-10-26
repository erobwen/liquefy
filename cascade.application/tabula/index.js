import { RenderContext, CompoundServiceLocator, ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { TabulaApp } from "./src/shell/TabulaApp.js";
import { plugins } from "./src/plugins/index.js";
import { persistSettings } from "./src/shell/settings.js";

// The services every component in the app gets: real DOM elements, then the
// basic theme's widgets, then a marked placeholder for anything nobody
// provides (see cascade.component's ServiceLocator.js).
const serviceLocator = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator());

// Tabula's own: the plugins in use - all of them, to start with. The user
// changes which, in the settings; observable, so the app follows.
const services = new ObservableCompoundServiceLocator(...plugins);

// How Tabula is set up - its own settings, and every kind of document's:
// kept in this browser between visits (see src/shell/settings.js).
const settings = persistSettings("tabula.settings");

// The app is created here, not built by anyone - so it's established here
// (see cascade.component's Component.establish()). It lives as long as the
// page does. The classic Tabula app is at classic.html (classic.js).
const tabula = new TabulaApp({ plugins, services, settings }).establish();
tabula.renderOnto(DOMElementTarget.forElement(document.getElementById("application")), new RenderContext({ serviceLocator }));
