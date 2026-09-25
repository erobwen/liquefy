import { Component, callback, flush } from "@liquefy/cascade.component";
import { p, text, input, select, option, span, elementBoundsProvider } from "@liquefy/cascade.dom";
import { button, iconButton, alert, card, popover, row, column, filler, fitContainerStyle, overflowVisibleStyle } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import source from "./ToolbarEllipsisPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A toolbar that adapts to the room it has - tools of any width:",
  points: [
    "Resize the window: the toolbar shows as many tools as fit, and an ellipsis button for the rest, which opens them in a popover.",
    "It renders, then measures the tools where they really are, and corrects itself within the same frame if they don't fit - or if more would.",
    "Each tool's width is remembered from where it was last drawn, so the toolbar knows whether the next one fits before placing it - and a tool that grows by itself (the size picker going from 9 to 10) makes it fit again.",
  ],
};

const GAP = 2;
const PADDING = 8;

/**
 * Toolbar Ellipsis - ported from flow.application/demo's
 * toolbarEllipsisDemo.js, same structure: the page makes the tools, and an
 * EllipsisToolbar at the bottom fits as many as its width allows, with an
 * ellipsis button opening the rest in a popover. The tools vary in width
 * here - icons, text buttons, a size picker, a select, a search field - and
 * can change width by themselves.
 *
 * The toolbar's width comes from cascade.dom's elementBoundsProvider(): the
 * toolbar is its direct child, and reads the measured width from its render
 * context. How many tools fit is up to the toolbar - see EllipsisToolbar.
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
        { key: "font", title: "Font", style: { flex: "none", height: "32px" }, onchange: callback("font", (event) => { this.lastTool = "font " + event.target.value; }) },
        ...["Sans", "Serif", "Monospace"].map((font) => option({ key: font, value: font }, text({ key: font + "Text", text: font }))),
      ),
      icon("key", 5), icon("bolt", 6),
      textButton("Underline"),
      input({ key: "search", type: "search", placeholder: "Find...", style: { flex: "none", width: "120px", height: "28px", boxSizing: "border-box" } }),
      icon("search", 7), icon("home", 8), textButton("Strikethrough"),
      icon("settings", 9), icon("star", 10), icon("key", 11), icon("bolt", 12),
    ];

    return column(
      { key: "page", style: { ...fitContainerStyle, ...overflowVisibleStyle, gap: "16px" } },
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
      elementBoundsProvider({
        key: "toolbarBounds",
        style: { flex: "none", width: "100%" },
        child: new EllipsisToolbar({ key: "toolbar", children: tools }),
      }),
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
 * Ellipsis Toolbar - as many of its tools as fit in its width (from the
 * DOMElementBoundsProvider it's the direct child of), and an ellipsis
 * button opening the rest in a popover. Its tools can be of any width, and
 * change width.
 *
 * It renders, then measures - cascade renders in real time, in tree order,
 * so right after this toolbar has rendered its tools, they are laid out in
 * the page:
 *  - Each tool's width is measured where it is (in the bar, or in the
 *    popover) and remembered - widths known before placing the next tool,
 *    without rendering anything twice.
 *  - From those, how many fit (\`shown\`, this toolbar's state) is worked
 *    out; if it isn't what was just rendered, it's corrected with
 *    setState() - and flush(), so the corrected rendering follows in the
 *    same frame, before anything is drawn.
 *  - A tool that changes width by itself, with nothing about the toolbar
 *    changing, is caught by a ResizeObserver on the tools, which does the
 *    same.
 * The first rendering shows all the tools - so every width is known from
 * the start. Settles in one correction: the next rendering measures the
 * same widths, and works out the same number.
 */
export class EllipsisToolbar extends Component {
  setProperties({ children }) {
    this.tools = children || [];
  }

  initializeState() {
    return { shown: this.tools.length, menuOpen: false, anchor: null };
  }

  initialUnobservables() {
    return { widths: new WeakMap(), observer: null, observed: new WeakSet() };
  }

