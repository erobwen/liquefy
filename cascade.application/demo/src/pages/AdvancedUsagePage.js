import { Component } from "@liquefy/cascade.component";
import { h1, h2, h3, p } from "@liquefy/cascade.dom";
import { pageActions } from "../components/pageActions.js";
import { article, emphasis } from "../components/layout.js";
import { codeBlock, stage, name } from "../components/examples.js";
import { GaugeDemo } from "./advanced/Gauge.js";
import { DoubleGaugeDemo } from "./advanced/DoubleGauge.js";
import { TranslationDemo } from "./advanced/Translation.js";
import { Measured } from "./advanced/Measured.js";
import { KeepAlive } from "./advanced/KeepAlive.js";
import gaugeSource from "./advanced/Gauge.js?raw";
import doubleGaugeSource from "./advanced/DoubleGauge.js?raw";
import paperSource from "./advanced/Paper.js?raw";
import translationSource from "./advanced/Translation.js?raw";
import measuredSource from "./advanced/Measured.js?raw";
import keepAliveSource from "./advanced/KeepAlive.js?raw";
import source from "./AdvancedUsagePage.js?raw";

/**
 * Advanced Usage - the continuation of Convenient Usage, straight to some of
 * the hardest things, so they're known to be possible. Every example is a
 * file of its own in ./advanced/, shown as it is - and, but for the render
 * target on paper (a script, run with Node: no DOM involved at all),
 * running right on the page, with this app's own services.
 */

// How this demo keeps its pages - an excerpt of its own index.js.
const pagesExcerpt = `// Created once, outside of any build - established here, and handed to the frame.
const applicationMenuFrame = new ApplicationMenuFrame({
  rootServiceLocator,
  location,
  pages: [
    { key: "introduction", title: "Introduction", component: new IntroductionPage().establish() },
    { key: "getting-started", title: "Getting Started", component: new GettingStartedPage().establish() },
    // ...
  ],
}).establish();`;

