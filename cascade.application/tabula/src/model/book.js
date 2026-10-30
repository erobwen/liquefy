import { isSection, isParagraph, paragraphText } from "./flows.js";

/**
 * The start and the end of a book - its pages around the body (see
 * flows.js's Document): the front, before the title; the title page; the
 * pages after it, up to where the body starts; and the back, after the body.
 * There, the unit is the page, not the paragraph: each a few lines, or none,
 * or a picture filling it - a page of its own all the same (see
 * ../paper/editing.js's pageBreak(), Ctrl+Enter).
 *
 * None of it to begin with: a document is a book once it has a page before
 * or after its body (isBook()) - and then its chapters, the sections right in
 * it, start pages of their own too (`chaptersOnNewPage`).
 *
 * What a page usually is, where it is, is hinted at - in place of an empty
 * page's text, faintly (hint()): before the title, a half title, its back a
 * frontispiece; after the title page, the copyright page, a dedication, an
 * epigraph, the contents; at the very end, the colophon, and before it,
 * about the author. Only hints: any page can be anything.
 */

export const isBook = (document) => document.front.children.length > 0 || document.back.children.length > 0 || document.pageStarts.length > 0;

export const startsPage = (document, flow) => document.pageStarts.includes(flow);

// The index of the document's first section among its children - where the
// body certainly starts - or their count, with none.
export function firstSectionIndex(document) {
  const index = document.children.findIndex(isSection);
  return index < 0 ? document.children.length : index;
}

// Its pages around the body, in order, each { where, flows }: "front"
// (before the title - its flows in the front), "title" (the title page - the
// title, then the children before the first page start), "after" (a page
// after the title page - children), "body": the page the body starts on, its
// flows up to the first section - or none of them, if the body starts with
// one - and "back", after the body. The body's own pages, past its start,
// aren't among them: those are the flow's.
export function bookPages(document) {
  const pages = [];
  let page = null;
  const matter = (where, list) => list.children.forEach((flow, index) => {
    if (index === 0 || startsPage(document, flow)) pages.push(page = { where, flows: [] });
    page.flows.push(flow);
  });
  matter("front", document.front);
  pages.push(page = { where: "title", flows: [] });
  const end = firstSectionIndex(document);
  document.children.forEach((flow, index) => {
    if (startsPage(document, flow)) pages.push(page = { where: "after", flows: [] });
    if (index < end) page.flows.push(flow);
  });
  // The last page started after the title: the body's.
  if (page.where === "after") page.where = "body";
  matter("back", document.back);
  return pages;
}

// The page a flow around the body is on - and the ones before and after it
// - or null.
export function pageOf(document, flow) {
  const pages = bookPages(document);
  const index = pages.findIndex((page) => page.flows.includes(flow));
  return index < 0 ? null : { page: pages[index], before: pages[index - 1] || null, after: pages[index + 1] || null };
}

// A page with nothing on it: one empty paragraph.
export const isEmptyPage = (page) => !!page && page.where !== "title" && page.where !== "body" && page.flows.length === 1
  && isParagraph(page.flows[0]) && paragraphText(page.flows[0]) === "";

// A page of a book's own - before or after the body, not the title's nor the
// body's - that `paragraph` is the one flow of: what a page can be made a
// whole picture of (see frames.js's "page" placement).
export function isWholePage(document, paragraph) {
  const found = pageOf(document, paragraph);
  return !!found && found.page.where !== "title" && found.page.where !== "body" && found.page.flows.length === 1;
}

const frontHints = ["Half title", "Frontispiece"];
const afterHints = ["Copyright", "Dedication", "Epigraph", "Contents"];
// From the end.
const backHints = ["Colophon", "About the author"];

// What's usually on a page, where `flow` starts one - for its empty
// paragraph to show faintly - or null: the body's, the title page's, or a
// flow that starts no page around the body.
export function hint(document, flow) {
  const pages = bookPages(document);
  const page = pages.find((each) => each.flows[0] === flow);
  if (!page || page.where === "title" || page.where === "body") return null;
  const same = pages.filter((each) => each.where === page.where);
  if (page.where === "back") return backHints[same.length - 1 - same.indexOf(page)] || "Page";
  return (page.where === "front" ? frontHints : afterHints)[same.indexOf(page)] || "Page";
}
