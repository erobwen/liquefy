import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { card } from "@liquefy/cascade.ui";
import { paperStyle, paperShadow } from "../print/dom.js";
import { creationDot } from "./CreationDot.js";
import { removeButton } from "./removeButton.js";
import { clamp, clampLeft } from "./clamp.js";
import { paperGap, dotLineStyle } from "./spacing.js";

/**
 * Pages of their own, between a document's papers - an inner sequence (see
 * ../model/sequences.js), as the papers show it (see
 * ../paper/TabulaPaperView.js): a clamp along their left, saying they go
 * together (see clamp.js - its depth one more than the document's around
 * it), and in it each of its items, one under the other - each as
 * the app shows a document of its kind (`documentViews`, provided by the
 * app - see TabulaApp.js), a remove button on it. A
 * place for one, nothing chosen yet: a page drawn dashed, what it usually is
 * faintly in it (`hint`), and a creation dot - what it's to be. Before
 * them, an angle pointing up, for something first; between two, a diamond;
 * after them, an angle pointing down - each on its clamp, where the gap
 * there is (see spacing.js): its papers one gap from each other, and from
 * the papers around them - its dots its own, apart from those of what it's
 * in, at its edges. Empty: a page break - a diamond in a clamp, a gap
 * tall, for what's to come between; its last item taken out, that again.
 *
 * Its dots are places for the caret of the editor it's in (see
 * ../model/sequences.js's dotPosition()): the one the caret is at
 * (`caret`, its index - or null) outlined, its menu open with `menu` ({
 * highlighted }, the item the keyboard is at). A dot clicked: the caret to
 * it, its menu open (`onDot(index)`); the menu closed by a click outside
 * it, `onCloseMenu()`.
 *
 *   insertView({ sequence, items, format, before, pad, hint, caret, menu, onDot, onCloseMenu })
 *
 * `items`: as the layout of the document they're in laid them out (see
 * ../layout/DocumentLayout.js's InsertLayout) - each { item, pages }: what's
 * in it, and the paper sequence it's laid out on, there, handed to what
 * shows it (`paperSequence` - see documents.js). `format`: the paper of the
 * page they follow (or, `before` a document's title, come before) - a
 * place's. `pad`: a blank back after them, for the page after them to be a
 * right-hand one.
 * Its creation dots the size of the app's own, whatever the papers around
 * it are drawn at (`paperZoom`, inherited - see StructuredTextEditor.js).
 */
export class InsertView extends Component {
  setProperties({ sequence, items = [], format, before = false, pad = false, hint = "", caret = null, menu = null, onDot, onCloseMenu }) {
    this.caret = caret;
    this.menu = frozen(menu);
    this.onDot = onDot || null;
    this.onCloseMenu = onCloseMenu || null;
    this.sequence = sequence;
    this.items = items;
    this.format = frozen(format);
    this.before = !!before;
    this.pad = !!pad;
    this.hint = hint;
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
    const remove = (index) => { items.splice(index, 1); };
    // Something more, made at `index` - with a creation dot there.
    const insert = (index, type) => { items.splice(index, 0, views.create(type)); };
    const dot = (key, index, shape, title) => div(
      { key, style: dotLineStyle },
      div(
        { style: { ...onClampStyle, left: clampLeft({ depth, paperWidth: format.width }) } },
        div({ style: { zoom: 1 / zoom } }, creationDot({
          documentTypes: types, shape, title,
          onCreate: callback(key, (type) => insert(index, type)),
          // The caret's: at it, its menu open as the editor says.
          ...(this.onDot ? {
            focused: this.caret === index,
            open: this.caret === index && !!this.menu,
            highlighted: this.caret === index && this.menu ? this.menu.highlighted : null,
            onPress: callback(key + "press", () => this.onDot(index)),
            onClose: callback(key + "close", () => { if (this.onCloseMenu) this.onCloseMenu(); }),
          } : {}),
        })),
      ),
    );
    const count = this.items.length;
    const zoom = this.inherit("paperZoom") || 1;
    // Empty: a page break - a diamond, a gap's room around it.
    if (count === 0) {
      return div(
        { "data-insert": "", style: groupStyle },
        clamp({ depth, paperWidth: format.width }),
        div({ key: "break", style: breakStyle }, dot("only", 0, "diamond", "Create something here - a page break, so far")),
      );
    }
    return div(
      { "data-insert": "", style: groupStyle },
      clamp({ depth, paperWidth: format.width }),
      dot("first", 0, "up", "Create something before them"),
      this.items.map(({ item, pages }, index) => {
        const key = item ? "item-" + views.keyOf(item) + "-" + pages.causality.id : "place" + index;
        // Between it and the one before: a diamond, for something in between.
        return [
          index === 0 ? null : dot("between" + key, index, "diamond", "Create something in between"),
          this.item(item, pages, index, key, views, remove),
        ];
      }),
      // Its back left blank: the page after it a right-hand one.
      this.pad ? div({ key: "blank", style: { ...paperStyle(format), ...blankStyle, ...spaced } }, div({ style: { ...hintStyle, fontSize: "11pt" } }, text("Left blank"))) : null,
      dot("last", count, "down", "Create something after them"),
    );
  }

  // One of its items: a place, nothing chosen yet - or what's chosen, as
  // the app shows it, on the papers it's laid out on.
  item(item, pages, index, key, views, remove) {
    const { sequence, format } = this;
    if (item === null) {
      return div(
        { key, style: { ...paperStyle(format), ...placeStyle, ...spaced } },
        div({ style: hintStyle }, text(this.hint)),
        creationDot({ documentTypes: views.types(), title: "What's to be here", onCreate: callback("create" + index, (type) => { sequence.items[index] = views.create(type); }) }),
      );
    }
    return views.view(item, {
      key,
      format: pages.pages[0] || format,
      paperSequence: pages,
      onRemove: callback("remove" + key, () => remove(index)),
    });
  }
}

export const insertView = (...parameters) => new InsertView(...parameters);

// Over the gaps before and after it, half each (see spacing.js) - its own
// edges where the papers around it meet its own, and its dots there; what
// shows a document in it leaves half a gap around its papers itself, a
// page of its own here is given it.
const groupStyle = {
  position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
  alignSelf: "stretch", margin: `-${paperGap / 2}mm 0`,
};
// A point on the clamp's line - what's on it centred there.
const onClampStyle = {
  position: "absolute", top: 0, width: 0, height: 0,
  display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible",
};
// An empty one's room: a gap, the diamond in its middle.
const breakStyle = { height: paperGap + "mm", alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "center" };
const spaced = { margin: `${paperGap / 2}mm 0`, flex: "none" };
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
    { key, style: { ...paperStyle(format), boxShadow: paperShadow, ...spaced } },
    div({ style: { position: "absolute", inset: 0 } }, kind.view(model)),
    kind.controls
      ? div({ style: { position: "absolute", left: 0, right: 0, bottom: "6mm", display: "flex", justifyContent: "center" } },
        card({ style: { display: "flex", gap: "6px", alignItems: "center", padding: "6px 10px" } }, kind.controls(model)))
      : null,
    onRemove ? removeButton(onRemove, { left: "8mm", top: "8mm" }) : null,
  );
}
