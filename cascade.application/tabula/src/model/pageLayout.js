import { observable } from "@liquefy/cascade.component";

/**
 * A document's page layout - how each of its pages is set up, around the
 * text that flows through them:
 *
 *  - `margins`: { top, right, bottom, left } in µm, each from its own edge
 *    of the paper - the box the text flows in, on every page.
 *  - `first`, `middle`, `last`: what's drawn on the first page, on every
 *    page between, and on the last - each a list of page elements (below):
 *    a page number at the foot, a coloured band along the top, a picture.
 *    A document of one page has a first page only; of two, a first and a
 *    last (see pageKind()).
 *
 * The paper differs - A4, Letter - and the layout goes with it: a page
 * element is placed parametrically, at a distance from one of the paper's
 * edges across (`horizontal`: "left" or "right", `x` from it to the
 * element's near side) and one of its edges down (`vertical`: "top" or
 * "bottom", `y`), as a margin is - whichever edges are nearest, as it's
 * placed (placeElement()). A box at the bottom right stays at the bottom
 * right, whatever the paper. Its size is its own.
 *
 * What's in it is a hydrated document (see ../shell/documents.js), as in a
 * frame in the text (see frames.js): a kind with a `frame`, shown filling
 * the element - told which page it's on (`{ page, pages }`, 1-based), so
 * a page number can say it.
 */
export class PageLayout {
  constructor({ margins, first = [], middle = [], last = [] }) {
    this.margins = margins;
    this.first = observable(first);
    this.middle = observable(middle);
    this.last = observable(last);
    return observable(this);
  }

  // Saved: { type: "pageLayout", name: "pages", properties } (see
  // ../shell/hydration.js).
  dehydrate() {
    return {
      type: "pageLayout",
      name: "pages",
      properties: { margins: { ...this.margins }, first: [...this.first], middle: [...this.middle], last: [...this.last] },
    };
  }
}

export class PageElement {
  constructor({ content, horizontal = "left", x = 0, vertical = "top", y = 0, width, height }) {
    this.content = content;
    this.horizontal = horizontal;
    this.x = x;
    this.vertical = vertical;
    this.y = y;
    this.width = width;
    this.height = height;
    return observable(this);
  }

  dehydrate() {
    const { content, horizontal, x, vertical, y, width, height } = this;
    return { type: "pageElement", name: "element", properties: { horizontal, x, vertical, y, width, height, content } };
  }
}

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

// Where an element is on a paper of `{ width, height }`: { x, top, width,
// height } from its top left corner, in µm.
export function elementRect(element, paper) {
  const { width, height } = element;
  return {
    x: element.horizontal === "right" ? paper.width - element.x - width : element.x,
    top: element.vertical === "bottom" ? paper.height - element.y - height : element.y,
    width,
    height,
  };
}

// An element placed at `rect` on a paper of `{ width, height }` - measured
// from the edges nearest it, across and down, its centre deciding: what
// keeps it where it is on a paper of another size.
export function placeElement(element, rect, paper) {
  const right = rect.x + rect.width / 2 > paper.width / 2;
  const bottom = rect.top + rect.height / 2 > paper.height / 2;
  element.horizontal = right ? "right" : "left";
  element.x = Math.round(right ? paper.width - rect.x - rect.width : rect.x);
  element.vertical = bottom ? "bottom" : "top";
  element.y = Math.round(bottom ? paper.height - rect.top - rect.height : rect.top);
  element.width = Math.round(rect.width);
  element.height = Math.round(rect.height);
}

// The elements of a page - page `index` of `count` in a document laid out
// with `layout` - each with where it is, on `paper`.
export function pageElements(layout, index, count, paper) {
  if (!layout) return [];
  return layout[pageKind(index, count)].map((element) => ({ element, rect: elementRect(element, paper) }));
}
