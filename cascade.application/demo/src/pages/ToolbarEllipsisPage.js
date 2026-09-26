import { Component, callback, flush } from "@liquefy/cascade.component";
import { p, text, select, option, span, elementBoundsProvider, overflowContainer, elementSlot } from "@liquefy/cascade.dom";
import { button, iconButton, alert, card, textField, popover, row, filler, overflowVisibleStyle, themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { fullPage } from "../components/layout.js";
import source from "./ToolbarEllipsisPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A toolbar that adapts to the room it has - tools of any width, laid out for real:",
  points: [
    "Resize the window: the toolbar shows as many tools as fit, and an ellipsis button for the rest, which opens them in a popover.",
    "Nothing is measured anywhere but where it will be: the toolbar puts its tools in the bar one by one, and at the first one that doesn't fit, takes it out again - all before anything is drawn.",
    "That takes rendering in real time, which Flow couldn't: there, a copy of a tool had to be measured on its own - and in Cascade, a tool out of view isn't even a complete node.",
    "The size picker changes width by itself (9 to 10): the toolbar notices, and lays out again.",
  ],
};

const GAP = 2;

/**
 * Toolbar Ellipsis - ported from flow.application/demo's
 * toolbarEllipsisDemo.js, same structure: the page makes the tools, and an
 * EllipsisToolbar at the bottom fits as many as its width allows, with an
 * ellipsis button opening the rest in a popover. The tools vary in width
 * here - icons, text buttons, a size picker, a select, a search field - and
 * can change width by themselves.
 *
 * The toolbar's width comes from cascade.dom's elementBoundsProvider(), the
 * toolbar its direct child: resized, it renders again. (The card goes
 * around the bounds provider, not between it and the toolbar: an element
 * gives what it renders a render context of its own, without the measured
 * width.)
 */
export class ToolbarEllipsisPage extends Component {
  initializeState() {
    return { lastTool: null };
  }

  build() {
    const pushed = (name) => callback(name, () => { this.lastTool = name; });
    const icon = (name, number) => iconButton({ key: name + number, icon: name, title: name + " " + number, style: { flex: "none" }, onClick: pushed(name + " " + number) });
    const textButton = (name) => button({ key: name, style: { flex: "none" } }, text({ key: name + "Text", text: name }), pushed(name));
    const tools = [
      icon("search", 1), icon("home", 2),
      textButton("Bold"), textButton("Italic"),
      new SizePicker({ key: "size" }),
      icon("settings", 3), icon("star", 4),
      select(
        { key: "font", title: "Font", style: { flex: "none", height: "32px", padding: "0 6px", font: "inherit", color: "inherit", border: "1px solid " + themeColor.border, borderRadius: "6px", background: themeColor.surface }, onchange: callback("font", (event) => { this.lastTool = "font " + event.target.value; }) },
        ...["Sans", "Serif", "Monospace"].map((font) => option({ key: font, value: font }, text({ key: font + "Text", text: font }))),
      ),
      icon("key", 5), icon("bolt", 6),
      textButton("Underline"),
      textField({ key: "search", type: "search", placeholder: "Find...", style: { flex: "none", width: "140px" } }),
      icon("search", 7), icon("home", 8), textButton("Strikethrough"),
      icon("settings", 9), icon("star", 10), icon("key", 11), icon("bolt", 12),
    ];

    return fullPage(
      { key: "page", style: overflowVisibleStyle },
      pageActions({ information, source, fileName: "src/pages/ToolbarEllipsisPage.js" }),
      alert(
        { key: "info", style: { flex: "none" } },
        p({ key: "first", style: { margin: 0 } }, text({
          key: "firstText",
          text: "Demonstrates the power of programmatic responsiveness: a toolbar that adapts to the available space, " +
            "showing an ellipsis menu when there isn't room for all its tools - whatever their widths.",
        })),
        p({ key: "second", style: { margin: "8px 0 0 0" } }, text({
          key: "secondText",
          text: "This is not something you would typically do with CSS, container queries and breakpoints - " +
            "ask for it to be designed, and you'll be given a JavaScript solution.",
        })),
      ),
      text({ key: "lastTool", text: this.lastTool ? "Last pushed: " + this.lastTool : "Push a tool." }),
      filler({ key: "space" }),
      card(
        { key: "toolbarCard", style: { flex: "none", padding: "8px" } },
        elementBoundsProvider({
          key: "toolbarBounds",
          style: { width: "100%" },
          child: new EllipsisToolbar({ key: "toolbar", children: tools }),
        }),
      ),
    );
  }
}

// A tool whose width changes by itself: from 9 to 10 is a digit wider.
class SizePicker extends Component {
  initializeState() {
    return { size: 9 };
  }

  build() {
    return row(
      { key: "picker", title: "Size", style: { flex: "none", alignItems: "center", gap: "2px" } },
      iconButton({ key: "smaller", icon: "remove", title: "Smaller", onClick: callback("smaller", () => { this.size = Math.max(1, this.size - 1); }) }),
      span({ key: "value", style: { minWidth: "1ch", textAlign: "center", fontVariantNumeric: "tabular-nums" } }, text({ key: "valueText", text: String(this.size) })),
      iconButton({ key: "larger", icon: "add", title: "Larger", onClick: callback("larger", () => { this.size = this.size + 1; }) }),
    );
  }
}

/**
 * Ellipsis Toolbar - as many of its tools as fit, and an ellipsis button
 * opening the rest in a popover. It leaves the layout to cascade.dom's
 * OverflowContainer, which places the tools itself, one by one, measuring
 * each where it really is, and puts those that don't fit into the overflow
 * slot - an element slot this toolbar owns (created in initialization) and
 * shows in its popover. All the toolbar keeps is how many overflowed, for
 * the ellipsis button to say.
 */
export class EllipsisToolbar extends Component {
  setProperties({ children }) {
    this.tools = children || [];
  }

  initializeState() {
    return { overflowCount: 0, menuOpen: false, anchor: null };
  }

  initialUnobservables() {
    return {
      overflowSlot: elementSlot({ key: "overflowSlot", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: GAP + "px" } }),
    };
  }

  build() {
    const ellipsis = iconButton({
      key: "menuButton",
      icon: "more_horiz",
      title: this.overflowCount + " more tools",
      style: { flex: "none" },
      onClick: callback("openMenu", (event) => {
        // The button itself - the popover follows it, should it move.
        this.anchor = event.currentTarget;
        this.menuOpen = true;
      }),
    });
    return [
      overflowContainer({
        key: "bar",
        style: { display: "flex", flexDirection: "row", alignItems: "center", gap: GAP + "px", width: "100%", overflow: "hidden" },
        children: this.tools,
        ellipsis,
        overflowSlot: this.unobservable.overflowSlot,
        // Reported from the bar's own rendering - a write back to this
        // toolbar, which built it: setState() and flush(), so the ellipsis
        // says the right number in the same frame.
        onOverflow: callback("overflow", (count) => { flush(() => this.setState({ overflowCount: count })); }),
      }),
      popover(
        {
          key: "extraToolbarMenu",
          anchor: this.anchor,
          showing: this.menuOpen && this.overflowCount > 0,
          close: callback("closeMenu", () => { this.menuOpen = false; }),
        },
        card(
          {
            key: "extraMenu",
            // A click on a button in it closes it, too - not one on a field.
            onclick: callback("closeOnPick", (event) => {
              if (event.target.closest("button, mdui-button, mdui-button-icon")) this.menuOpen = false;
            }),
            style: { maxWidth: "360px", padding: "4px" },
          },
          this.unobservable.overflowSlot,
        ),
      ),
    ];
  }
}
