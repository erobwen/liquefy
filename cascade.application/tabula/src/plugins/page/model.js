import { observable } from "@liquefy/cascade.component";
import { paperSizes, margins } from "../../print/index.js";
import { PageLayout } from "../../model/pageLayout.js";

// A page: its paper, and its page layout - its first page all there is,
// and no margins: nothing flows through it.
export function newPage(paper = paperSizes.A4, elements = [], ownPaper = false) {
  return observable({
    paper: Object.freeze({ width: paper.width, height: paper.height }),
    ownPaper,
    pageLayout: new PageLayout({ margins: margins(0), first: elements }),
  });
}

// Its paper, as it's laid out: its own - or, in another document, that
// one's (`inherited` - see ../../layout/DocumentLayout.js's `pageSettings`),
// unless it keeps its own (`ownPaper`).
export function pageFormat(model, inherited = null) {
  if (inherited && !model.ownPaper) return inherited;
  return { width: model.paper.width, height: model.paper.height, margins: margins(0) };
}
