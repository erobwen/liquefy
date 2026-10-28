import { frozen } from "@liquefy/cascade.component";
import { DOMNodeComponent, DOMElementTarget, applyStyle } from "@liquefy/cascade.dom";

/**
 * indicatedScroll({ child, style }) - `child`, scrolling, with a thin
 * indicator in place of a scroll bar: a scroll bar is for dragging, and no
 * one drags one any more - a wheel or two fingers scroll. The indicator
 * only shows how much of it is in view, and where: as long as the view,
 * in proportion, and where the view is. It grows out sideways when there's
 * something to scroll, and shrinks away when there no longer is - rather
 * than a bar jerking in and narrowing everything.
 *
 * Its own element is a box of `style`, which must give it its size (a
 * height, a flex share); what scrolls fills it, and `child` is rendered
 * into that. The indicator is drawn in the box's own color, faintly.
 *
 * A node of its own (see cascade.dom's DOMNodeComponent): following the
 * scroll and the sizes takes listeners and a ResizeObserver, which element
 * properties can't set up.
 */
export function indicatedScroll(properties) {
  return new IndicatedScroll(properties);
}

class IndicatedScroll extends DOMNodeComponent {
  setProperties({ child, style }) {
    this.child = child;
    this.style = frozen(style || null);
  }

  initialUnobservables() {
    return { ...super.initialUnobservables(), previouslySetStyle: {} };
  }

  // Rendered, never placed by someone else (renderNode(), not
  // ensureNode()): it renders its child itself.
  renderNode(target, existingElement) {
    const u = this.unobservable;
    const element = existingElement || target.appendElement("div");
    if (existingElement) target.reattachElement(existingElement);
    if (!u.scroller) {
      u.scroller = document.createElement("div");
      Object.assign(u.scroller.style, { position: "absolute", inset: "0", overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none" });
      u.thumb = document.createElement("div");
      Object.assign(u.thumb.style, {
        position: "absolute", top: "0", right: "3px", width: "4px", borderRadius: "2px",
        background: "currentColor", opacity: "0.35", pointerEvents: "none",
        transformOrigin: "right center", scale: "0 1", transition: "scale 0.25s ease-out",
      });
      element.append(u.scroller, u.thumb);
      // Where the view is, and how much of it there is, drawn: read on
      // every scroll, and whenever the view or what's in it changes size.
      u.update = () => this.drawThumb();
      u.scroller.addEventListener("scroll", u.update, { passive: true });
      if (typeof ResizeObserver === "function") {
        u.observer = new ResizeObserver(u.update);
        u.observer.observe(u.scroller);
      }
    }
    u.previouslySetStyle = applyStyle(element, { position: "relative", overflow: "hidden", ...(this.style || {}) }, u.previouslySetStyle);
    return element;
  }

  render(target, context) {
    super.render(target, context);
    const u = this.unobservable;
    if (!u.childTarget) u.childTarget = DOMElementTarget.forElement(u.scroller);
    this.child.renderOnto(u.childTarget, context);
    // What's in it, followed too - its own size is what there is to scroll.
    const content = u.scroller.firstElementChild;
    if (u.observer && content !== u.observed) {
      if (u.observed) u.observer.unobserve(u.observed);
      if (content) u.observer.observe(content);
      u.observed = content;
    }
    this.drawThumb();
  }

  drawThumb() {
    const { scroller, thumb } = this.unobservable;
    const view = scroller.clientHeight;
    const all = scroller.scrollHeight;
    const scrolls = all > view + 1;
    // Out of sight, shrunk away, when there's nothing to scroll - still as
    // long as it was, so it shrinks rather than collapsing.
    thumb.style.scale = scrolls ? "1 1" : "0 1";
    if (!scrolls) return;
    const inset = 3;
    const track = view - 2 * inset;
    const length = Math.max(24, track * view / all);
    const at = inset + (track - length) * scroller.scrollTop / (all - view);
    thumb.style.height = length + "px";
    thumb.style.translate = "0 " + at + "px";
  }

  onDispose() {
    const u = this.unobservable;
    if (u.observer) u.observer.disconnect();
    if (u.scroller) u.scroller.removeEventListener("scroll", u.update);
    super.onDispose();
  }
}
