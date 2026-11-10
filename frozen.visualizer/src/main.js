/**
 * The visualizer's entry point: a cascade root on #application, with the basic theme.
 * The scenario in the URL's hash (#rescue) is loaded first.
 */

import { RenderContext, CompoundServiceLocator } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, DOMDebugServiceLocator } from "@liquefy/cascade.dom";
import { basicTheme } from "@liquefy/cascade.ui";
import { VisualizerApp } from "./components/VisualizerApp.js";
import { scenarios } from "./recording/scenarios.js";
import { load } from "./model.js";

const requested = location.hash.slice(1);
load(scenarios.some((s) => s.key === requested) ? requested : scenarios[0].key);

const services = new CompoundServiceLocator(new DOMServiceLocator(), basicTheme, new DOMDebugServiceLocator());
const target = DOMElementTarget.forElement(document.getElementById("application"));
new VisualizerApp().establish().renderOnto(target, new RenderContext({ serviceLocator: services }));
