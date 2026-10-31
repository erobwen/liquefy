import { observable } from "@liquefy/cascade.component";
import { isSection, sectionsAround, isFlowEdge } from "./flows.js";

/**
 * Inner sequences - pages of their own, anchored in a structured text: a
 * sequence of documents, as the app's own (see ../shell/documents.js), but
 * in a document - a cover before its title, the copyright page after it, a
 * floor plan after a paragraph saying "the following page is the floor
 * plan", a colophon after it all. Whatever starts there starts on a page of
 * its own - and the text after them, on a fresh one: a page break, with
 * pages between.
 *
 * Anchored to a flow (see flows.js): after a paragraph (`after`) - its
 * pages after the page the paragraph ends on - or before or after a section
 * (`before`, `after`) - the section's pages ending there, or starting
 * after them. A document's, before its title or after it all. After a
 * paragraph, the text can run on instead (`runOn`), filling the page the
 * paragraph ends on first, as if nothing happened - a floor plan's pages,
 * after the page that mentions them.
 *
 * Its `items`: documents - hydrated, of any kind - or `null`, a place for
 * one: a page to be, what it is still to be chosen. A new one is empty: a
 * page break, a creation dot in it (see ../shell/InsertView.js) - and,
 * fresh, with nothing in it (isFresh()), it can still be moved from flow to
 * flow by Ctrl+Enter in the text (see ../paper/editing.js's pageBreak());
 * from its creation dots, whatever is in it.
 *
 * Its creation dots are places for the caret too (dotPosition()): before
 * its first item, between two, after its last - in an empty one, the one.
 *
 * How many pages each item takes - and so the side of a sheet each page
 * after them is - is worked out where they're laid out: in what they're
 * in (see ../layout/DocumentLayout.js's InsertLayout).
 *
 * Saved: { type: "sequence", name: "inner", properties: { items, runOn } }
 * - `runOn` only when it's set.
 */
export class InnerSequence {
  constructor(items = [], { runOn = false } = {}) {
    this.items = observable(items);
    this.runOn = !!runOn;
    return observable(this);
  }

  dehydrate() {
    return { type: "sequence", name: "inner", properties: { items: [...this.items], ...(this.runOn ? { runOn: true } : {}) } };
  }
}

// A creation dot of an inner sequence, as a place for the caret - a marker
// of its own (see flows.js): before item `index` - after the last, at its
// count.
export const dotPosition = (sequence, index) => Object.freeze({ flow: sequence, edge: "dot", index });
export const isDot = (at) => isFlowEdge(at) && at.edge === "dot";

// The places for the caret an inner sequence has: one, empty - or one
// before each item and one after the last.
export const dotCount = (sequence) => sequence.items.length === 0 ? 1 : sequence.items.length + 1;

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
