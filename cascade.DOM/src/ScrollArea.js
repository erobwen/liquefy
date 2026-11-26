import { Component, frozen } from "@liquefy/cascade.component";
import { div } from "./HTMLTags.js";

/**
 * ScrollArea - something that scrolls up and down, with nothing about it
 * that jerks: no scroll bar taking room as it comes and goes, no edge
 * cutting what's in it off.
 *
 *   scrollArea({ style, scrollStyle, fade, indicator, onScrolls }, ...children)
 *
 *  - An indicator in place of a scroll bar: thin, over what scrolls, at
 *    its right edge - as long as the view is of all there is, and where the
 *    view is. It takes no room - nothing in the area moves aside for it -
 *    and grows out sideways when there's something to scroll, shrinking
 *    away when there no longer is. For showing where you are: the wheel
 *    and two fingers scroll, nothing's there to grab. `indicator: false`:
 *    none.
 *  - Faded edges (`fade`, px - none by default): what scrolls fades out
 *    over that much at its top and bottom - only where something is out of
 *    sight beyond that edge, and only as much as there is: scrolled to the
 *    top, nothing fades there; what's in it shorter than the area, nothing
 *    fades at all. An edge comes and goes gradually, as you scroll to and
 *    from it - and as what's in it grows past it, or shrinks back.
 *
 * `style`: the area as a whole - a flex item, typically: `flex: "0 1
 * auto"` in a column, to be as tall as what's in it and no taller than
 * there's room for. `scrollStyle`: what scrolls - its padding, its width.
 * `onScrolls(scrolls)` is told whenever there starts or stops being
 * something to scroll.
 *
 * An ordinary component, building ordinary elements: in a
 * FlipAnimationContainer, what's in it is placed and animated as anywhere
 * else. How tall what's in it is, is what's laid out - down to where the
 * last of it ends, the gaps and margins between included - not
 * `scrollHeight`, which also counts what's only drawn there for now:
 * something on its way to a smaller size, or fading out where it was.
 * Collapsing a card, the indicator and the fade follow its place shrinking
 * - not its animation ending, when nothing changes size to tell.
 *
 * The indicator and the edges follow the scrolling and the sizes - written
 * to their elements directly, not built: scrolling rebuilds nothing.
 */
let lastId = 0;
let registered = false;

// The edges' lengths, as custom properties with a type - so a change of
// one (what's in the area growing past an edge) can be eased, where the
// browser has it; elsewhere it's taken at once.
function registerFadeProperties() {
  if (registered) return;
  registered = true;
  if (typeof(CSS) === "undefined" || !CSS.registerProperty) return;
  for (const name of ["--cascade-scroll-fade-top", "--cascade-scroll-fade-bottom"]) {
    try {
      CSS.registerProperty({ name, syntax: "<length>", inherits: false, initialValue: "0px" });
    } catch (error) {
      // Registered already - another copy of this module.
    }
  }
}

const fadeMask = "linear-gradient(to bottom, transparent 0, black var(--cascade-scroll-fade-top, 0px), black calc(100% - var(--cascade-scroll-fade-bottom, 0px)), transparent 100%)";
const fadeEasing = "--cascade-scroll-fade-top 180ms ease, --cascade-scroll-fade-bottom 180ms ease";

export class ScrollArea extends Component {
  setProperties({ style, scrollStyle, fade = 0, indicator = true, onScrolls, children }) {
    this.style = frozen(style || {});
    this.scrollStyle = frozen(scrollStyle || {});
    this.fade = fade || 0;
    this.indicator = indicator !== false;
    this.onScrolls = onScrolls || null;
    this.areaChildren = frozen(children || []);
  }

  initialUntracked() {
    return { id: "scrollArea" + (++lastId), stop: null, scrolls: false };
  }

