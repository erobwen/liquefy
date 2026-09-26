import { Component } from "@liquefy/cascade.component";
import { div, h1, h2, h3, p, code, text } from "@liquefy/cascade.dom";
import { themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { HighlightedCode } from "../components/code.js";
import { article, emphasis } from "../components/layout.js";
import { GaugeDemo } from "./advanced/Gauge.js";
import { DoubleGaugeDemo } from "./advanced/DoubleGauge.js";
import { TranslationDemo } from "./advanced/Translation.js";
import { ShuffleList } from "./advanced/ShuffleList.js";
import { Measured } from "./advanced/Measured.js";
import { NoticeBoard } from "./advanced/NoticeBoard.js";
import { ConfirmDelete } from "./advanced/ConfirmDelete.js";
import gaugeSource from "./advanced/Gauge.js?raw";
import doubleGaugeSource from "./advanced/DoubleGauge.js?raw";
import paperSource from "./advanced/Paper.js?raw";
import translationSource from "./advanced/Translation.js?raw";
import shuffleSource from "./advanced/ShuffleList.js?raw";
import measuredSource from "./advanced/Measured.js?raw";
import noticeBoardSource from "./advanced/NoticeBoard.js?raw";
import confirmSource from "./advanced/ConfirmDelete.js?raw";
import source from "./AdvancedUsagePage.js?raw";

/**
 * Advanced Usage - the continuation of Getting Started, straight to some of
 * the hardest things, so they're known to be possible. Every example is a
 * file of its own in ./advanced/, shown as it is - and, but for the render
 * target on paper (a script, run with Node: no DOM involved at all),
 * running right on the page, with this app's own services.
 */

const codeStyle = { margin: "8px 0 16px 0", border: "1px solid " + themeColor.border, borderRadius: "8px", overflow: "auto", lineHeight: "1.4" };
const codeBlock = (key, sourceText) => new HighlightedCode({ key, source: sourceText, style: codeStyle });

// An example, running: on a stage of its own.
const stage = (key, child) => div(
  { key, style: { margin: "8px 0 12px 0", padding: "20px", borderRadius: "8px", background: themeColor.page, overflow: "visible" } },
  child,
);

// A name from the code, in running text.
const name = (key, value) => code({ key, style: { fontSize: "0.95em" } }, text({ key: key + "Text", text: value }));

export class AdvancedUsagePage extends Component {
  build() {
    return article(
      { key: "advancedUsage" },
      pageActions({ source, fileName: "src/pages/AdvancedUsagePage.js" }),
      h1("Advanced Usage"),
      p(
        "Picking up where Getting Started left off - and going straight to some of the hardest things, so you know ",
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
        "Then implement render() itself. A component renders onto ", name("target", "context.target"), " - the element ",
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

      h2("Animation, as a separate concern"),
      p(
        "Wrap anything in ", name("flip", "flipAnimationContainer()"), ", and every change in it animates: elements ",
        "moving, appearing, leaving and resizing. What's inside is entirely unaware of it - this list is just a list, ",
        "and the one line around it is all the animation there is.",
      ),
      stage("shuffleStage", new ShuffleList({ key: "shuffleList" })),
      codeBlock("shuffleCode", shuffleSource),

      h2("Layout from real measurements"),
      p(
        "A component can lay itself out by the room it really has, measured: ", name("bounds", "elementBoundsProvider()"),
        " measures its own element, and hands the size to its child. Drag the frame's corner - no media queries, and ",
        "not the window's size: the component's own.",
      ),
      stage("measuredStage", new Measured({ key: "measured" })),
      codeBlock("measuredCode", measuredSource),

      h2("Portals"),
      p(
        "A component can show content somewhere else entirely: ", name("portal", "portal()"), " is a place for it, ",
        name("portalContents", "portalContents()"), " puts content there, from anywhere - found by name, nothing ",
        "handed down. This demo's pages put their buttons in the top bar the same way.",
      ),
      stage("noticeStage", new NoticeBoard({ key: "noticeBoard" })),
      codeBlock("noticeCode", noticeBoardSource),

      h2("Modals"),
      p(
        name("overlay", "overlay()"), " shows its content over the whole app - on the overlay frame at the app's root ",
        "(", name("overlayFrame", "overlayFrame()"), ") - while it's built right where it belongs, next to the button ",
        "that opens it.",
      ),
      stage("confirmStage", new ConfirmDelete({ key: "confirmDelete" })),
      codeBlock("confirmCode", confirmSource),
    );
  }
}
