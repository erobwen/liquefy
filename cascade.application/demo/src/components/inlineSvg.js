import { DOMNodeComponent } from "@liquefy/cascade.dom";

/**
 * An SVG drawing, inline - in the page itself, not an image: so its own
 * styles can read the page's CSS variables (a theme's colors), and its
 * animations follow the page's settings. `source` is the drawing's text
 * (an import with ?raw), parsed once; sized by its `style` - a width, its
 * height following - and named by `title`, for those who can't see it.
 *
 * Its classes and ids are the page's, once it's in it: a drawing shown
 * this way names its own with a prefix of its own.
 */
export class InlineSvg extends DOMNodeComponent {
  setProperties({ source, title, style }) {
    this.source = source;
    this.title = title || "";
    this.style = style || null;
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.node || u.source !== this.source) {
      u.source = this.source;
      const parsed = new DOMParser().parseFromString(this.source, "image/svg+xml").documentElement;
      const svg = document.importNode(parsed, true);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("role", "img");
      Object.assign(svg.style, { display: "block", width: "100%", height: "auto" });
      u.node = svg;
    }
    u.node.setAttribute("aria-label", this.title);
    Object.assign(u.node.style, this.style || {});
    return u.node;
  }
}
