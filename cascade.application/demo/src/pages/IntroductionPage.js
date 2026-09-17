import { Component } from "@liquefy/cascade.component";

/**
 * Introduction Page - a deliberately simplified replica of
 * flow.application/demo/src/pages/introductionPage.js: same opening
 * content, without the alert/codeDisplay/portal machinery (nothing here
 * needs those, and they don't exist for cascade yet).
 *
 * Static content, so it's built once (guarded by `!u.el`) via innerHTML
 * rather than a tree of individually-managed elements - nothing inside
 * this block ever changes reactively, so there's nothing for per-element
 * ownership to buy here.
 */
export class IntroductionPage extends Component {
  render(context) {
    const u = this.unobservable;
    if (!u.el) {
      u.el = context.target.createChild("div");
      const el = u.el.element;
      el.style.cssText = "max-width: 720px; line-height: 1.5;";
      el.innerHTML =
        "<h1>Introduction to Cascade</h1>" +
        "<p>Reactive front end framework, with an integrated state management system.</p>" +
        "<p>The purpose of Cascade is to make it simple and fast to build advanced " +
        "user interfaces that are data driven, generative and reactive.</p>" +
        "<p>Unlike most reactive UI frameworks, Cascade renders directly onto a live " +
        "target in one pass - reading and writing the real DOM in tree order - rather " +
        "than building an abstract tree first and reconciling it separately.</p>" +
        "<h2>Technical features</h2>" +
        "<ul>" +
        "<li>Uses JS Proxies for fully transparent data dependency tracking.</li>" +
        "<li>Minimal DOM updates for fine-grained, targeted change response.</li>" +
        "<li>Component lifecycle control - a component that stops being rendered is " +
        "retracted, not destroyed, and can be reattached later with its state intact.</li>" +
        "<li>Programmatic responsive layout, driven by real DOM measurement " +
        "(see the toolbar/menu breakpoint, and the Programmatic Reactive Layout page) " +
        "rather than CSS media queries.</li>" +
        "</ul>" +
        "<p>This demo is a work in progress, replicating flow's own demo app one " +
        "piece at a time.</p>";
    }
  }

  onRetract() {
    this.unobservable.el.element.remove();
  }

  onReattach(context) {
    context.target.element.appendChild(this.unobservable.el.element);
  }
}
