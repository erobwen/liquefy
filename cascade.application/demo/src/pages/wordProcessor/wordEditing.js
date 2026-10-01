import {
  position, paragraphLength, insertText, deleteBackward, deleteForward, deleteBetween, splitParagraph,
  moveLeft, moveRight, documentStart, documentEnd, orderedRange, wordAt,
} from "./editing.js";

/**
 * The word processor's model edited through cascade.print's PaperEditor:
 * the editor knows nothing of the model, and asks it, through this, what an
 * edit or a move through the text does (see PaperEditor for what each is).
 */
export function wordEditing(document) {
  return {
    insertText: (at, text) => insertText(document, at, text),
    deleteBackward: (at) => deleteBackward(document, at),
    deleteForward: (at) => deleteForward(document, at),
    splitParagraph: (at) => splitParagraph(document, at),
    deleteBetween: (anchor, focus) => deleteBetween(document, anchor, focus),
    moveLeft: (at) => moveLeft(document, at),
    moveRight: (at) => moveRight(document, at),
    documentStart: () => documentStart(document),
    documentEnd: () => documentEnd(document),
    orderedRange: (a, b) => orderedRange(document, a, b),
    wordAt: ({ paragraph, offset }) => {
      const [start, end] = wordAt(paragraph, offset);
      return [position(paragraph, start), position(paragraph, end)];
    },
    paragraphAt: ({ paragraph }) => [position(paragraph, 0), position(paragraph, paragraphLength(paragraph))],
  };
}
