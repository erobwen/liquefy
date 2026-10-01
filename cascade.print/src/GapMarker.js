import { Component, frozen } from "@liquefy/cascade.component";

/**
 * GapMarker - a place between a model's parts where a caret can be, marked
 * on the paper sequence: a gap between two paragraphs, before the first of a
 * list, after the last. Rendered among the paragraphs, in reading order, it
 * pushes a caret row onto its paper (see PaperSequence's `rowsOf()`) where
 * the text flow has got to - and takes no room: the flow is left as it was,
 * so placing, adding or removing a gap never moves any text.
 *
 *   new GapMarker({ position: gapPosition(list, index), x, height, format })
 *
 *  - position: what the gap is - typically gapPosition(list, index) (see
 *    positions.js): before item `index` of a model's list. Opaque to
 *    cascade.print, as a line's paragraph is: compared, never looked into.
 *  - x: where across the paper the gap's caret goes, from the content
 *    area's left edge (µm) - negative into the margin. Gaps at one place,
 *    at different levels of a model's structure (the end of a section, and
 *    after it), told apart by being set apart here.
 *  - height: how tall its caret is (µm).
 *  - format: the paper it's on, as for a paragraph.
 *
 * A placed gap row: { gap: position, x, top, height } - x and top from the
 * paper's top left corner, as a line's.
 */
export class GapMarker extends Component {
  setProperties({ position, x = 0, height, format }) {
    this.position = position;
    this.x = x;
    this.height = height;
    this.format = frozen(format);
  }

  render(sequence) {
    const { page, y } = sequence.flow;
    sequence.rowsOf(page).push(frozen({
      gap: this.position,
      x: this.format.margins.left + this.x,
      top: y,
      height: this.height,
    }));
  }
}
