import { Component, frozen, repeat, refreshIfNeeded, retractRepeater } from "@liquefy/cascade.component";
import { paragraphStyleOf } from "./styles.js";
import { breakIntoLines } from "./lineBreaking.js";

/**
 * Paragraph - one paragraph of a document's model, laid out in two steps,
 * each a repeater of its own:
 *
 *  1. Breaking into lines (breakLines()): its text measured and divided
 *     into lines for the width it's given. An independent repeater, like a
 *     component's build: it reruns only when the text, the styles, the
 *     measurer or the width change - never because the paragraph moved.
 *  2. Placing the lines (render()): onto the paper sequence, from wherever
 *     the paragraph before left off, onto a new paper when one is full. The
 *     render repeater - temporal, positioned among everything else rendered
 *     onto the paper sequence.
 *
 * So typing in a paragraph breaks only that paragraph again; the ones after
 * it are only placed again - arithmetic - and only as far as the change
 * reaches: a paragraph that ends where it did before leaves the rest where
 * they were (see PaperSequence's `flow`).
 *
 * A placed line, pushed onto its page's lines (PaperSequence.linesOf()), is
 * a line as breakIntoLines() made it (see lineBreaking.js), positioned on
 * the paper - x and every y from the paper's own top left corner:
 *
 *   { ...line, x, top, baseline, paragraph, index }
 *
 * `paragraph` is the model paragraph it's from and `index` which of its
 * lines it is - with the line's `start`/`end`, what finds the text under a
 * position on the paper, and the position of a place in the text.
 *
 * Properties: `paragraph` - the model's ({ style, spans: [{ text, style?,
 * font? }] }, see styles.js), `width` - of the content area it's laid out
 * in, `format` - the paper it's on ({ width, height, margins }).
 */
export class Paragraph extends Component {
  setProperties({ paragraph, width, format }) {
    this.paragraph = paragraph;
    this.width = width;
    this.format = frozen(format);
  }

  initialUnobservables() {
    // `breaks`/`placements`: how many times each step has run - bookkeeping
    // to see what a change actually did.
    return { lineRepeater: null, breaks: 0, placements: 0 };
  }

  // Step 1: the lines, and the space the paragraph asks for around them.
  // Frozen: broken the same as before, it's the same value, and placing it
  // has nothing to redo.
  breakLines() {
    this.unobservable.breaks++;
    const paragraph = this.paragraph;
    const stylesheet = this.inherit("styles");
    const style = paragraphStyleOf(stylesheet, paragraph);
    return frozen({
      spaceBefore: style.spaceBefore,
      spaceAfter: style.spaceAfter,
      lines: breakIntoLines({
        spans: paragraph.spans,
        paragraphStyle: style,
        stylesheet,
        width: this.width,
        measurer: this.inherit("textMeasurer"),
      }),
    });
  }

  // The lines, brought up to date. Pulled by the render, like a build (see
  // cascade.component's buildOneStep()): its result is written for the
  // render to read, so it must never be read mid-rerun - pending work on it
  // invalidates the render instead of being queued, and the render runs it
  // first. Never retracted while the paragraph is merely not rendered, only
  // when it's dropped (onDispose()).
  brokenLines() {
    const u = this.unobservable;
    if (!u.lineRepeater) {
      u.lineRepeater = repeat(() => {
        this.lineLayout = this.breakLines();
      }, {
        independent: true,
        pulledBy: () => u.repeater,
      });
    } else {
      if (u.lineRepeater.retracted) u.lineRepeater.restart();
      refreshIfNeeded(u.lineRepeater);
    }
    return this.lineLayout;
  }

  // Step 2: placing the lines.
  render(sequence) {
    const { spaceBefore, spaceAfter, lines } = this.brokenLines();
    this.unobservable.placements++;
    const format = this.format;
    const bottom = format.height - format.margins.bottom;
    let { page, y, atPageTop } = sequence.flow;
    // Space between paragraphs - after the one before, and before this one -
    // but none at the top of a paper.
    if (!atPageTop) y += sequence.flow.spaceAfter + spaceBefore;
    let pageLines = sequence.linesOf(page);
    lines.forEach((line, index) => {
      // A line that doesn't fit goes on the next paper - unless it's the
      // first on this one: then it would fit on none.
      if (!atPageTop && y + line.height > bottom) {
        sequence.pages.push(format);
        page += 1;
        y = format.margins.top;
        atPageTop = true;
        pageLines = sequence.linesOf(page);
      }
      pageLines.push(frozen({
        ...line,
        x: format.margins.left + line.x,
        top: y,
        baseline: y + line.ascent,
        paragraph: this.paragraph,
        index,
      }));
      y += line.height;
      atPageTop = false;
    });
    sequence.flow = frozen({ page, y, spaceAfter, atPageTop });
  }

  onDispose() {
    const u = this.unobservable;
    if (u.lineRepeater) retractRepeater(u.lineRepeater);
    super.onDispose();
  }
}