export class AdvancedUsagePage extends Component {
  build() {
    return article(
      { key: "advancedUsage" },
      pageActions({ source, fileName: "src/pages/AdvancedUsagePage.js" }),
      h1("Advanced Usage"),
      p(
        "Picking up where Convenient Usage left off - and going straight to some of the hardest things, so you know ",
        "they're there when you need them.",
      ),

      h2("Render components"),
      p(emphasis("Take full control over your rendering cycle.")),
      p(
        "Most components only build - describe what they show, in other components. A render component does the ",
        "rendering itself, straight onto the DOM, any way it likes: this gauge writes its own SVG, as a template ",
        "literal. What Cascade provides is the rest: a well defined render order between all of your components, ",
        "and proper invalidation and revalidation - the gauge is drawn again exactly when something it read has ",
        "changed, and only then. How it draws is up to you.",
      ),
      stage("gaugeStage", new GaugeDemo({ key: "gaugeDemo" })),
      codeBlock("gaugeCode", gaugeSource),
      h3("Is one node not enough for your component?"),
      p(
        "Then implement render() itself. A component renders onto its ", name("target", "target"), " - the element ",
        "its parent renders into - and can put there as many nodes as it likes: right after ",
        name("lastChild", "target.lastChild"), ", the node rendered just before it, and then it advances lastChild to ",
        "the last of its own. This double gauge is two nodes, side by side in the row, with no wrapper around them.",
      ),
      p(
        "Here is where temporal signals show their magic. lastChild is one property, written by every component in the ",
        "row in turn - yet each one reads it as the component just before it left it. So \"After both\" lands after the ",
        "second gauge, without knowing there are two. Swap the gauges, and lastChild changes for what comes after: the ",
        "double gauge renders again, and so does \"After both\" - it read lastChild - but \"Before\" doesn't. Move a ",
        "slider, and lastChild stays the same: only the double gauge renders again.",
      ),
      stage("doubleGaugeStage", new DoubleGaugeDemo({ key: "doubleGaugeDemo" })),
      codeBlock("doubleGaugeCode", doubleGaugeSource),

      h2("Not just for rendering on a DOM"),
      p(
        "A render target is where components render - and it can be anything: a subclass of your own, with a state ",
        "of its own. Here, a paper that words lay themselves out on, in lines - its cursor (where the next word goes) ",
        "read and written by each word in turn. Change a word, and only it and the words after it lay out again: each ",
        "word sees the cursor as the word before it left it, which is what temporal signals are for. Not a DOM ",
        "element anywhere - it runs just as well in Node.",
      ),
      p(
        "The same way, a render target could wrap another native UI framework, and have Cascade components render ",
        "onto its widgets. (Temporal signals work on objects' properties so far - temporal arrays are still to come - ",
        "which is why the paper keeps its state in plain properties.)",
      ),
      codeBlock("paperCode", paperSource),

      h2("Implement your own service provider"),
      p(emphasis("Endless configuration of an existing application.")),
      p(
        "Everything a component builds with - every HTML element, every themed widget, every text - it asks for, ",
        "through the service locator in its render context. So a part of an app can be given services of its own, ",
        "without changing a line of it. Here, an existing component - twice: as it is, and inside a service provider ",
        "that hands out every text in Swedish. The same idea styles, instruments or replaces anything, anywhere.",
      ),
      stage("translationStage", new TranslationDemo({ key: "translationDemo" })),
      codeBlock("translationCode", translationSource),

      h2("Layout from real measurements"),
      p(
        "A component can lay itself out by the room it really has, measured: ", name("bounds", "elementBoundsProvider()"),
        " measures its own element, and hands the size to its child. Drag the frame's corner - no media queries, and ",
        "not the window's size: the component's own.",
      ),
      stage("measuredStage", new Measured({ key: "measured" })),
      codeBlock("measuredCode", measuredSource),

      h2("How to keep your children alive off screen"),
      p(
        "Switching pages in Cascade is lightning fast, because nothing is rebuilt: a page switched away from keeps ",
        "its whole tree of DOM nodes, waiting off screen, with its state - and switching back just puts it back in ",
        "place. But that only works for children that stay alive. A keyed child that its parent's build() doesn't ",
        "construct, even once, is gone for good: the next time it's built, it's a new one - new state, new DOM.",
      ),
      p(
        "Count up in each, switch tab, and switch back - the first forgets, the other two remember:",
      ),
      stage("keepAliveStage", new KeepAlive({ key: "keepAlive" })),
      h3("1. Build them in every build - and show them with .showIf()"),
      p(
        "Create your children in build(), with a key - but don't hide them behind an ", name("if", "if"), ". Build them ",
        "every time, and leave them out with ", name("show", ".showIf(condition)"), " instead: a child built but not ",
        "shown is only hidden, while its key keeps it alive.",
      ),
      h3("2. Take full control"),
      p(
        "Create them yourself, once, in ", name("initialUnobservables", "initialUnobservables()"), " - and since no build ",
        "does it for you, call ", name("establish", "establish()"), " on them there, and ", name("dispose", "dispose()"), " in ",
        "your own ", name("onDispose", "onDispose()"), ". Skip the dispose, and a child reading data that never changes ",
        "again is never invalidated - it holds on to all it built and subscribed to, for good. Unobservables, because ",
        "nothing needs to observe the references - an observable property for them would only be overhead. Then ",
        "build() just places them, where and when it likes.",
      ),
      codeBlock("keepAliveCode", keepAliveSource),
      h3("3. Outside of Cascade altogether"),
      p(
        "Create them where no build ever sees them being created - in a module, or anywhere else outside of any ",
        "component - and hand them in as properties. That's how this very demo keeps its pages. Establish them ",
        "where you create them; nothing disposes them, so it's for what lives as long as the app does.",
      ),
      codeBlock("pagesCode", pagesExcerpt),
      p(
        emphasis("A word of warning: never combine these methods."),
        " A child constructed inside build() belongs to that build, even if you keep a reference to it as well: the ",
        "first build that doesn't construct it disposes it - out from under your reference.",
      ),
    );
  }
}
