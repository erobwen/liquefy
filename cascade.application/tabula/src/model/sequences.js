import { observable } from "@liquefy/cascade.component";
import { isSection, sectionsAround } from "./flows.js";

/**
 * Inner sequences - pages of their own, anchored in a structured text: a
 * sequence of documents, as the app's own (see ../shell/documents.js), but
 * in a document - a cover before its title, the copyright page after it, a
 * floor plan after a paragraph saying "the following page is the floor
 * plan", a colophon after it all. Whatever starts there starts on a page of
 * its own, and the text goes on after them as if nothing happened.
 *
 * Anchored to a flow (see flows.js): after a paragraph (`after`) - its
 * pages after the page the paragraph ends on, the text going on filling that
 * page first - or before or after a section (`before`, `after`) - the
 * section's pages ending there, or starting after them. A document's,
 * before its title or after it all.
 *
 * Its `items`: documents - hydrated, of any kind - or `null`, a place for
 * one: a page to be, what it is still to be chosen (the creation dot). A new
 * one holds one such place: fresh (isFresh()) - and, fresh, it can still be
 * moved from flow to flow (see ../paper/editing.js's pageBreak()).
 *
 * How many pages each item takes (`pageCounts`, by its index) is told by
 * what shows it - its editor, as it lays it out (see
 * ../shell/InsertView.js) - for the pages around them to count on from
 * (pageCount()): a right-hand page, or a left-hand one, after them.
 *
 * Saved: { type: "sequence", name: "inner", properties: { items } }.
 */
export class InnerSequence {
  constructor(items = [null]) {
    this.items = observable(items);
    this.pageCounts = observable([]);
    return observable(this);
  }

  dehydrate() {
    return { type: "sequence", name: "inner", properties: { items: [...this.items] } };
  }
}

// How many pages its items take: each as told, a page if not told yet - a
// place, a page.
export function pageCount(sequence) {
  return sequence.items.reduce((sum, item, index) => sum + (item === null ? 1 : sequence.pageCounts[index] || 1), 0);
}

// Nothing chosen in it yet: places only.
export const isFresh = (sequence) => !!sequence && sequence.items.every((item) => item === null);

// The flows a sequence can be anchored after, from `flow` outward: the
// paragraph itself - a title's too - then every section it's in, the
// innermost first, its document last. Under `root`.
export function anchorLadder(root, flow) {
  const around = sectionsAround(root, flow) || [];
  const steps = isSection(flow) ? [flow] : [flow];
  for (let index = around.length - 1; index >= 0; index--) {
    if (around[index] !== flow) steps.push(around[index]);
  }
  return steps;
}

// Every flow of a document with an inner sequence anchored to it: [{ flow,
// side, sequence }] - side "before" or "after" - in the order they come in:
// a section's before it, after its title's, its children's, then after it.
export function anchoredSequences(document) {
  const result = [];
  const visit = (flow) => {
    if (flow.before) result.push({ flow, side: "before", sequence: flow.before });
    if (flow.title) visit(flow.title);
    if (flow.children) flow.children.forEach(visit);
    if (flow.after) result.push({ flow, side: "after", sequence: flow.after });
  };
  visit(document);
  return result;
}

// Where a sequence is anchored - { flow, side } - or null.
export function anchorOf(document, sequence) {
  return anchoredSequences(document).find((each) => each.sequence === sequence) || null;
}

// What its first page usually is, where it's anchored - for its place to
// say, faintly.
export function hintFor(document, flow, side) {
  if (flow === document) return side === "before" ? "Cover" : "Colophon";
  if (flow === document.title) return "Copyright";
  if (isSection(flow) && document.children.includes(flow) && side === "before") return "Part title";
  return "Pages of their own";
}
