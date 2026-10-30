import { observable } from "@liquefy/cascade.component";

/**
 * PaperSequence - the render target of a printed document: a sequence of
 * papers, and the lines of text laid out on each. No DOM anywhere, and every
 * length in µm (see units.js). What a document is rendered onto - its
 * sections and paragraphs (see Section.js, Paragraph.js); what is shown on
 * screen, or sent to a printer, is made from it afterwards.
 *
 * Temporal, like any render target - everything on it is positioned in
 * render order, so each component sees it as what was rendered before it
 * left it (see cascade.DOM's DOMElementTarget, and the demo's Paper):
 *
 *  - `pages`: the papers so far, each { width, height, margins } - pushed by
 *    a section as it starts, and by a paragraph that runs off the bottom
 *    of one.
 *  - `next`: where the next thing goes - { page, y, spaceAfter, atPageTop }:
 *    the page it's on, how far down it (from the paper's top edge), the
 *    space the paragraph before asked for after it, and whether nothing is
 *    on the page yet. Frozen, so a paragraph that ends where it did before
 *    leaves the next one where it was - and nothing after it lays out again.
 *  - `linesOf(page)`: the lines on one paper (see Paragraph.js for what a
 *    placed line holds).
 *  - `inserts`: what goes between the papers - each { page, before,
 *    sequence, format, items }: after paper `page` (or, `before`, before
 *    it), pages of their own, shown and printed by whoever knows what they
 *    are; the paper they follow's format; and what's in them, laid out
 *    onto paper sequences of their own (see Tabula's
 *    ../layout/DocumentLayout.js).
 *  - `firstSide`: the side of a sheet its first paper is, printed on both
 *    sides - "recto", "verso", or null: "recto", unless a section says (see
 *    Section.js's firstPageSide()). Set by whoever makes the paper sequence:
 *    one of pages of their own, laid out among another's papers, starting
 *    where those leave off - after a right-hand page there, a left-hand one.
 *  - `firstNumber`: its first paper's page number - 1, unless whoever made
 *    it says: pages of their own, numbered on from the papers before them.
 *    Each paper's number - numberOf(index) - counts on from there, past
 *    pages of their own before it (`inserts`, their `pages`, and a blank
 *    back, `pad`); what a page layout draws on a paper - a page number -
 *    is drawn with it.
 *  - `outer`: the paper sequence it's laid out among the papers of, if it
 *    is - whose last page number is the last there is (lastNumber()).
 */
export class PaperSequence {
  constructor() {
    this.pages = observable([]);
    this.inserts = observable([]);
    this.next = null;
    this.firstSide = null;
    this.firstNumber = 1;
    this.outer = null;
    // No timeless side (see cascade.component's fromTarget()): nothing about
    // a paper sequence is the same throughout a pass.
    this.timeless = null;
    return observable(this);
  }

  // The page number of paper `index` - past pages of their own before it.
  numberOf(index) {
    return this.firstNumber + index + this.insertedPages((insert) => insert.page < index || (insert.page === index && insert.before));
  }

  // The number of the last page - pages of their own after the last paper
  // too; among another's papers, the last of all of them.
  lastNumber() {
    if (this.outer) return this.outer.lastNumber();
    return this.firstNumber - 1 + this.pages.length + this.insertedPages(() => true);
  }

  // The page number pages of their own placed now start at - before paper
  // `page`, or after it, after those already there.
  insertNumber(page, before) {
    if (before) return this.numberOf(page);
    return this.numberOf(page) + 1 + this.insertedPages((insert) => insert.page === page && !insert.before);
  }

  insertedPages(which) {
    return this.inserts.filter(which).reduce((sum, insert) => sum + (insert.pages || 0) + (insert.pad ? 1 : 0), 0);
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
