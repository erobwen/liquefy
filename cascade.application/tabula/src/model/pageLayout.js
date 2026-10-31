import { observable, frozen } from "@liquefy/cascade.component";
import { paperSizes, margins as allMargins, mm } from "../print/index.js";

/**
 * A page layout - how pages are laid out: the paper, and what's drawn on
 * it, around the text that flows through it. Every part of it its own to
 * have or not - each part it leaves out as what it's in has it, inherited
 * through the render context, cascade's own (see pageLayoutProvider()):
 * what provides a part is the nearest that has it.
 *
 * Its settings - the paper:
 *
 *  - `paper`: its size, { width, height } in µm, upright.
 *  - `landscape`: turned on its side - the paper the other way round,
 *    whatever size it is.
 *  - `margins`: { top, right, bottom, left } in µm, each from its own edge
 *    of the paper - the box text flows in.
 *  - `duplex`: designed to be printed on both sides - a book, its pages
 *    facing each other, mirrored: "left" is the inner side, by the binding,
 *    "right" the outer. What it's designed for, not what a printer does (a
 *    file's print settings, see ../shell/documents.js).
 *
 * Its content - what's drawn on the pages: `first`, `middle`, `last`, what's
 * on the first page, on every page between, and on the last - each a list
 * of page elements (below): a page number at the foot, a band along the
 * top, a picture. A document of one page has a first page only; of two, a
 * first and a last (see pageKind()). All three, or none (undefined).
 *
 * The file's - its root's - is the base: all its settings, no content (see
 * rootPageLayout()) - a file of PDFs and full-page pictures needs no page
 * numbers. What's in it derives its own from it: a structured text's has
 * content - its headers, its footers, placed in relation to the margins it
 * inherits - and settings only where it overrides them; a part of a book
 * with none, its front matter, has none.
 *
 * A page element is placed parametrically, at a distance from one of the
 * paper's edges across (`horizontal`: "left" or "right", `x` from it to the
 * element's near side) and one of its edges down (`vertical`: "top" or
 * "bottom", `y`) - or, measured from the margins (`from`: "margins"), from
 * the margin there: in the margin, outside it, the distance less than
 * nothing. Whichever are nearest, as it's placed (placeElement()): a box
 * at the bottom right stays at the bottom right, whatever the paper; a
 * footer measured from the bottom margin goes where the margin goes. Its
 * size is its own.
 *
 * What's in an element is a hydrated document (see ../shell/documents.js),
 * as in a frame in the text (see frames.js): a kind with a `frame`, shown
 * filling the element - told which page it's on (`{ page, pages }`,
 * 1-based), so a page number can say it.
 *
 * Saved: { type: "pageLayout", name: "pages", properties: { paper: "A4",
 * margins: {...}, first: [...], ... } } - only the parts it has.
 */
export const pageSettingKeys = Object.freeze(["paper", "landscape", "margins", "duplex"]);

export class PageLayout {
  constructor({ paper, landscape, margins, duplex, first, middle, last } = {}) {
    // Every part a field of its own, undefined where it isn't its own: one
    // set, or taken away, later is followed like any other change.
    this.paper = paper;
    this.landscape = landscape;
    this.margins = margins;
    this.duplex = duplex;
    const content = [first, middle, last].some((each) => typeof(each) !== "undefined");
    this.first = content ? observable(first || []) : undefined;
    this.middle = content ? observable(middle || []) : undefined;
    this.last = content ? observable(last || []) : undefined;
    return observable(this);
  }

  // Whether it has settings of its own - any of them.
  hasSettings() {
    return pageSettingKeys.some((key) => typeof(this[key]) !== "undefined");
  }

  // Whether it has content of its own - an empty one, too.
  hasContent() {
    return typeof(this.first) !== "undefined";
  }

  // Content of its own - none on its pages, if it had none.
  ensureContent() {
    if (this.hasContent()) return this;
    this.first = observable([]);
    this.middle = observable([]);
    this.last = observable([]);
    return this;
  }

  // Its settings taken away: all as what it's in has them.
  clearSettings() {
    for (const key of pageSettingKeys) this[key] = undefined;
  }

  dehydrate() {
    const properties = {};
    if (typeof(this.paper) !== "undefined") properties.paper = paperToJson(this.paper);
    if (typeof(this.landscape) !== "undefined") properties.landscape = !!this.landscape;
    if (typeof(this.margins) !== "undefined") properties.margins = { ...this.margins };
    if (typeof(this.duplex) !== "undefined") properties.duplex = !!this.duplex;
    if (this.hasContent()) Object.assign(properties, { first: [...this.first], middle: [...this.middle], last: [...this.last] });
    return { type: "pageLayout", name: "pages", properties };
  }
}

