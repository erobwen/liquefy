import { Component } from "@liquefy/cascade.component";
import { h1, h2, h3, p } from "@liquefy/cascade.dom";
import { pageActions } from "../components/pageActions.js";
import { article, emphasis, nextPage } from "../components/layout.js";
import { codeBlock, stage, name } from "../components/examples.js";
import { GaugeDemo } from "./advanced/Gauge.js";
import { ThermometersDemo } from "./advanced/Thermometers.js";
import { TranslationDemo } from "./advanced/Translation.js";
import { Measured } from "./advanced/Measured.js";
import { KeepAlive } from "./advanced/KeepAlive.js";
import gaugeSource from "./advanced/Gauge.js?raw";
import thermometersSource from "./advanced/Thermometers.js?raw";
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

// Prerendering a shop: the build, and the app's start.
const prerenderConfigExcerpt = `// vite.config.js
import { defineConfig } from "vite";
import { cascadePrerender } from "@liquefy/cascade.prerender";

export default defineConfig({
  plugins: [
    cascadePrerender({
      site: "https://shop.example",
      // Where to start - every page they link to is found too.
      routes: async () => ["", ...(await fetchProductIds()).map((id) => "product/" + id)],
      exclude: [/^checkout/, /^account/],
    }),
  ],
});`;

const prerenderAppExcerpt = `// index.js
import { browserLocation, documentHead } from "@liquefy/cascade.dom";
import { PrerenderedElementTarget } from "@liquefy/cascade.prerender/client";

const location = browserLocation({ base: import.meta.env.BASE_URL });

// The root: a prerendered page's snapshot gives way to the live app, in one frame.
const target = PrerenderedElementTarget.forElement(document.getElementById("application"));
shop.renderOnto(target, context);

// The head, built from the shop's data - and following it as the user navigates.
documentHead(() => {
  const product = catalogue.productAt(location.path);
  if (!product) return { title: "Shop" };
  return {
    title: product.name + " - Shop",
    description: product.summary,
    canonical: location.href(location.path),
    image: product.photo,
    type: "product",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      offers: { "@type": "Offer", price: product.price, priceCurrency: "EUR" },
    },
  };
});`;

