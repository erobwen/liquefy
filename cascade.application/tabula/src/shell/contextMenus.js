import { Component, observable, accessInitialValues, withoutRecording, callback } from "@liquefy/cascade.component";
import { div, span, text } from "@liquefy/cascade.dom";
import { icon } from "./appStyle.js";
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
 * `build()` makes the menu's content - components, built by the card
 * showing it, so they follow whatever they read. `details()`, optional:
 * what's good to know but needn't take room, behind an info button.
 *
 * The layouts show the whole path as an accordion (contextAccordion()): a
 * card for each entry, from the root down to the leaf, each collapsing to
 * its title's row - the sections on the way to the leaf collapsed, until
 * opened. An entry's `key` is what its being collapsed is remembered by.
 *
 * The focus is taken by whatever gets it (`focus(owner)`, an object with
 * `contextPath()` - an editor, typically, when its caret is placed), and
 * kept until something else takes it, or its owner lets it go
 * (`release(owner)` - when it's gone). Provided by the app, as
 * `contextMenus` (see cascade.component's provide()/inherit()).
 *
 * What's created - from the app's creation menu (see TabulaApp.js) - goes
 * to what has the focus, too: `insert(content)`, "insert this here", the
 * owner's `insert(content)` deciding what that makes where its caret is
 * (a frame in a structured text's text, see ../model/frames.js) - and
 * false if it takes none. `insertPlace()`: where what's created would go -
 * "text", "page" (a page layout, see ../model/pageLayout.js), as the owner
 * says (its `insertPlace()`) - null with nowhere: the creation menu offers
 * what can go there. And dragged from it instead - on a page, to where it's
 * dropped: `drag(content)` as the drag starts, `takeDragged()` where it
 * ends.
 */
export class ContextMenus {
  constructor() {
    // Which of the accordion's entries are collapsed, by key - those not
    // in it as by default (see collapsed()).
    this.collapsedEntries = {};
    this.owner = null;
    this.dragged = null;
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

  // Whether the accordion's entry of `key` is collapsed to its row: as it
  // was left - or, never touched, the sections on the way to the leaf
  // (their keys "around...") collapsed, the rest open.
  collapsed(key) {
    const entries = this.collapsedEntries;
    return key in entries ? entries[key] : key.startsWith("around");
  }

  toggle(key) {
    this.collapsedEntries = Object.freeze({ ...this.collapsedEntries, [key]: !this.collapsed(key) });
  }

  insertPlace() {
    const owner = this.owner;
    if (!owner || typeof(owner.insert) !== "function") return null;
    return typeof(owner.insertPlace) === "function" ? owner.insertPlace() : "text";
  }

  insert(content) {
    return !!this.insertPlace() && this.owner.insert(content);
  }

  // Not observed: nothing shows what's being dragged.
  drag(content) {
    withoutRecording(() => { this.dragged = content; });
  }

  takeDragged() {
    const content = withoutRecording(() => this.dragged);
    withoutRecording(() => { this.dragged = null; });
    return content || null;
  }
}

// The context accordion: a card for every entry of a path - the root's
// first, down to the focused leaf's - each with its title on a row of its
// own, and under it, unless it's collapsed to that row, its menu. A click
// on the row collapses it, or opens it again - remembered by the entry's
// key, in `menus` (see ContextMenus' collapsed()). `entries`: the path,
// whatever goes in front of it included (the app's view, say - see
// layouts.js).
//
//   contextAccordion({ menus, entries, flat })
//
// `flat`: cards with a border, no shadow - in a column of their own rather
// than floating over the papers.
export class ContextAccordion extends Component {
  setProperties({ menus, entries, flat = false }) {
    this.menus = menus;
    this.entries = entries || [];
    this.flat = !!flat;
  }

  build() {
    return this.entries.map((entry) => new AccordionCard({ key: "entry-" + entry.key, entry, menus: this.menus, flat: this.flat }));
  }
}

// One entry's card - a component of its own, so what its menu is built of
// is keyed in it alone, whatever the other entries' are.
class AccordionCard extends Component {
  setProperties({ entry, menus, flat }) {
    this.entry = entry;
    this.menus = menus;
    this.flat = flat;
  }

  build() {
    const { entry, menus } = this;
    const collapsed = menus.collapsed(entry.key);
    return card(
      { style: { ...cardStyle, ...(this.flat ? flatStyle : {}) } },
      div(
        {
          key: "row",
          title: collapsed ? "Open it" : "Collapse it",
          onclick: callback("toggle", () => menus.toggle(entry.key)),
          style: rowStyle,
        },
        icon(entry.icon || "tune", { color: "#5f6368" }),
        div({ style: titleStyle }, text(entry.title)),
        entry.details
          ? span({ onclick: (event) => event.stopPropagation(), style: { display: "flex" } }, infoButton({ key: "details", title: "About it", details: entry.details() }))
          : null,
        icon(collapsed ? "expand_more" : "expand_less", { color: "#5f6368" }),
      ),
      collapsed ? null : div({ key: "menu", style: menuStyle }, entry.build()),
    );
  }
}

export const contextAccordion = (...parameters) => new ContextAccordion(...parameters);

// What a menu is made of - for the menus' own builds.
export const menuHeading = (label) => div({ style: { fontWeight: "bold", fontSize: "13px", margin: "6px 0 0" } }, text(label));
export const menuNote = (words) => div({ style: { opacity: 0.7, fontSize: "12px" } }, text(words));

const cardStyle = {
  boxSizing: "border-box", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.16)", pointerEvents: "auto", flex: "none",
};
const flatStyle = { boxShadow: "none", border: "1px solid #dadce0" };
const rowStyle = {
  display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px 7px 12px", cursor: "pointer", userSelect: "none",
  background: "#f1f3f4", minHeight: "34px", boxSizing: "border-box",
};
const titleStyle = { flex: "1", fontWeight: 600, fontSize: "14px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const menuStyle = { display: "flex", flexDirection: "column", gap: "6px", padding: "8px 12px 12px" };

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
