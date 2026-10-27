import { Component, frozen } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";

/**
 * ScrollColumn - a column that scrolls up and down, its scroll bar its own:
 * a gutter beside it, only as wide as a thin bar while there's something to
 * scroll - easing open as what's in it grows past its height, and closed
 * again as it shrinks back, nothing in the column changing width meanwhile:
 * it moves aside instead. The bar shows where you are, for the wheel and
 * the touch pad's two fingers to scroll by - nothing to grab.
 *
 *   scrollColumn({ style, scrollStyle, onScrolls }, ...children)
 *
 * `style`: the column as a whole, the gutter included - a flex row. A flex
 * item itself, typically: `flex: "0 1 auto", minHeight: 0` in a column, to
 * be as tall as what's in it, and no taller than there's room for.
 * `scrollStyle`: what scrolls - its padding, its width. `onScrolls(scrolls)`
 * is told whenever there starts or stops being something to scroll - for
 * what lines up with what's in the column, to ease along with it (see
 * gutterWidth).
 *
 * The browser's own bar is hidden; the column scrolls as ever. Where the
 * bar is, and how long, follows the scrolling and what's in the column -
 * written to its element directly, not built: scrolling rebuilds nothing.
 */
export const gutterWidth = 8;
export const gutterEasing = "220ms ease";

let lastId = 0;

export class ScrollColumn extends Component {
  setProperties({ style, scrollStyle, onScrolls, children }) {
    this.style = frozen(style || {});
    this.scrollStyle = frozen(scrollStyle || {});
    this.onScrolls = onScrolls || null;
    this.columnChildren = frozen(children || []);
  }

  initialState() {
    return { scrolls: false };
  }

  initialUnobservables() {
    return { id: "scroll" + (++lastId), stop: null };
  }

  // The bar: found once the elements are there, then following the column's
  // scrolling and every change of its size, or of what's in it.
  onEstablish() {
    super.onEstablish();
    if (typeof(document) === "undefined" || typeof(ResizeObserver) === "undefined") return;
    const u = this.unobservable;
    let scroller = null;
    let bar = null;
    let observer = null;
    let frame = null;
    // How tall what's in it is, laid out - not `scrollHeight`, which counts
    // what's only drawn there for now: something on its way to a smaller
    // size, drawn at its old one, or fading out where it was (see
    // cascade.dom's FlipAnimationContainer). Collapsing a card, the bar goes
    // as the card's place shrinks - not once its animation has ended, when
    // nothing changes size to tell.
    const laidOut = () => {
      const style = getComputedStyle(scroller);
      let height = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      for (const child of scroller.children) {
        if (getComputedStyle(child).position !== "absolute") height += child.offsetHeight;
      }
      return height;
    };
    const update = () => {
      const { scrollTop, clientHeight } = scroller;
      const scrollHeight = laidOut();
      const scrolls = scrollHeight > clientHeight + 1;
      if (scrolls !== this.scrolls) {
        this.scrolls = scrolls;
        if (this.onScrolls) this.onScrolls(scrolls);
      }
      if (!scrolls) return;
      const length = Math.max(24, clientHeight * clientHeight / scrollHeight);
      bar.style.height = length + "px";
      bar.style.top = (clientHeight - length) * Math.min(1, scrollTop / (scrollHeight - clientHeight)) + "px";
    };
    const find = () => {
      scroller = document.querySelector(`[data-scroll-column="${u.id}"]`);
      bar = document.querySelector(`[data-scroll-bar="${u.id}"]`);
      if (!scroller || !bar) {
        frame = requestAnimationFrame(find);
        return;
      }
      frame = null;
      scroller.addEventListener("scroll", update, { passive: true });
      observer = new ResizeObserver(update);
      observer.observe(scroller);
      for (const child of scroller.children) observer.observe(child);
      update();
    };
    find();
    u.stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      if (scroller) scroller.removeEventListener("scroll", update);
    };
  }

  onDispose() {
    if (this.unobservable.stop) this.unobservable.stop();
    super.onDispose();
  }

  build() {
    const { id } = this.unobservable;
    const scrolls = this.scrolls;
    return div(
      { style: { display: "flex", minHeight: 0, ...this.style } },
      div(
        { key: "scroller", "data-scroll-column": id, style: { overflowY: "auto", scrollbarWidth: "none", minHeight: 0, boxSizing: "border-box", ...this.scrollStyle } },
        this.columnChildren,
      ),
      div(
        { key: "gutter", style: { flex: "none", position: "relative", overflow: "hidden", width: (scrolls ? gutterWidth : 0) + "px", transition: "width " + gutterEasing } },
        div({
          key: "bar",
          "data-scroll-bar": id,
          style: {
            // Hidden with its gutter, closed.
            position: "absolute", left: "2px", width: "4px", borderRadius: "2px", background: "rgba(60, 64, 67, 0.32)",
          },
        }),
      ),
    );
  }
}

export const scrollColumn = (...parameters) => new ScrollColumn(...parameters);
