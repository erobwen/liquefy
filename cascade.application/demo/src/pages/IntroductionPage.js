import { Component } from "@liquefy/cascade.component";
import { h1, h2, p, ul, li, a, img, text } from "@liquefy/cascade.dom";
import { pageActions } from "../components/pageActions.js";
import { article, emphasis } from "../components/layout.js";
import source from "./IntroductionPage.js?raw";
import temporalSignalsBoard from "../../../../cascade/images/temporal-signals.svg";

/**
 * Introduction Page - what Cascade is, and what's new about it: temporal
 * signals. Started from flow.application/demo/src/pages/introductionPage.js
 * (its code button sits in the top bar - see ../components/pageActions.js).
 *
 * Implements only build() - Component's own default render() already
 * builds one step and renderOnto()'s each result in turn (see
 * Component.js), which is all a page reached via DOMContextContainer
 * (see ApplicationMenuFrame.js's own `workArea`) needs.
 */
export class IntroductionPage extends Component {
  build() {
    return article(
      { key: "introduction" },
      pageActions({ source, fileName: "src/pages/IntroductionPage.js" }),
      h1("Introduction to Cascade"),
      p("Reactive front end framework, with an integrated state management system."),
      p(emphasis("The purpose of Cascade is to make it simple and fast to build advanced user interfaces that are data driven, generative and reactive.")),
      p("Unlike most reactive UI frameworks, Cascade renders directly onto a live target in one pass - reading and writing the real DOM in tree order - rather than building an abstract tree first and reconciling it separately."),
      h2("World's first: Temporal Signals"),
      p(
        "Signals are great for building reactive systems, and they come in many forms and shapes, such as properties " +
        "of MobX observables or Vue property values. But the problem with signals is: ",
        emphasis("there is usually only one signal per object and per property."),
      ),
      p("This means that with signals you are forced to build an explicit dependency graph, storing intermediary values as their own signals."),
      p("But this is not how rendering and document transformation is normally done! When rendering, and when transforming documents, there is a sequence of operations that transform the same object."),
      p(
        emphasis("Temporal signals"),
        " allow us to build a pipeline of readers and writers of data that manipulate the same data objects. " +
        "They each operate within their own time frame, only invalidating other readers downstream in the pipeline.",
      ),
      p("Where signals introduce the space dimension for observation, temporal signals also introduce the time dimension for observation."),
      img({
        key: "temporalSignalsBoard",
        src: temporalSignalsBoard,
        alt: "Temporal signals: components - temporal observers - read (R) and write (W) the properties of data objects, along time. A change written to one property reaches only the readers after it in the pipeline.",
        style: { display: "block", width: "100%", maxWidth: "600px", margin: "8px 0 16px 0", borderRadius: "8px" },
      }),
      p("In Cascade this mechanism is used to define a reactive order of rendering, so that a parent can render before its children, measure its bounds, and pass the bounds on to its children for programmatic reactive layout. So temporal signals are used in Cascade to build a reactive front end framework with unprecedented precision."),
      p(
        "But the real use case where temporal signals shine is when building ",
        emphasis("WYSIWYG word processors and other document editors"),
        ", which temporal signals are especially engineered for.",
      ),
      h2("Technical features"),
      ul(
        li(emphasis("Temporal signals"), " (see above): readers and writers of the same objects, ordered in time - rendering follows the tree, so what a parent measures reaches its children in the same pass."),
        li(emphasis("JS Proxies"), " for fully transparent data dependency tracking - no dependencies to declare."),
        li(emphasis("Minimal DOM updates"), " for fine-grained, targeted change response: a rebuild touches only the nodes that actually changed."),
        li(emphasis("Stable identity across rebuilds"), " - keyed components are matched to the ones they replace, so their local state and DOM elements are kept."),
        li(emphasis("Component lifecycle control"), " - a component that stops being rendered (a page switched away from, a breakpoint) keeps its state and DOM elements, and comes back as it was."),
        li(emphasis("Programmatic responsive layout"), " driven by real DOM measurement rather than CSS media queries - see the menu breakpoint, and the Programmatic Reactive Layout page."),
        li(emphasis("Service locators throughout"), " - every element and widget is asked for, not constructed, so themes can replace whole components at runtime, and any part of the app can have services of its own (see the Themes page)."),
        li(emphasis("Component inheritance"), " - Conveniently inherit properties from structural parents."),
        li(emphasis("Hydration"), " - a UI can be written as a document: plain data, a tree of service queries, turned into components by the same service locators (see the Hydration page)."),
        li(emphasis("DOM transition animations"), " - elements moving within or between parents, resizing, appearing and leaving all animate, with no changes to the components animated (see the Animation page)."),
        li(emphasis("Portals"), " - a component can put content somewhere else in the tree, as this demo's pages do with their buttons in the top bar."),
        li(emphasis("JavaScript first"), " - no JSX, no CSS files: the user interface is built with plain JavaScript functions."),
      ),
      h2("Repository"),
      a(text("https://github.com/erobwen/liquefy"), { href: "https://github.com/erobwen/liquefy" }),
      p("This demo is a work in progress."),
    );
  }
}