  // Found once the elements are there, then following the scrolling and
  // every change of its size, or of what's in it: each child's size, and
  // which children there are - one added or removed changes no other's
  // size, in an area that's as tall as it gets.
  onEstablish() {
    super.onEstablish();
    if (typeof(document) === "undefined" || typeof(ResizeObserver) === "undefined") return;
    registerFadeProperties();
    const u = this.untracked;
    let scroller = null;
    let observer = null;
    let children = null;
    let frame = null;
    let observed = new Set();
    // Where the last of what's laid out in it ends - its margin, and the
    // area's own padding after it, included - from the top of what scrolls.
    // By where each child lies, not how tall they are together: whatever
    // lays them out - gaps between them, margins, side by side. Not what's
    // out of the layout (absolutely positioned: something fading out).
    const laidOut = () => {
      const style = getComputedStyle(scroller);
      const number = (value) => parseFloat(value) || 0;
      // A child's offsetTop is from the scroller's padding edge if that
      // positions it - otherwise from the same element the scroller's own
      // is from. Either way as laid out: however far it's scrolled.
      const within = (child) => child.offsetParent === scroller
        ? child.offsetTop
        : child.offsetTop - scroller.offsetTop - scroller.clientTop;
      let end = number(style.paddingTop);
      for (const child of scroller.children) {
        const childStyle = getComputedStyle(child);
        if (childStyle.position === "absolute" || childStyle.position === "fixed" || childStyle.display === "none") continue;
        end = Math.max(end, within(child) + child.offsetHeight + Math.max(0, number(childStyle.marginBottom)));
      }
      return end + number(style.paddingBottom);
    };
    const update = () => {
      // Its elements may have been made anew since.
      if (!scroller || !scroller.isConnected) return find();
      const now = new Set(scroller.children);
      for (const child of observed) {
        if (!now.has(child)) {
          observed.delete(child);
          observer.unobserve(child);
        }
      }
      for (const child of now) {
        if (!observed.has(child)) {
          observed.add(child);
          observer.observe(child);
        }
      }
      const { scrollTop, clientHeight } = scroller;
      const all = laidOut();
      const scrolls = all > clientHeight + 1;
      if (scrolls !== u.scrolls) {
        u.scrolls = scrolls;
        if (this.onScrolls) this.onScrolls(scrolls);
      }
      const below = Math.max(0, all - clientHeight - scrollTop);
      // As much of an edge as there is out of sight beyond it.
      const fade = this.fade;
      scroller.style.setProperty("--cascade-scroll-fade-top", (scrolls ? Math.min(fade, scrollTop) : 0) + "px");
      scroller.style.setProperty("--cascade-scroll-fade-bottom", (scrolls ? Math.min(fade, below) : 0) + "px");
      const thumb = document.querySelector(`[data-scroll-indicator="${u.id}"]`);
      if (!thumb) return;
      // Shrunk away with nothing to scroll - still as long as it was, so
      // it shrinks rather than collapses.
      thumb.style.scale = scrolls ? "1 1" : "0 1";
      if (!scrolls) return;
      const inset = 3;
      const track = clientHeight - 2 * inset;
      const length = Math.max(24, track * clientHeight / all);
      const at = inset + (track - length) * Math.min(1, scrollTop / (all - clientHeight));
      thumb.style.height = length + "px";
      thumb.style.translate = "0 " + at + "px";
    };
    const find = () => {
      if (scroller) scroller.removeEventListener("scroll", update);
      if (observer) observer.disconnect();
      if (children) children.disconnect();
      observed = new Set();
      scroller = document.querySelector(`[data-scroll-area="${u.id}"]`);
      if (!scroller) {
        if (frame === null) frame = requestAnimationFrame(() => { frame = null; find(); });
        return;
      }
      scroller.addEventListener("scroll", update, { passive: true });
      observer = new ResizeObserver(update);
      observer.observe(scroller);
      if (typeof(MutationObserver) !== "undefined") {
        children = new MutationObserver(update);
        children.observe(scroller, { childList: true });
      }
      update();
    };
    find();
    u.stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      if (children) children.disconnect();
      if (scroller) scroller.removeEventListener("scroll", update);
    };
  }

  onDispose() {
    if (this.untracked.stop) this.untracked.stop();
    super.onDispose();
  }

  build() {
    const { id } = this.untracked;
    const faded = this.fade > 0
      ? { maskImage: fadeMask, WebkitMaskImage: fadeMask, transition: fadeEasing }
      : {};
    return div(
      { style: { display: "flex", position: "relative", minHeight: 0, ...this.style } },
      div(
        {
          key: "scroller",
          "data-scroll-area": id,
          style: { overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none", minHeight: 0, boxSizing: "border-box", ...faded, ...this.scrollStyle },
        },
        this.areaChildren,
      ),
      this.indicator
        ? div({
          key: "indicator",
          "data-scroll-indicator": id,
          style: {
            position: "absolute", top: 0, right: "1px", width: "4px", height: "24px", borderRadius: "2px",
            background: "currentColor", opacity: 0.3, pointerEvents: "none",
            transformOrigin: "right center", scale: "0 1", transition: "scale 250ms ease-out",
          },
        })
        : null,
    );
  }
}

export const scrollArea = (...parameters) => new ScrollArea(...parameters);
