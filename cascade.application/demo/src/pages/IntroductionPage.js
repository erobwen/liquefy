import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget, div, h1, h2, p, ul, li, a, b, text } from "@liquefy/cascade.dom";

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
 * Bridges between the two DOM target abstractions at exactly this one
 * boundary: WorkArea (see cascade.application/demo/index.js) hands this
 * component a DOMTargetElement-based context, matching the rest of the
 * demo's own frame code - but DOMElementNode (what build()'s tag
 * functions actually construct) needs a DOMTarget-based one instead
 * (appendElement/reattachElement, not createChild/insertChild -
 * deliberately incompatible names, see DOMTarget.js/DOMTargetElement.js's
 * own comments on why they're separate abstractions at all). So render()
 * is overridden here (skipping the default build()-delegating one, which
 * assumes its own context is already the right kind) to create this
 * component's own wrapper element the same way every other frame-level
 * component in this demo does, then switch to a fresh DOMTarget for its
 * own build()-composed content underneath - the same "each level owns
 * its own context for what's below it" shape MainFrame/MenuFrame/WorkArea
 * already use, just bridging target *kinds* here instead of just handing
 * down new field values.
 */
export class IntroductionPage extends Component {
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

  render(context) {
    const u = this.unobservable;
    if (!u.el) u.el = context.target.createChild("div");
    if (!u.innerContext) {
      u.innerContext = new RenderContext(DOMTarget.forElement(u.el.element));
    }
    this.reactiveBuildEquivalent().renderOnto(u.innerContext);
  }

  onRetract() {
    this.unobservable.el.element.remove();
  }

  onReattach(context) {
    context.target.element.appendChild(this.unobservable.el.element);
  }
}
