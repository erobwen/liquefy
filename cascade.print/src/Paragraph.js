import { Component, frozen, repeat, refreshIfNeeded, retractRepeater } from "@liquefy/cascade.component";
import { breakIntoLines } from "./lineBreaking.js";

/**
 * Paragraph - a paragraph of text laid out onto a paper sequence, in two
 * steps, each a repeater of its own:
 *
 *  1. Breaking into lines (breakLines()): its text measured and divided
 *     into lines for the width it's given. An independent repeater, like a
 *     component's build: it reruns only when what it's made of - its
 *     content(), the measurer, the width - changes, never because the
 *     paragraph moved.
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
 * Knows nothing of any model: a subclass says what the paragraph is made
 * of, in content() - read in step 1, so whatever it reads (a model's text,
 * its styles) is what step 1 follows:
 *
 *   {
 *     spans: [{ text, font }],   // the text, each font resolved (see lineBreaking.js)
 *     font,                      // the paragraph's own - the height of an empty one
 *     align, lineSpacing, indentLeft, indentRight, firstLineIndent,  // optional
 *     spaceBefore, spaceAfter,   // optional, µm
 *   }
 *
 * A placed line, pushed onto its page's lines (PaperSequence.linesOf()), is
 * a line as breakIntoLines() made it, positioned on the paper - x and every
 * y from the paper's own top left corner:
 *
 *   { ...line, x, top, baseline, paragraph, index }
 *
 * `paragraph` is the paragraph's `source` - whatever a model wants it to
 * be, typically its own paragraph object - and `index` which of its lines
 * it is. With the line's `start`/`end`, what finds the place in the text
 * under a point on a paper, and a place in the text on the papers (see
 * positions.js).
 *
 * Measured with the text measurer it inherits, as `textMeasurer`.
 *
 * Properties: `source`, `width` - of the content area it's laid out in -
 * and `format` - the paper it's on ({ width, height, margins }). A subclass
 * taking properties of its own passes these on with super.setProperties().
 */
export class Paragraph extends Component {
  setProperties({ source, width, format }) {
    this.source = source;
    this.width = width;
    this.format = frozen(format);
  }

  // Override: what this paragraph is made of (see above).
  content() {
    throw new Error(this.constructor.name + " must implement content()");
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
    const { spaceBefore = 0, spaceAfter = 0, ...content } = this.content();
    return frozen({
      spaceBefore,
      spaceAfter,
      lines: breakIntoLines({ ...content, width: this.width, measurer: this.inherit("textMeasurer") }),
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
    let pageRows = sequence.rowsOf(page);
    lines.forEach((line, index) => {
      // A line that doesn't fit goes on the next paper - unless it's the
      // first on this one: then it would fit on none.
      if (!atPageTop && y + line.height > bottom) {
        sequence.pages.push(format);
        page += 1;
        y = format.margins.top;
        atPageTop = true;
        pageLines = sequence.linesOf(page);
        pageRows = sequence.rowsOf(page);
      }
      const placed = frozen({
        ...line,
        x: format.margins.left + line.x,
        top: y,
        baseline: y + line.ascent,
        paragraph: this.source,
        index,
      });
      // Drawn - and a row for the caret to be on.
      pageLines.push(placed);
      pageRows.push(placed);
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
