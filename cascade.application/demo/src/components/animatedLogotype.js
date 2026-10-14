import { DOMNodeComponent } from "@liquefy/cascade.dom";
import logotypeSource from "../../../../cascade/images/menu-bar-logo.svg?raw";

// The logotype's letters - its paths, in the SVG's own ids - left to right,
// each with where it flies in from: an offset in the drawing's own units
// (the whole logotype is 342 wide), a turn, a size, and when it sets off.
// The circle and the arrow in it make up the second C: the circle grows
// out of nothing, and the arrow strikes last.
const letters = [
  { id: "path4", from: { x: -140, y: -30, turn: -120 }, delay: 0 }, // C
  { id: "path2-24", from: { x: -40, y: -110, turn: 40 }, delay: 70 }, // A
  { id: "path5", from: { x: 0, y: 110, turn: -40 }, delay: 140 }, // S
  { id: "path2-4", from: { scale: 0, turn: -180 }, delay: 230 }, // the circle
  { id: "path3", from: { x: 0, y: -110, turn: -40 }, delay: 300 }, // A
  { id: "path6", from: { x: 40, y: 110, turn: 40 }, delay: 370 }, // D
  { id: "path7", from: { x: 140, y: -30, turn: 120 }, delay: 440 }, // E
  { id: "path8", from: { x: -260, scale: 2.5 }, delay: 760 }, // the arrow
];

// A touch past where it's going, and back: they land, rather than stop.
const landing = "cubic-bezier(0.34, 1.45, 0.64, 1)";

/**
 * The Cascade logotype, its letters flying in one by one - from all
 * directions, turning as they come, the arrow last - once `shown`. Not
 * shown, they're scattered, and invisible; shown again after that, they
 * fly in again - scattered at once, and in again from there. Sized by its
 * `style` (a width - its height follows).
 *
 * A node of its own, like HighlightedCode (see code.js): the SVG is the
 * logotype file itself, as it is, parsed once - with every letter a path
 * in it, moved with CSS transitions of its own `translate`, `rotate` and
 * `scale`, each around its own center (transform-box: fill-box).
 */
export class AnimatedLogotype extends DOMNodeComponent {
  setProperties({ shown, style, title }) {
    this.shown = !!shown;
    this.style = style || null;
    this.title = title || "Cascade";
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.node) {
      const parsed = new DOMParser().parseFromString(logotypeSource, "image/svg+xml").documentElement;
      const svg = document.importNode(parsed, true);
      // Inkscape's own notes, and its size in millimeters: it's as wide as
      // its style says.
      for (const note of [...svg.children]) {
        if (note.localName === "namedview") note.remove();
      }
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", this.title);
      Object.assign(svg.style, { display: "block", height: "auto", overflow: "visible" });
      u.letters = letters.map((letter) => ({ ...letter, element: svg.querySelector("#" + CSS.escape(letter.id)) }))
        .filter(({ element }) => element);
      for (const letter of u.letters) {
        Object.assign(letter.element.style, { transformBox: "fill-box", transformOrigin: "center" });
        letter.transition = [
          `translate 1100ms ${landing} ${letter.delay}ms`,
          `rotate 1100ms ${landing} ${letter.delay}ms`,
          `scale 1100ms ${landing} ${letter.delay}ms`,
          `opacity 500ms ease ${letter.delay}ms`,
        ].join(", ");
      }
      u.node = svg;
    }
    if (u.shownAs !== this.shown) {
      u.shownAs = this.shown;
      // Flying in, with the transition it changes to; scattered, at once.
      for (const { element, from, transition } of u.letters) {
        Object.assign(element.style, this.shown
          ? { translate: "none", rotate: "none", scale: "none", opacity: "1", transition }
          : {
            translate: `${from.x || 0}px ${from.y || 0}px`,
            rotate: (from.turn || 0) + "deg",
            scale: typeof(from.scale) === "number" ? String(from.scale) : "none",
            opacity: "0",
            transition: "none",
          });
      }
    }
    Object.assign(u.node.style, this.style || {});
    return u.node;
  }
}