export class PageElement {
  constructor({ content, horizontal = "left", x = 0, vertical = "top", y = 0, width, height, from = "paper" }) {
    this.content = content;
    this.horizontal = horizontal;
    this.x = x;
    this.vertical = vertical;
    this.y = y;
    this.width = width;
    this.height = height;
    this.from = from === "margins" ? "margins" : "paper";
    return observable(this);
  }

  dehydrate() {
    const { content, horizontal, x, vertical, y, width, height, from } = this;
    return { type: "pageElement", name: "element", properties: { horizontal, x, vertical, y, width, height, ...(from === "margins" ? { from } : {}), content } };
  }
}

// A page layout as a file has it - its paper by name, its margins all four.
export function pageLayoutFromJson({ paper, landscape, margins, duplex, first, middle, last } = {}) {
  return new PageLayout({
    paper: typeof(paper) === "undefined" ? undefined : paperFromJson(paper),
    landscape: typeof(landscape) === "undefined" ? undefined : !!landscape,
    margins: typeof(margins) === "undefined" ? undefined : Object.freeze({ top: 0, right: 0, bottom: 0, left: 0, ...margins }),
    duplex: typeof(duplex) === "undefined" ? undefined : !!duplex,
    first, middle, last,
  });
}

// What a page layout is made of, as files have it - Tabula's own (see
// ../shell/documents.js), and the plugins' whose documents have one (see
// its documentPlugin()).
export const pageLayoutFamilies = {
  pageLayout: { baseClass: PageLayout },
  pageElement: { baseClass: PageElement },
};
export const pageLayoutKinds = {
  pageLayout: {
    pages: (properties) => pageLayoutFromJson(properties),
  },
  pageElement: {
    element: (properties) => new PageElement(properties),
  },
};

// A paper, as a file has it - a size's name ("A4"), or { width, height }
// - and back.
export function paperFromJson(json) {
  const paper = typeof(json) === "string" ? paperSizes[json] : json;
  if (!paper) throw new Error("Unknown paper: " + JSON.stringify(json));
  return Object.freeze({ width: paper.width, height: paper.height });
}
export function paperToJson(paper) {
  const name = Object.keys(paperSizes).find((each) => paperSizes[each].width === paper.width && paperSizes[each].height === paper.height);
  return name || { width: paper.width, height: paper.height };
}

// --- Inherited ----------------------------------------------------------------

// What nothing says otherwise: A4, upright, 25 mm all round, one side.
export const defaultPageSettings = Object.freeze({
  paper: Object.freeze({ width: paperSizes.A4.width, height: paperSizes.A4.height }),
  landscape: false,
  margins: allMargins(mm(25)),
  duplex: false,
});

// The file's: all its settings - as nothing says otherwise, but for those
// given - no content.
export const rootPageLayout = (settings = {}) => new PageLayout({ ...defaultPageSettings, ...settings });

// What something with a page layout of its own - `own()`, or null -
// provides to what's in it (see cascade.component's Component.provide()): a
// getter for each setting, and `pageContent` - the page layout whose
// content it is - undefined where it has none: the render context going on
// up for it, to what has it.
export function pageLayoutProvider(own) {
  const provided = {};
  for (const key of pageSettingKeys) {
    Object.defineProperty(provided, key, {
      enumerable: true,
      get() {
        const layout = own();
        return layout ? layout[key] : undefined;
      },
    });
  }
  Object.defineProperty(provided, "pageContent", {
    enumerable: true,
    get() {
      const layout = own();
      return layout && layout.hasContent() ? layout : undefined;
    },
  });
  return provided;
}

// The page layout something is laid out with: its own parts, where it has
// them; what it's in has (`inherit(key)` - a component's inherit()), where
// not; the defaults, where nothing has them. `content`: the page layout
// whose content is drawn - its own, or inherited - or null.
export function resolvePageLayout(own, inherit) {
  const resolved = {};
  for (const key of pageSettingKeys) {
    const mine = own ? own[key] : undefined;
    const value = typeof(mine) !== "undefined" ? mine : inherit(key);
    resolved[key] = typeof(value) !== "undefined" ? value : defaultPageSettings[key];
  }
  resolved.content = own && own.hasContent() ? own : inherit("pageContent") || null;
  return resolved;
}

