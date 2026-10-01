import { observable } from "@liquefy/cascade.component";

/**
 * PaperSequence - the render target of a printed document: a sequence of
 * papers, and the lines of text laid out on each. No DOM anywhere, and every
 * length in µm (see units.js). What a document is rendered onto (see
 * PrintDocument); what is shown on screen, or sent to a printer, is made
 * from it afterwards.
 *
 * Temporal, like any render target - everything on it is positioned in
 * render order, so each component sees it as what was rendered before it
 * left it (see cascade.DOM's DOMElementTarget, and the demo's Paper):
 *
 *  - `pages`: the papers so far, each { width, height, margins } - pushed by
 *    a section as it starts, and by a paragraph that runs off the bottom
 *    of one.
 *  - `flow`: where the next thing goes - { page, y, spaceAfter, atPageTop }:
 *    the page it's on, how far down it (from the paper's top edge), the
 *    space the paragraph before asked for after it, and whether nothing is
 *    on the page yet. Frozen, so a paragraph that ends where it did before
 *    leaves the next one where it was - and nothing after it lays out again.
 *  - `linesOf(page)`: the lines on one paper (see Paragraph.js for what a
 *    placed line holds).
 */
export class PaperSequence {
  constructor() {
    this.pages = observable([]);
    this.flow = null;
    // No timeless side (see cascade.component's fromTarget()): nothing about
    // a paper sequence is the same throughout a pass.
    this.timeless = null;
    return observable(this);
  }

  // The lines placed on page `index` - an array of its own for every page,
  // there for the paper sequence's whole life, whoever places lines on it:
  // a paragraph moving onto the next page pushes onto that one's array
  // instead, and what shows a page reads only its own page's lines. Beyond
  // the last page, empty.
  linesOf(index) {
    const meta = this.causality;
    if (!meta.pageLines) meta.pageLines = [];
    let lines = meta.pageLines[index];
    if (!lines) {
      lines = observable([]);
      meta.pageLines[index] = lines;
    }
    return lines;
  }
}
