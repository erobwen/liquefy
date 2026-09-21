import { div, h1, h2, p, ul, li, a, b, text, DOMTargetBridge } from "@liquefy/cascade.dom";

// Matches flow's own blue() helper (introductionPage.js): a highlighted
// inline span of text, built from whatever's passed straight through to b().
function blue(...children) {
  return b({ style: { color: "blue" } }, ...children);
}

/**
 * Introduction Page - migrated from
 * flow.application/demo/src/pages/introductionPage.js's own opening
 * content to prove out the new build()/tag-function infrastructure (see
 * cascade.DOM/src/DOMElementNode.js, HTMLTags.js) - same content and
 * structure, minus the alert/codeDisplay/portal machinery (nothing here
 * needs those yet, and they don't exist for cascade).
 *
 * Extends cascade.DOM's DOMTargetBridge for the DOMTargetElement/DOMTarget
 * bridge every page under this directory needs - so this implements only
 * build(), the ordinary shape for a component with nothing else to
 * interleave real, synchronous work with.
 */
export class IntroductionPage extends DOMTargetBridge {
  build() {
    return div(
      h1("Introduction to Cascade"),
      p("Reactive front end framework, with an integrated state management system."),
      p(blue("The purpose of Cascade is to make it simple and fast to build advanced user interfaces that are data driven, generative and reactive.")),
      p("Unlike most reactive UI frameworks, Cascade renders directly onto a live target in one pass - reading and writing the real DOM in tree order - rather than building an abstract tree first and reconciling it separately."),
      h2("Technical features"),
      ul(
        li(blue("JS Proxies"), " for fully transparent data dependency tracking."),
        li(blue("Minimal DOM updates"), " for fine-grained, targeted change response."),
        li(blue("Component lifecycle control"), " - a component that stops being rendered is retracted, not destroyed, and can be reattached later with its state intact."),
        li(blue("Programmatic responsive layout"), " driven by real DOM measurement (see the toolbar/menu breakpoint, and the Programmatic Reactive Layout page) rather than CSS media queries."),
      ),
      h2("Repository"),
      a(text("https://github.com/erobwen/liquefy"), { href: "https://github.com/erobwen/liquefy" }),
      p("This demo is a work in progress, replicating flow's own demo app one piece at a time."),
      // lineHeight given as a string, not a number - defaultToPx (see
      // DOMElementNode.js, faithfully ported from flow's own version)
      // converts every numeric style value to px, and line-height is one
      // of the CSS properties that's meant to stay unitless.
      { style: { maxWidth: 720, lineHeight: "1.5" } },
    );
  }
}
