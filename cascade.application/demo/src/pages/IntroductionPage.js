import { Component } from "@liquefy/cascade.component";
import { div, h1, h2, p, ul, li, a, img, text } from "@liquefy/cascade.dom";
import { themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { HighlightedCode } from "../components/code.js";
import { article, emphasis, nextPage } from "../components/layout.js";
import source from "./IntroductionPage.js?raw";
import temporalSignalsBoard from "../../../../cascade/images/temporal-signals.svg";
import whatIfEverything from "../../../../cascade/images/what-if-everything.svg";
import keyConcepts from "../../../../cascade/images/key-concepts.svg";

// Temporal signals in their smallest form - its printouts as they really
// are (run it with @liquefy/cascade.reactive).
const temporalSignalsExample = `import getWorld from "@liquefy/cascade.reactive";
const { observable, repeat } = getWorld({ timeLevels: 3 });

const heading = observable({ text: "hello world", size: 16 });

// Time 0: capitalizes the text - writing the very property it reads.
repeat(() => { heading.text = heading.text.toUpperCase(); }, { time: 0 });

// Time 1: headings are twice the size - the same, for the size.
repeat(() => { heading.size = heading.size * 2; }, { time: 1 });

// Time 2: sees the heading as times 0 and 1 left it.
repeat(() => console.log(heading.text, heading.size + "px"), { time: 2 });
// HELLO WORLD 32px

heading.text = "temporal signals";
// TEMPORAL SIGNALS 32px - times 0 and 2 run again,
// time 1 doesn't: it never read the text.

heading.size = 20;
// TEMPORAL SIGNALS 40px - times 1 and 2 run again, time 0 doesn't.
// Time 1 reads the new 20, not its own 32: no doubling twice.`;

/**
 * Introduction Page - what Cascade is, and what's new about it: temporal
 * signals. Started from flow.application/demo/src/pages/introductionPage.js
 * (its code button sits in the top bar - see ../components/pageActions.js).
 *
 * Implements only build() - Component's own default render() already
 * builds one step and renderOnto()'s each result in turn (see
 * Component.js), which is all a page reached via DOMProvidingElement
 * (see ApplicationMenuFrame.js's own `workArea`) needs.
 */
export class IntroductionPage extends Component {
  build() {
    return article(
      pageActions({ source, fileName: "src/pages/IntroductionPage.js" }),
      // The banner is see-through: it lies on the theme's own color - so
      // picking another (see the Themes page) recolors it too.
      div(
        { style: { margin: "24px 0 8px 0", borderRadius: "10px", overflow: "hidden", background: themeColor.chrome } },
        img({
          src: whatIfEverything,
          alt: "What if everything was reactive?",
          style: { display: "block", width: "100%" },
        }),
      ),
      h1("Introduction to Cascade"),
      p("Reactive front end framework, with an integrated state management system."),
      p(emphasis("The purpose of Cascade is to make it simple and fast to build advanced user interfaces that are data driven, generative and reactive.")),
      p("Unlike most reactive UI frameworks, Cascade renders directly onto a live target in one pass - reading and writing the real DOM in tree order - rather than building an abstract tree first and reconciling it separately. All while still ensuring minimal changes to the DOM upon change."),
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
      div(
        { style: { margin: "24px 0 8px 0", borderRadius: "10px", overflow: "hidden", background: themeColor.chrome } },
        img({
          src: temporalSignalsBoard,
          alt: "Temporal signals: components - temporal observers - read (R) and write (W) the properties of data objects, along time. A change written to one property reaches only the readers after it in the pipeline.",
          style: { display: "block", width: "100%", margin: "8px 0 16px 0", borderRadius: "8px" },
        })
      ),
      p(
        "In a small form: three readers and writers of the same object, in a pipeline, at three fixed times. The first ",
        "capitalizes the heading's text and the second doubles its size - each by writing the very property it reads - ",
        "and the third sees the result. Change one property, and only the steps that read it along the way run again: ",
        "two of the three, never all of them.",
      ),
      p(
        "With ordinary signals - one value per property - a step can't tell its input from its own output. Reading ",
        "back the size it just doubled, it would either set itself off again, doubling over and over (MobX, for one, ",
        "gives up after 100 rounds), or, where a reaction can't trigger itself, the original size would be lost for ",
        "good, and the next time the step runs it doubles its own result. The way around it is a signal of its own for ",
        "every intermediate value - an explicit dependency graph, built by hand.",
      ),
      new HighlightedCode({
        source: temporalSignalsExample,
        style: { margin: "8px 0 16px 0", border: "1px solid " + themeColor.border, borderRadius: "8px", overflow: "auto", lineHeight: "1.4" },
      }),
      p("In Cascade this mechanism is used to define a reactive order of rendering, so that a parent can render before its children, measure its bounds, and pass the bounds on to its children for programmatic reactive layout. So temporal signals are used in Cascade to build a reactive front end framework with unprecedented precision."),
      p(
        "But the real use case where temporal signals shine is when building ",
        emphasis("WYSIWYG word processors and other document editors"),
        ", which temporal signals are especially engineered for.",
      ),
      nextPage({ path: "getting-started", label: "Do you want to learn more? Get started with Cascade →" }),

      h2("Technical features"),
      ul(
        li(emphasis("Sub-frame render precision"), " Since all components render in a well-defined order in real time with access to the real DOM, it enables advanced animation setup or layout measuring within the same frame."),
        li(emphasis("JS Proxies"), " for fully transparent data dependency tracking - no dependencies to declare."),
        li(emphasis("Temporal signals"), " (see above): Allows for implicit dependency tracking between multiple ordered readers and writers of the same render target."),
        li(emphasis("Minimal DOM updates"), " for fine-grained, targeted change response: a rebuild touches only the nodes that actually changed."),
        li(emphasis("Stable identity across rebuilds"), " - keyed components are matched to the ones they replace, so their local state and DOM elements are kept. For simpler static structures, the system also uses pattern matching to reuse already established components."),
        li(emphasis("Component lifecycle control"), " - a component that stops being rendered (a page switched away from, a breakpoint) keeps its state and DOM elements, and comes back as it was."),
        li(emphasis("Programmatic responsive layout"), " driven by real DOM measurement rather than CSS media queries - see the menu breakpoint, and the Programmatic Reactive Layout page."),
        li(emphasis("Service locators throughout"), " - every element and widget is asked for, not constructed, so themes can replace whole components at runtime, and any part of the app can have services of its own (see the Themes page)."),
        li(emphasis("Component inheritance"), " - Conveniently inherit properties from structural parents."),
        li(emphasis("Hydration"), " - a UI can be written as a document: plain data, a tree of service queries, turned into components by the same service locators (see the Hydration page)."),
        li(emphasis("DOM transition animations"), " - elements moving within or between parents, resizing, appearing and leaving all animate, with no changes to the components animated (see the Animation page)."),
        li(emphasis("Portals"), " - a component can put content somewhere else in the tree, as this demo's pages do with their buttons in the top bar."),
        li(emphasis("JavaScript first"), " - no CSS files, and no compile step required: the user interface is built with plain JavaScript functions."),
        li(emphasis("JSX support"), " - for those who prefer it: JSX tags compile to service queries, a document that hydrate() turns into components, just like on the Hydration page (see the JSX page)."),
      ),
      
      h2("Key concepts"),
      div(
        { style: { margin: "24px 0 8px 0", borderRadius: "10px", overflow: "hidden", background: themeColor.chrome } },
        img({
          src: keyConcepts,
          alt: "Key concepts",
          style: { display: "block", width: "100%" },
        }),
      ),
      p("Components can override either build() or render(). 'Build components' just build children and let them do all work. 'Render components' however interact directly with the render target and give direct render instructions. Both see the render context - what the components around them provide - which holds only timeless values: build components see the final value of every property."),
      
      h2("Conventions, or the lack thereof"),
      p("Cascade offers opportunities and features, with as few requirements as possible. There are multiple ways to do the same thing in this framework, and everyone can find a style of development that fits them. For example:"),
      ul(
        li("The service locator is totally optional. If someone wants to build an app without it that works fine as well. Components then just construct their children directly. "),
        li("When it comes to creating components, you can either:",
          ul(
            li("Call the component constructor directly"), 
            li("Call one of many convenience functions that indirectly gets the component from the service locator OR in some cases constructs them directly"),
            li("Write JSX inside your component, which compiles to a compound request object - a document of service queries - that hydrate() hands to the service locator")
          )
        ),
        li("Building children in the build function is a convenience and allows for the use of keys to maintain a stable object identity, but a parent can also construct a child during its initialization and dispose of it when the parent itself is disposed. Components can also be constructed entirely outside of the framework."), 
        li("Most components delegate their rendering to a sequence of children, but other components could implement the render function directly and take charge of DOM manipulation directly."),
        li("As a rule of thumb, app components build, and library components render. Because if there is a need to take control and render something, it could probably be built into a reusable component. But someone might build a render-oriented application by only implementing the render function for all components, and that could have its merits too."),
        li("Today there is cascade.DOM that allows for rendering an application on a DOM, but another implementation of the render target could have the same app operate on top of totally different infrastructure. (Think React Native, or server-side rendering as in Next.js.)"),
      ),

      h2("Are you a React developer?"),
      p("React and Cascade are very different, but they also share some common DNA - the author of Cascade was a huge fan of React from its very start."),
      p(emphasis("Similarities")),
      ul(
        li("React's render functions with keys are very similar to Cascade's build functions, with keys and pattern matching."),
        li("Cascade supports JSX syntax, for those who want it."),
      ),
      p(emphasis("Differences")),
      ul(
        li("React has a black box render cycle, where you can only interact with the DOM between renders. Cascade lets your own code go in and analyze and modify the DOM during the render. So many things that would take several frames in React can be done in a single frame."),
        li("Cascade has a state management system of its own, based on JS Proxies, whereas React is usually paired up with an external system for its application state."),
        li(
          "Object orientation vs. pure functional programming. ", emphasis("\"React went down a path I could not follow.\""), " React started ",
          "out object oriented, with lifecycle functions, and later shifted towards functional programming. The reason ",
          "is probably Redux: a state management system based on functional programming, using immutable objects and ",
          "root identity to detect changes. Cascade, however, can stay object oriented, since its JS Proxies detect ",
          "changes in any object.",
        ),
      ),
      p("Cascade is what you would get if you took all the capabilities of React and MobX, added temporal signals, and mixed it all together. It can do everything those systems can do - but with temporal signals and sub-frame precision, it takes it to the next level."),

      h2("Repository"),
      a(text("https://github.com/erobwen/liquefy"), { href: "https://github.com/erobwen/liquefy" }),
      p("This demo is a work in progress."),
    );
  }
}