  build() {
    const shown = Math.min(this.shown, this.tools.length);
    const barTools = this.tools.slice(0, shown);
    const menuTools = this.tools.slice(shown);
    const menuButton = iconButton({
      key: "menuButton",
      icon: "more_horiz",
      title: menuTools.length + " more tools",
      style: { flex: "none" },
      onClick: callback("openMenu", (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        this.anchor = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        this.menuOpen = true;
      }),
    });
    return card(
      {
        key: "toolbar",
        style: {
          display: "flex", flexDirection: "row", alignItems: "center", gap: GAP + "px",
          padding: PADDING + "px", boxSizing: "border-box", width: "100%", overflow: "hidden",
        },
      },
      ...barTools,
      menuTools.length > 0 ? menuButton : null,
      popover(
        {
          key: "extraToolbarMenu",
          anchor: this.anchor,
          showing: this.menuOpen && menuTools.length > 0,
          close: callback("closeMenu", () => { this.menuOpen = false; }),
        },
        card(
          {
            key: "extraMenu",
            // A click on a button in it closes it, too - not one on a field.
            onclick: callback("closeOnPick", (event) => {
              if (event.target.closest("button, mdui-button, mdui-button-icon")) this.menuOpen = false;
            }),
            style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: GAP + "px", maxWidth: "360px", padding: "4px" },
          },
          ...menuTools,
        ),
      ),
    );
  }

  render(context) {
    super.render(context);
    this.fit();
  }

  // Measure what can be measured, work out how many tools fit, and correct
  // the rendering if that isn't what it shows.
  fit() {
    const u = this.unobservable;
    // Read, to rerun when the window is resized (the bounds provider
    // measures) - but the room itself is measured on the bar as it now is,
    // to the fraction of a pixel.
    const width = this.renderContext && this.renderContext.width;
    const bar = elementOf(this);
    if (typeof(width) !== "number" || !bar || !bar.isConnected) return;
    const style = bar.ownerDocument.defaultView.getComputedStyle(bar);
    const available = bar.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    for (const tool of this.tools) {
      const element = elementOf(tool);
      if (!element) continue;
      this.observe(element);
      if (element.isConnected) u.widths.set(tool, element.getBoundingClientRect().width);
    }
    const menuButton = this.newBuild && this.newBuild.children ? this.newBuild.children.find((child) => child && child.key === "menuButton") : null;
    const menuElement = menuButton ? elementOf(menuButton) : null;
    if (menuElement && menuElement.isConnected) u.ellipsisWidth = menuElement.getBoundingClientRect().width;
    const shown = fitting(this.tools.map((tool) => u.widths.get(tool)), available, u.ellipsisWidth || 40);
    if (shown !== this.shown) flush(() => this.setState({ shown }));
  }

  // A tool changing width by itself: fit again. (Called by the observer,
  // outside any rendering - a plain event, like a click.)
  observe(element) {
    const u = this.unobservable;
    if (typeof(ResizeObserver) === "undefined" || u.observed.has(element)) return;
    if (!u.observer) u.observer = new ResizeObserver(() => this.fit());
    u.observer.observe(element);
    u.observed.add(element);
  }

  onDispose() {
    super.onDispose();
    if (this.unobservable.observer) this.unobservable.observer.disconnect();
  }
}

// How many of the tools, with these widths, fit in `available` - leaving
// room for the ellipsis button whenever any are left over. A width not
// known yet counts as not fitting.
function fitting(widths, available, ellipsisWidth) {
  let used = 0;
  for (let index = 0; index < widths.length; index++) {
    if (typeof(widths[index]) !== "number") return index;
    const next = used + (index > 0 ? GAP : 0) + widths[index];
    const isLast = index === widths.length - 1;
    if (next + (isLast ? 0 : GAP + ellipsisWidth) > available) return index;
    used = next;
  }
  return widths.length;
}

// The element a component ends up as - its own, or that of what it builds.
function elementOf(component) {
  let current = component;
  while (current) {
    if (current.unobservable && current.unobservable.element) return current.unobservable.element;
    current = Array.isArray(current.newBuild) ? current.newBuild[0] : current.newBuild;
  }
  return null;
}