export class AdvancedUsagePage extends Component {
  build() {
    return article(
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
      stage(new GaugeDemo()),
      codeBlock(gaugeSource),
      h3("Not exactly one node?"),
      p(
        "Then implement render() itself. A component that renders isn't given a node - it's given a time: its turn ",
        "in the rendering of the DOM, after what renders before it and before what renders after. What it puts there ",
        "is up to it - one node, many, or none at all. It renders onto its ", name("target"), " - the ",
        "element its parent renders into - right after ", name("target.lastChild"), ", the node rendered ",
        "just before it, and then advances lastChild to the last of its own, or leaves it where it was if it has none. ",
        "These thermometers are as many nodes as the count says, side by side in the row, with no wrapper around ",
        "them - and at zero, nothing at all: \"Before\" and \"After\" meet.",
      ),
      p(
        "Here is where temporal signals show their magic. lastChild is one property, written by every component in the ",
        "row in turn - yet each one reads it as the component just before it left it. So \"After\" lands after the ",
        "last thermometer, without knowing how many there are, or if there are any. Change the count, and lastChild ",
        "changes for what comes after: the thermometers render again, and so does \"After\" - it read lastChild - but ",
        "\"Before\" doesn't. Move the slider, and lastChild stays the same: only the thermometers render again.",
      ),
      stage(new ThermometersDemo()),
      codeBlock(thermometersSource),

      h2("Not just for rendering on a DOM"),
      p(
        "A render target is where components render - and it can be anything: a subclass of your own, with a state ",
        "of its own. Here, a paper that words lay themselves out on, in lines - the words laid out so far kept in an ",
        "array, that each word reads the last of, and pushes itself onto. A temporal array: each word sees it as the ",
        "words before it left it. Change a word, and only it and the words after it lay out again - and only as far as ",
        "something really moved: a word reads nothing but the last one, so once a word lands where it was, the rest ",
        "stay put. Not a DOM element anywhere - it runs just as well in Node.",
      ),
      p(
        "The same way, a render target could wrap another native UI framework, and have Cascade components render ",
        "onto its widgets.",
      ),
      codeBlock(paperSource),
      p(
        "Taken further, this is cascade.print: a document of paragraphs and styles, laid out onto papers in ",
        "micrometers - each paragraph broken into lines, then placed page by page - shown, edited at a caret, and printed.",
      ),
      nextPage({ path: "word-processor", label: "See it in the Word Processor →" }),

      h2("Implement your own service provider"),
      p(emphasis("Endless configuration of an existing application.")),
      p(
        "Everything a component builds with - every HTML element, every themed widget, every text - it asks for, ",
        "through the service locator in its render context. So a part of an app can be given services of its own, ",
        "without changing a line of it. Here, an existing component - twice: as it is, and inside a service provider ",
        "that hands out every text in Swedish. The same idea styles, instruments or replaces anything, anywhere.",
      ),
      stage(new TranslationDemo()),
      codeBlock(translationSource),

      h2("Layout from real measurements"),
      p(
        "A component can lay itself out by the room it really has, measured: ", name("elementBoundsProvider()"),
        " measures its own element, and hands the size to its child. Drag the frame's corner - no media queries, and ",
        "not the window's size: the component's own.",
      ),
      stage(new Measured()),
      codeBlock(measuredSource),

      h2("Prerendering"),
      p(emphasis("Pages that can be read without running them.")),
      p(
        "A single page app is an empty page until its JavaScript has run - and a search engine, a link preview or an ",
        "AI fetching a product's address often doesn't run it. ", name("cascade.prerender"), " opens every page of ",
        "the built app in a real browser, at build time, and writes down what it shows as plain HTML: one file per ",
        "address, with the page's title, description and structured data in its head, and a sitemap. When the app's ",
        "code has loaded, it takes over in a single frame. This demo is prerendered too - open any page's source.",
      ),
      p(
        "A real browser, because Cascade lays out from real measurements: without a layout engine, there would be ",
        "nothing true to write down.",
      ),
      codeBlock(prerenderConfigExcerpt),
      p(
        "In the app, the root is rendered onto a ", name("PrerenderedElementTarget"), ", and ",
        name("documentHead()"), " builds the head from the app's data - prices and availability shown right in ",
        "search results:",
      ),
      codeBlock(prerenderAppExcerpt),
      p(
        emphasis("A word of warning: prerendering and programmatic responsive layout."),
        " A page is prerendered at one size - a desktop's. Layout decided from measurements, as above, is decided ",
        "in JavaScript: until the app has loaded, a phone shows the desktop layout, squeezed - and then the app ",
        "lays it out again, with a visible jolt. Try this demo's menu on a phone. What must be right from the very ",
        "first paint is best left to CSS: media queries, flex wrapping, relative sizes - the browser lays them out ",
        "before any JavaScript has run. Keep measuring for what can wait a moment.",
      ),

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
      stage(new KeepAlive()),
      h3("1. Build them in every build - and show them with .showIf()"),
      p(
        "Create your children in build(), with a key - but don't hide them behind an ", name("if"), ". Build them ",
        "every time, and leave them out with ", name(".showIf(condition)"), " instead: a child built but not ",
        "shown is only hidden, while its key keeps it alive.",
      ),
      h3("2. Take full control"),
      p(
        "Create them yourself, once, in ", name("initialUnobservables()"), " - and since no build ",
        "does it for you, call ", name("establish()"), " on them there, and ", name("dispose()"), " in ",
        "your own ", name("onDispose()"), ". Skip the dispose, and a child reading data that never changes ",
        "again is never invalidated - it holds on to all it built and subscribed to, for good. Unobservables, because ",
        "nothing needs to observe the references - an observable property for them would only be overhead. Then ",
        "build() just places them, where and when it likes.",
      ),
      codeBlock(keepAliveSource),
      h3("3. Outside of Cascade altogether"),
      p(
        "Create them where no build ever sees them being created - in a module, or anywhere else outside of any ",
        "component - and hand them in as properties. That's how this very demo keeps its pages. Establish them ",
        "where you create them; nothing disposes them, so it's for what lives as long as the app does.",
      ),
      codeBlock(pagesExcerpt),
      p(
        emphasis("A word of warning: never combine these methods."),
        " A child constructed inside build() belongs to that build, even if you keep a reference to it as well: the ",
        "first build that doesn't construct it disposes it - out from under your reference.",
      ),
    );
  }
}
