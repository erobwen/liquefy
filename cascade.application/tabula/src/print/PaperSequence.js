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
 *    Or `numberFrom`, written as it's rendered - temporal, as the rest:
 *    what's rendered first on it starting the page numbers anew (see
 *    Section.js's numberingStart()). Each paper's number - numberOf(index)
 *    - counts on from there, and on past pages of their own before it, from
 *    the number after them (each insert's `nextNumber`): page numbers run
 *    through all of it, in reading order, started anew wherever something
 *    starts them. What a page layout draws on a paper - a page number - is
 *    drawn with it - and, "of 7", the last page number before they're
 *    started anew again (lastNumberOf()).
 *  - `outer`: the paper sequence it's laid out among the papers of, if it
 *    is - the outermost all of it is in, the one its page numbers are
 *    counted through.
 */
export class PaperSequence {
  constructor() {
    this.pages = observable([]);
    this.inserts = observable([]);
    this.next = null;
    this.firstSide = null;
    this.firstNumber = 1;
    this.numberFrom = null;
    this.outer = null;
    // No timeless side (see cascade.component's fromTarget()): nothing about
    // a paper sequence is the same throughout a pass.
    this.timeless = null;
    return observable(this);
  }

  // Its first paper's page number.
  startNumber() {
    return this.numberFrom !== null ? this.numberFrom : this.firstNumber;
  }

  // The page number of paper `index` - counted on from the last pages of
  // their own before it, or from its first. `index` past its last paper:
  // the number after all of it - what comes after it numbered on from.
  numberOf(index) {
    let number = this.startNumber();
    let from = 0;
    for (const insert of this.inserts) {
      const before = insert.before ? insert.page : insert.page + 1;
      if (before <= index) {
        number = insert.nextNumber;
        from = before;
      }
    }
    return number + index - from;
  }

  // The page number pages of their own placed now start at - before paper
  // `page`, or after it, after those already there.
  insertNumber(page, before) {
    return this.numberOf(before ? page : page + 1);
  }

  // The number after all of it.
  nextNumber() {
    return this.numberOf(this.pages.length);
  }

  // The last page number before they're started anew - from paper `index`
  // on, through everything after it in the outermost paper sequence it's
  // in (`outer`): "of 7".
  lastNumberOf(index) {
    let outermost = this;
    while (outermost.outer) outermost = outermost.outer;
    let found = false;
    let last = null;
    for (const page of outermost.allPages()) {
      if (page.restart && found) break;
      if (page.restart) continue;
      if (page.sequence === this && page.index === index) found = true;
      last = page.number;
    }
    return found ? last : this.numberOf(index);
  }

  // Every page, in reading order - its own papers and all pages of their
  // own among them, each { sequence, index, number } (a place, a blank back:
  // no sequence) - and, where page numbers start anew, { restart: true }.
  *allPages() {
    if (this.numberFrom !== null) yield { restart: true };
    const last = Math.max(this.pages.length - 1, ...this.inserts.map((insert) => insert.page));
    for (let page = 0; page <= last; page++) {
      for (const insert of this.inserts) if (insert.page === page && insert.before) yield* insertPages(insert);
      if (page < this.pages.length) yield { sequence: this, index: page, number: this.numberOf(page) };
      for (const insert of this.inserts) if (insert.page === page && !insert.before) yield* insertPages(insert);
    }
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

// Pages of their own, page by page (see PaperSequence's allPages()).
function* insertPages(insert) {
  for (const item of insert.items || []) {
    if (item.pages) yield* item.pages.allPages();
    else for (let count = 0; count < item.count; count++) yield { sequence: null, number: item.number + count };
  }
  if (insert.pad) yield { sequence: null, number: insert.nextNumber - 1 };
}