// The paper of a page layout like that - { width, height, margins,
// pageLayout } (the one whose content is drawn on it) and, printed on both
// sides, `duplex` and its first page's `side` (see ../print/Section.js's
// formatOfPage()): on its side, the other way round.
export function paperFormat({ paper, landscape, margins, duplex, content = null }) {
  const across = landscape ? Math.max(paper.width, paper.height) : Math.min(paper.width, paper.height);
  const down = landscape ? Math.min(paper.width, paper.height) : Math.max(paper.width, paper.height);
  return frozen({ width: across, height: down, margins, pageLayout: content, ...(duplex ? { duplex: true, side: "recto" } : {}) });
}

// The paper `component` is laid out on - a layout's, an editor's: its own
// page layout's parts (`own`), and what it's in has for the rest.
export function formatIn(component, own = null) {
  return paperFormat(resolvePageLayout(own, (key) => component.inherit(key)));
}

// --- Pages, and what's on them ------------------------------------------------

export const pageKinds = Object.freeze([
  { name: "first", label: "First page" },
  { name: "middle", label: "Middle pages" },
  { name: "last", label: "Last page" },
]);

// Which of a page layout's pages page `index` of `count` is (0-based): the
// first; the last, after it; every one between, a middle page.
export function pageKind(index, count) {
  if (index === 0) return "first";
  return index === count - 1 ? "last" : "middle";
}

// A rectangle on a paper of `{ width }`, mirrored across it - as on the
// other side of the sheet.
export const mirrored = (rect, paper) => ({ ...rect, x: paper.width - rect.x - rect.width });

// What an element on `paper` is measured from, as on a right-hand page:
// its edges - or its margins, an element measured from them - { left,
// right, top, bottom }, each a distance from the paper's left or top edge.
// A left-hand page's margins (`verso`) mirrored back - as the right-hand
// page has them, its inner one on the left.
function referenceLines(element, paper, verso) {
  const m = element.from === "margins" && paper.margins ? paper.margins : { top: 0, right: 0, bottom: 0, left: 0 };
  const left = verso ? m.right : m.left;
  const right = verso ? m.left : m.right;
  return { left, right: paper.width - right, top: m.top, bottom: paper.height - m.bottom };
}

// Where an element is on a paper of `{ width, height, margins }`: { x, top,
// width, height } from its top left corner, in µm - on a left-hand page
// (`verso`), mirrored: measured from the inner side, there on the right.
export function elementRect(element, paper, verso = false) {
  const { width, height } = element;
  const lines = referenceLines(element, paper, verso);
  const rect = {
    x: element.horizontal === "right" ? lines.right - element.x - width : lines.left + element.x,
    top: element.vertical === "bottom" ? lines.bottom - element.y - height : lines.top + element.y,
    width,
    height,
  };
  return verso ? mirrored(rect, paper) : rect;
}

// An element placed at `rect` on a paper of `{ width, height, margins }` -
// measured from what it's measured from (its `from`) nearest it, across and
// down, its centre deciding: what keeps it where it is on a paper of
// another size, or with other margins.
export function placeElement(element, rect, paper, verso = false) {
  if (verso) rect = mirrored(rect, paper);
  const lines = referenceLines(element, paper, verso);
  const right = rect.x + rect.width / 2 > paper.width / 2;
  const bottom = rect.top + rect.height / 2 > paper.height / 2;
  element.horizontal = right ? "right" : "left";
  element.x = Math.round(right ? lines.right - rect.x - rect.width : rect.x - lines.left);
  element.vertical = bottom ? "bottom" : "top";
  element.y = Math.round(bottom ? lines.bottom - rect.top - rect.height : rect.top - lines.top);
  element.width = Math.round(rect.width);
  element.height = Math.round(rect.height);
}

// An element measured anew - from another edge, or from the margins
// instead of the paper's edges (`measuring`: { horizontal, vertical, from },
// any of them) - staying where it is on `paper`, as on a right-hand page.
export function measureElement(element, measuring, paper) {
  const rect = elementRect(element, paper);
  Object.assign(element, measuring);
  const lines = referenceLines(element, paper, false);
  element.x = Math.round(element.horizontal === "right" ? lines.right - rect.x - rect.width : rect.x - lines.left);
  element.y = Math.round(element.vertical === "bottom" ? lines.bottom - rect.top - rect.height : rect.top - lines.top);
}

// The elements of a page - page `index` of `count` in a document laid out
// with `layout` (one with content) - each with where it is, on `paper`.
// A paper says which side it is (`side`, see ../print/Section.js's
// formatOfPage()) - a left-hand one, mirrored.
export function pageElements(layout, index, count, paper) {
  if (!layout || !layout.hasContent()) return [];
  const verso = paper.side === "verso";
  return layout[pageKind(index, count)].map((element) => ({ element, rect: elementRect(element, paper, verso) }));
}
