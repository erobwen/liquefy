import { Component, callback, frozen, accessInitialValues, withoutRecording } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { card } from "@liquefy/cascade.ui";
import { paperStyle, paperShadow } from "../print/dom.js";
import { creationDot } from "./CreationDot.js";
import { removeButton } from "./removeButton.js";
import { clamp } from "./clamp.js";

/**
 * Pages of their own, between a document's papers - an inner sequence (see
 * ../model/sequences.js), as the papers show it (see
 * ../paper/TabulaPaperView.js): a clamp along their left, saying they go
 * together (see clamp.js - its depth one more than the document's around
 * it), and in it each of its items, one under the other - each as
 * the app shows a document of its kind (`documentViews`, provided by the
 * app - see TabulaApp.js), its pages its own, a remove button on it. A
 * place for one, nothing chosen yet: a page drawn dashed, what it usually is
 * faintly in it (`hint`), and a creation dot - what it's to be. After
 * them, a dot for another.
 *
 *   insertView({ sequence, format, before, pad, hint, onEmpty })
 *
 * `format`: the paper of the page they follow (or, `before` a document's
 * title, come before) - theirs, to begin with; printed on both sides, the
 * side it is says the side each item starts on: each told (`firstSide`,
 * provided to it - see ItemSlot) - and each tells how many pages it takes
 * (`reportPageCount(count)`), for the pages after them to count on. `pad`:
 * a blank back after them, for the page after them to be a right-hand one.
 * `onEmpty()`: its last item removed - the sequence to go.
 */
export class InsertView extends Component {
  setProperties({ sequence, format, before = false, pad = false, hint = "", onEmpty }) {
    this.sequence = sequence;
    this.format = frozen(format);
    this.before = !!before;
    this.pad = !!pad;
    this.hint = hint;
    this.onEmpty = onEmpty || (() => {});
  }

  initialUnobservables() {
    return { depth: 0 };
  }

  // One level deeper, for what's in it.
  provide() {
    const view = this;
    return { get groupDepth() { return view.unobservable.depth + 1; } };
  }

  build() {
    const views = this.inherit("documentViews");
    const depth = this.inherit("groupDepth") || 0;
    this.unobservable.depth = depth;
    const { sequence, format } = this;
    const items = sequence.items;
    const types = views ? views.types() : [];
    const remove = (index) => {
      items.splice(index, 1);
      sequence.pageCounts.splice(index, 1);
      if (items.length === 0) this.onEmpty();
    };
    // The side each item starts on: after a right-hand page, a left-hand
    // one; before a document's title, a right-hand one - and on, past the
    // pages before it.
    const flip = (side) => side === "recto" ? "verso" : "recto";
    let side = !format.side ? null : this.before ? "recto" : flip(format.side);
    const sides = items.map((item, index) => {
      const own = side;
      const count = item === null ? 1 : sequence.pageCounts[index] || 1;
      if (side && count % 2 === 1) side = flip(side);
      return own;
    });
    return div(
      { "data-insert": "", style: groupStyle },
      clamp({ depth, paperWidth: format.width }),
      items.map((item, index) => {
        const key = "item" + index + (item ? "-" + views.keyOf(item) : "");
        if (item === null) {
          return div(
            { key, style: { ...paperStyle(format), ...placeStyle } },
            div({ style: hintStyle }, text(this.hint)),
            creationDot({ documentTypes: types, title: "What's to be here", onCreate: callback("create" + index, (type) => { items[index] = views.create(type); }) }),
          );
        }
        return new ItemSlot({
          key: "slot-" + key,
          sequence,
          index,
          side: sides[index],
          item,
          itemKey: key,
          format,
          onRemove: callback("remove" + key, () => remove(index)),
        });
      }),
      // Its back left blank: the page after it a right-hand one.
      this.pad ? div({ key: "blank", style: { ...paperStyle(format), ...blankStyle } }, div({ style: { ...hintStyle, fontSize: "11pt" } }, text("Left blank"))) : null,
      // Another, after them - once they're all something.
      items.length > 0 && !items.includes(null)
        ? div({ key: "more", style: { height: "10mm", display: "flex", alignItems: "center" } },
          creationDot({ documentTypes: types, shape: "down", title: "More pages of their own", onCreate: callback("more", (type) => { items.push(views.create(type)); }) }))
        : null,
    );
  }
}

export const insertView = (...parameters) => new InsertView(...parameters);

// One item of pages of their own: what shows it, as the app shows a
// document of its kind - built here, its own - told the side of a sheet it
// starts on (`firstSide`), telling how many pages it takes
// (`reportPageCount(count)`), both provided to it.
class ItemSlot extends Component {
  setProperties({ sequence, index, side, item, itemKey, format, onRemove }) {
    this.sequence = sequence;
    this.index = index;
    this.side = side;
    this.item = item;
    this.itemKey = itemKey;
    this.format = frozen(format);
    this.onRemove = onRemove;
  }

  provide() {
    const slot = this;
    return {
      get firstSide() { return slot.side; },
      // Written where the counts are read from - the papers' layout - at
      // the baseline, and only when it's another.
      reportPageCount: (count) => {
        const counts = slot.sequence.pageCounts;
        if (withoutRecording(() => counts[slot.index]) !== count) accessInitialValues(() => { counts[slot.index] = count; });
      },
    };
  }

  build() {
    const views = this.inherit("documentViews");
    return views ? views.view(this.item, { key: this.itemKey, format: this.format, onRemove: this.onRemove }) : null;
  }
}

const groupStyle = {
  position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "8mm",
  alignSelf: "stretch",
};
const blankStyle = { background: "rgba(255, 255, 255, 0.55)", border: "1.5px dashed rgba(66, 133, 244, 0.3)", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" };
const placeStyle = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6mm",
  background: "rgba(255, 255, 255, 0.55)", border: "1.5px dashed rgba(66, 133, 244, 0.5)", boxSizing: "border-box",
};
const hintStyle = { fontFamily: "Georgia, serif", fontSize: "18pt", color: "rgba(66, 133, 244, 0.45)" };

// A kind with no editor of its own, only a frame - a picture - among pages
// of their own: a page it fills, edge to edge, what its kind offers (choosing
// the picture) on it, at its foot.
export function picturePage({ key, type, model, format, onRemove }) {
  const kind = type.frame;
  return div(
    { key, style: { ...paperStyle(format), boxShadow: paperShadow } },
    div({ style: { position: "absolute", inset: 0 } }, kind.view(model)),
    kind.controls
      ? div({ style: { position: "absolute", left: 0, right: 0, bottom: "6mm", display: "flex", justifyContent: "center" } },
        card({ style: { display: "flex", gap: "6px", alignItems: "center", padding: "6px 10px" } }, kind.controls(model)))
      : null,
    onRemove ? removeButton(onRemove, { left: "8mm", top: "8mm" }) : null,
  );
}
