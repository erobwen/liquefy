import { observable } from "@liquefy/cascade.component";
import { PageLayout } from "../../model/pageLayout.js";

// A page: its page layout (see ../../model/pageLayout.js) - what's on it,
// its first page all there is; its paper as what it's in has it, the
// file's, but for what it sets itself - and whether it starts the page
// numbers anew (`startsNumbering`).
export function newPage({ elements = [], pageLayout = null, startsNumbering = false } = {}) {
  return observable({
    pageLayout: pageLayout ? pageLayout.ensureContent() : new PageLayout({ first: elements }),
    startsNumbering: !!startsNumbering,
  });
}
