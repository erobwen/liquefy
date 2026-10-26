import { Component, observable, accessInitialValues, withoutRecording } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { card } from "@liquefy/cascade.ui";
import { infoButton } from "../InfoButton.js";

/**
 * Context menus - Tabula has no menus of its own for what's in a document,
 * only for the file (new, open, save, print: see TabulaApp.js). Everything
 * else comes from whatever has the focus, as context menus, placed where
 * the layout has room for them (see layouts.js).
 *
 * What has the focus says what it's in, as a path of menus - from the root
 * of what it is (a structured text as a whole - never the sequence of
 * documents around it) down to the focused leaf (the paragraph the caret
 * is in, say), one entry for each step:
 *
 *   contextPath() -> [{ key, icon, title, details, build }, ...]
 *
 * `build()` makes the menu's content - components, built by the slot
 * showing it, so they follow whatever they read. `details()`, optional:
 * what's good to know but needn't take room, behind an info button.
 *
 * The layouts have two slots, for now (contextMenuSlot()): the root's menu
 * - "root", the path's first entry - and the focused leaf's - "focus", its
 * last (none, if the root is all there is). What's between them is in the
 * path already, for when the whole of it is shown, an accordion from the
 * root down.
 *
 * The focus is taken by whatever gets it (`focus(owner)`, an object with
 * `contextPath()` - an editor, typically, when its caret is placed), and
 * kept until something else takes it, or its owner lets it go
 * (`release(owner)` - when it's gone). Provided by the app, as
 * `contextMenus` (see cascade.component's provide()/inherit()).
 */
export class ContextMenus {
  constructor() {
    this.owner = null;
    return observable(this);
  }

  // Written at the baseline, wherever it's called from - an event handler,
  // or an owner disposed by a rebuild (see releaseFocus()). Written from
  // inside a repeater, it would be that repeater's writing, at its place in
  // the tree: everything after it would go on reading it, whatever an event
  // handler wrote later - a layout showing no menus after the mode changed,
  // its editor disposed and another one focused.
  focus(owner) {
    if (withoutRecording(() => this.owner) !== owner) accessInitialValues(() => { this.owner = owner; });
  }

  release(owner) {
    if (withoutRecording(() => this.owner) === owner) accessInitialValues(() => { this.owner = null; });
  }

  path() {
    return this.owner ? this.owner.contextPath() : [];
  }
}

// The menu at one end of the focused path, as a card: its title - and
// details behind an info button - and its content. Nothing, with no menu
// there.
//
//   contextMenuSlot({ menus, which: "root" | "focus", style })
export class ContextMenuSlot extends Component {
  setProperties({ menus, which, style }) {
    this.menus = menus;
    this.which = which;
    this.style = style || {};
  }

  entry() {
    const path = this.menus.path();
    if (this.which === "root") return path[0] || null;
    return path.length > 1 ? path[path.length - 1] : null;
  }

  build() {
    const entry = this.entry();
    if (!entry) return div({ style: { display: "none" } });
    return card(
      { style: { ...slotStyle, ...this.style } },
      div(
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        span({ class: "material-symbols-outlined", style: { fontSize: "18px", color: "#5f6368" } }, text(entry.icon || "tune")),
        div({ style: { flex: "1", fontWeight: "bold", fontSize: "15px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, text(entry.title)),
        entry.details ? infoButton({ key: "details", title: "About it", details: entry.details() }) : null,
      ),
      entry.build(),
    );
  }
}

export const contextMenuSlot = (...parameters) => new ContextMenuSlot(...parameters);

// What a menu is made of - for the menus' own builds.
export const menuHeading = (label) => div({ style: { fontWeight: "bold", fontSize: "13px", margin: "6px 0 0" } }, text(label));
export const menuNote = (words) => div({ style: { opacity: 0.7, fontSize: "12px" } }, text(words));

const slotStyle = {
  boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "6px",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)", pointerEvents: "auto",
};

// For a component taking the focus - its caret placed, a field of it
// focused: the context menus it's placed under (provided as
// `contextMenus`) now show its path. Remembered, for releaseFocus().
export function takeFocus(component) {
  const menus = component.inherit("contextMenus");
  if (!menus) return;
  component.unobservable.contextMenus = menus;
  menus.focus(component);
}

// For a component that's gone (its onDispose()): its menus no longer shown.
export function releaseFocus(component) {
  const menus = component.unobservable.contextMenus;
  if (menus) menus.release(component);
}
