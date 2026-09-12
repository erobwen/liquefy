import { RenderContext } from "@liquefy/cascade.component";
import { DOMTarget, DOMComponent } from "@liquefy/cascade.dom";

/**
 * Benchmark for the real-time renderOnto model: the main frame renders the
 * toolbar, takes a real getBoundingClientRect() measurement of the actual
 * rendered DOM, and hands the remaining space down to the content area via
 * a RenderContext - the exact scenario cascade.DOM's own (jsdom-based,
 * simulated-measurement) test proves abstractly. This is the same thing,
 * with a real browser actually doing the layout.
 */

class Toolbar extends DOMComponent {
  renderElement(context, existingElement) {
    const el = existingElement || context.target.appendElement("div");
    el.className = "toolbar";
    el.textContent = "Toolbar";
    el.style.cssText =
      "height: 48px; box-sizing: border-box; display: flex; align-items: center; " +
      "padding: 0 16px; background: #2c3e50; color: white; flex: none;";
    return el;
  }
}

class ContentArea extends DOMComponent {
  renderElement(context, existingElement) {
    const el = existingElement || context.target.appendElement("div");
    el.className = "content";
    el.style.cssText =
      "box-sizing: border-box; padding: 16px; background: #ecf0f1; overflow: auto;";
    el.style.height = context.spaceLeft + "px";
    el.textContent = "Space left for content, measured for real: " + Math.round(context.spaceLeft) + "px. Resize the window to see it update.";
    return el;
  }
}

class MainFrame extends DOMComponent {
  constructor(toolbar, contentArea) {
    super();
    this.toolbar = toolbar;
    this.contentArea = contentArea;
  }

  renderElement(context, existingElement) {
    const u = this.unobservable;
    const el = existingElement || context.target.appendElement("div");
    el.className = "main-frame";
    el.style.cssText = "display: flex; flex-direction: column; height: 100%;";

    // Both the inner target and the context wrapping it must persist
    // across reruns - a relinked child (its own inputs unchanged) never
    // re-executes render(), so it can never see a brand new context
    // object; only a property write on one it's already depending on can
    // invalidate and rerun it. See cascade.component/src/RenderContext.js.
    if (!u.innerContext) {
      u.innerContext = new RenderContext(DOMTarget.forElement(el));
    }

    this.toolbar.renderOnto(u.innerContext);

    // Real measurement - this is the whole point of rendering directly
    // onto the real DOM instead of building an abstract tree first: the
    // toolbar's actual rendered height, right now, in this browser, at
    // this window size.
    const toolbarHeight = this.toolbar.unobservable.element.getBoundingClientRect().height;
    const totalHeight = el.getBoundingClientRect().height;
    u.innerContext.spaceLeft = totalHeight - toolbarHeight;

    this.contentArea.renderOnto(u.innerContext);

    return el;
  }
}

const target = new DOMTarget(document.getElementById("application"));
const context = new RenderContext(target);
const mainFrame = new MainFrame(new Toolbar(), new ContentArea());
mainFrame.renderOnto(context);

// Proves the reactivity is real, not just a one-time snapshot: resizing
// the window re-measures, writes a (likely) different spaceLeft into the
// same persistent context object, and the content area reruns and
// re-renders on its own - an ordinary reactive invalidation, not a special
// "notify children" call.
window.addEventListener("resize", () => {
  mainFrame.unobservable.repeater.restart();
});
