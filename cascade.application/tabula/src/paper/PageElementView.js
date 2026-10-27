import { Component, frozen } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { cssMm } from "../print/dom.js";

/**
 * A page element on a paper (see ../model/pageLayout.js): at `rect` - { x,
 * top, width, height } in µm from the paper's top left corner - its content
 * shown as its kind shows it in a frame (see ../shell/documents.js), told
 * `page`, { page, pages }: which page it's on.
 *
 * On the papers being written on, only shown: under the text, never in the
 * way of a click. In a page layout being edited (see PageLayoutEditor.js),
 * `onPress(event)` - pressed, to be selected and moved - and, `selected`,
 * outlined, with a handle at its bottom right corner for resizing it
 * (`data-handle`).
 */
export class PageElementView extends Component {
  setProperties({ element, rect, page, selected = false, onPress = null }) {
    this.element = element;
    this.rect = frozen(rect);
    this.page = frozen(page);
    this.selected = !!selected;
    this.onPress = onPress;
  }

  build() {
    const { element, rect } = this;
    const content = element.content;
    const kind = content && content.documentType ? content.documentType.frame : null;
    const editable = !!this.onPress;
    return div(
      {
        "data-element": "",
        onmousedown: this.onPress || undefined,
        style: {
          position: "absolute", left: cssMm(rect.x), top: cssMm(rect.top), width: cssMm(rect.width), height: cssMm(rect.height),
          pointerEvents: editable ? "auto" : "none", cursor: editable ? "move" : "default",
          outline: this.selected ? "2px solid rgba(66, 133, 244, 0.9)" : editable ? "1px dashed rgba(66, 133, 244, 0.35)" : "none",
        },
      },
      div({ style: { width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none" } }, kind ? kind.view(content.model, this.page) : null),
      this.selected
        ? div({ "data-handle": "", style: { position: "absolute", right: "-5px", bottom: "-5px", width: "10px", height: "10px", background: "white", border: "2px solid #4285f4", boxSizing: "border-box", cursor: "nwse-resize" } })
        : null,
    );
  }
}

export const pageElementView = (...parameters) => new PageElementView(...parameters);

// Which page of its document each of a paper sequence's pages is - {
// index, count } - its document's pages being those after one another
// laid out with the same page layout (see ../layout/DocumentLayout.js's
// pageFormat()).
export function pagesInDocuments(formats) {
  const result = [];
  let start = 0;
  formats.forEach((format, index) => {
    if (index > 0 && format.pageLayout !== formats[index - 1].pageLayout) start = index;
    result.push({ index: index - start, start });
  });
  return result.map(({ index, start }) => {
    let end = start;
    while (end + 1 < formats.length && formats[end + 1].pageLayout === formats[start].pageLayout) end++;
    return { index, count: end - start + 1 };
  });
}
