import { isSection, isParagraph, paragraphText } from "./flows.js";

/**
 * The start of a book - its pages before the body (see flows.js's Document):
 * the front, before the title; the title page; and the pages after it, up to
 * where the body starts. There, the unit is the page, not the paragraph:
 * each a few lines, or none - a page of its own all the same (see
 * ../paper/editing.js's pageBreak(), Ctrl+Enter).
 *
 * None of it to begin with: a document is a book once it has a page before
 * its body (isBook()) - and then its chapters, the sections right in it,
 * start pages of their own too (`chaptersOnNewPage`).
 *
 * What a page usually is, where it is, is hinted at - in place of an empty
 * page's text, faintly (hint()): before the title, a half title, its back a
 * frontispiece; after the title page, the copyright page, a dedication, an
 * epigraph, the contents. Only hints: any page can be anything.
 */

export const isBook = (document) => document.front.children.length > 0 || document.pageStarts.length > 0;

export const startsPage = (document, flow) => document.pageStarts.includes(flow);

// The index of the document's first section among its children - where the
// body certainly starts - or their count, with none.
export function firstSectionIndex(document) {
  const index = document.children.findIndex(isSection);
  return index < 0 ? document.children.length : index;
}

// The pages before the body, in order, each { where, flows }: "front"
// (before the title - its flows in the front), "title" (the title page - the
// title, then the children before the first page start), "after" (a page
// after the title page - children), and, last, "body": the page the body
// starts on, its flows up to the first section - or none of them, if the
// body starts with one.
export function frontPages(document) {
  const pages = [];
  let page = null;
  document.front.children.forEach((flow, index) => {
    if (index === 0 || startsPage(document, flow)) pages.push(page = { where: "front", flows: [] });
    page.flows.push(flow);
  });
  pages.push(page = { where: "title", flows: [] });
  const end = firstSectionIndex(document);
  document.children.forEach((flow, index) => {
    if (startsPage(document, flow)) pages.push(page = { where: "after", flows: [] });
    if (index < end) page.flows.push(flow);
  });
  // The last page started after the title: the body's.
  const last = pages[pages.length - 1];
  if (last.where === "after") last.where = "body";
  return pages;
}

// The page a flow before the body is on - and the one before it - or null.
export function pageOf(document, flow) {
  const pages = frontPages(document);
  const index = pages.findIndex((page) => page.flows.includes(flow));
  return index < 0 ? null : { page: pages[index], before: pages[index - 1] || null, after: pages[index + 1] || null };
}

// A page with nothing on it: one empty paragraph.
export const isEmptyPage = (page) => !!page && page.where !== "title" && page.flows.length === 1
  && isParagraph(page.flows[0]) && paragraphText(page.flows[0]) === "";

const frontHints = ["Half title", "Frontispiece"];
const afterHints = ["Copyright", "Dedication", "Epigraph", "Contents"];

// What's usually on a page, where `flow` starts one - for its empty
// paragraph to show faintly - or null: the body's, the title page's, or a
// flow that starts no page before the body.
export function hint(document, flow) {
  const pages = frontPages(document);
  const page = pages.find((each) => each.flows[0] === flow);
  if (!page || page.where === "title" || page.where === "body") return null;
  const same = pages.filter((each) => each.where === page.where);
  const index = same.indexOf(page);
  return (page.where === "front" ? frontHints : afterHints)[index] || "Page";
}
