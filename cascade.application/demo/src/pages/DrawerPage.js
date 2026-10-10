import { Component, callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, checkbox, controlPanel, tabBar, listItem, iconButton, drawer, drawers, drawerPanel, drawerBarSize, filler, themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { animationControls } from "../components/animationControls.js";
import { fullPage, accentColor } from "../components/layout.js";
import source from "./DrawerPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "Drawers, with cascade.ui's drawer() and drawers(): panels sliding in from the edges of what they're placed in.",
  points: [
    "One drawer: pick a side, and open it. Switch sides while it's open: it closes on one side, and opens on the other.",
    "Two drawers: filters on the left, and the details of an item - click one - on the right. Each opens and closes on its own.",
    "Modal: a dimmed backdrop behind them, fading in and out - a click on it closes every open one.",
    "Header: a title and a chevron that closes it. Without, the content is the whole panel, and closes it itself.",
    "Collapsed: what is left of a drawer while it's closed - nothing, a handle on its edge that opens it, or a bar, with a button that opens it, and shortcuts to what's in it. Opening a bar, it grows into the drawer: the shortcuts - the same components - fly to their places in it (beside each category, or under the item), and what's only in one or the other fades.",
    "A panel is always there - just past its edge when closed. Opening it is a move, which a FlipAnimationContainer animates: close it halfway through opening, and it turns round.",
  ],
};

const modeTabs = [{ key: "one", title: "One drawer" }, { key: "two", title: "Two drawers" }];

const sideTabs = ["left", "right", "top", "bottom"].map((side) => ({ key: side, title: side[0].toUpperCase() + side.slice(1) }));

const categories = ["Books", "Music", "Films", "Games", "Toys"];

// Each category's shortcut in the filters' bar.
const categoryIcons = { Books: "menu_book", Music: "music_note", Films: "movie", Games: "sports_esports", Toys: "toys" };

const collapsedTabs = [{ key: "nothing", title: "Nothing" }, { key: "handle", title: "Handle" }, { key: "bar", title: "Bar" }];

/**
 * Drawer - a test bed for cascade.ui's drawers: one drawer() over a stage,
 * or two - drawers(), filters on the left and an item's details on the
 * right - and controls for their options. Whether each is open, and all
 * their options, are the page's state; the drawers only show them, and
 * call back when the user opens or closes one.
 *
 * The stage is positioned (`position: relative`): that's what the drawers
 * cover, and slide over.
 */
export class DrawerPage extends Component {
  initialState() {
    return {
      mode: "one", open: false, side: "left", modal: true, header: true, collapsed: "nothing",
      detailsOpen: false, selected: null,
      chosen: ["Books", "Games"], picked: "Newest",
      animate: true, speed: 1,
    };
  }

  build() {
    const two = this.mode === "two";
    return fullPage(
      pageActions({ information, source, fileName: "src/pages/DrawerPage.js" }),
      animationControls({
        animate: this.animate,
        speed: this.speed,
        onAnimate: callback("animate", (animate) => { this.animate = animate; }),
        onSpeed: callback("speed", (speed) => { this.speed = speed; }),
      }),
      controlPanel(
        tabBar({ tabs: modeTabs, selected: this.mode, onSelect: callback("mode", (mode) => { this.mode = mode; }) }),
        tabBar({ key: "sides", tabs: sideTabs, selected: this.side, onSelect: callback("side", (side) => { this.side = side; }) }).showIf(!two),
        checkbox({ label: "Modal", checked: this.modal, onChange: callback("modal", (modal) => { this.modal = modal; }) }),
        checkbox({ label: "Header", checked: this.header, onChange: callback("header", (header) => { this.header = header; }) }),
        tabBar({ tabs: collapsedTabs, selected: this.collapsed, onSelect: callback("collapsed", (collapsed) => { this.collapsed = collapsed; }) }),
        filler(),
        button({ variant: "filled" }, this.open ? "Close filters" : "Open filters", callback("toggle", () => { this.open = !this.open; })),
        button({ key: "details", variant: "filled" }, this.detailsOpen ? "Close details" : "Open details", callback("toggleDetails", () => { this.detailsOpen = !this.detailsOpen; })).showIf(two),
      ),
      card(
        { style: { flex: "1 1 auto", minHeight: 0, position: "relative", overflow: "hidden", padding: 0 } },
        this.buildStage(),
        two ? this.buildTwo() : this.buildOne(),
      ),
    );
  }

  // One drawer, on the side picked.
  buildOne() {
    const close = callback("close", () => { this.open = false; });
    const vertical = this.side === "top" || this.side === "bottom";
    // The category icons: in the bar while it's collapsed to it, beside
    // their categories in the filters otherwise - the same ones, moving.
    const icons = this.buildFilterShortcuts();
    const inBar = this.inBar(this.open);
    return drawer(
      {
        key: "one",
        open: this.open,
        close,
        onOpen: callback("open", () => { this.open = true; }),
        side: this.side,
        size: vertical ? "45%" : 300,
        modal: this.modal,
        header: this.header,
        title: "Filters",
        collapsed: this.collapsed,
        bar: inBar ? icons : null,
        animate: this.animate,
        speed: this.speed,
      },
      this.header ? this.buildFilters(inBar ? null : icons) : this.buildOwnPanel(close),
    );
  }

  // Whether a drawer is its bar now: collapsed to one, and closed.
  inBar(open) {
    return this.collapsed === "bar" && !open;
  }

  // Two: the filters on the left, the details of the item clicked on the
  // right.
  buildTwo() {
    const close = callback("close", () => { this.open = false; });
    const closeDetails = callback("closeDetails", () => { this.detailsOpen = false; });
    // Each drawer's shortcuts: in its bar, or in its content - see buildOne().
    const icons = this.buildFilterShortcuts();
    const arrows = this.buildDetailShortcuts();
    const filtersInBar = this.inBar(this.open);
    const detailsInBar = this.inBar(this.detailsOpen);
    return drawers(
      { key: "two", modal: this.modal, animate: this.animate, speed: this.speed },
      drawerPanel(
        {
          side: "left", open: this.open, close, onOpen: callback("open", () => { this.open = true; }),
          size: 280, header: this.header, title: "Filters", collapsed: this.collapsed, bar: filtersInBar ? icons : null,
        },
        this.header ? this.buildFilters(filtersInBar ? null : icons) : this.buildOwnPanel(close),
      ),
      drawerPanel(
        {
          side: "right", open: this.detailsOpen, close: closeDetails, onOpen: callback("openDetails", () => { this.detailsOpen = true; }),
          size: 320, header: this.header, title: this.selected === null ? "Details" : "Item " + (this.selected + 1),
          collapsed: this.collapsed, bar: detailsInBar ? arrows : null,
        },
        this.buildDetails(closeDetails, detailsInBar ? null : arrows),
      ),
    );
  }

  // What the drawers slide over: something to see them go over, what the
  // filters in them pick - and, with two, items to see the details of.
  buildStage() {
    const two = this.mode === "two";
    // Room for the bars, where there are any: they cover the edge.
    const barSides = this.collapsed !== "bar" ? [] : two ? ["left", "right"] : [this.side];
    const room = (side, space) => (barSides.includes(side) ? space + drawerBarSize : space) + "px";
    return div(
      {
        style: {
          height: "100%", overflow: "auto", boxSizing: "border-box",
          padding: [room("top", 24), room("right", 48), room("bottom", 24), room("left", 48)].join(" "),
        },
      },
      div({ style: { marginBottom: "16px", color: themeColor.textSoft } },
        text("Showing " + (this.chosen.length > 0 ? this.chosen.join(", ") : "nothing") + " - " + this.picked.toLowerCase() + " first."
          + (two ? " Click an item for its details." : ""))),
      div(
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "16px" } },
        Array.from({ length: 24 }, (_, index) => div(
          {
            onclick: two ? callback("select" + index, () => { this.selected = index; this.detailsOpen = true; }) : null,
            style: {
              height: "90px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center",
              background: two && this.selected === index ? themeColor.accentSoft : themeColor.filled,
              color: themeColor.textSoft, cursor: two ? "pointer" : "default",
            },
          },
          text("Item " + (index + 1)),
        )),
      ),
    );
  }

  // With a header: the drawer's own panel - title, chevron - and this in it.
  chooseCategory(category, chosen) {
    this.chosen = chosen ? [...this.chosen, category] : this.chosen.filter((each) => each !== category);
  }

  // A shortcut per category - chosen or not, without opening the drawer:
  // in its bar, or beside the category in the filters.
  buildFilterShortcuts() {
    return categories.map((category) => {
      const chosen = this.chosen.includes(category);
      return iconButton({
        key: category + "Shortcut",
        icon: categoryIcons[category],
        title: category,
        onClick: callback("shortcut" + category, () => this.chooseCategory(category, !chosen)),
        style: chosen ? { color: themeColor.accent, background: themeColor.accentSoft } : {},
      });
    });
  }

  // The previous and the next item: in the details' bar, or under the item.
  buildDetailShortcuts() {
    const step = (by) => () => {
      this.selected = this.selected === null ? 0 : Math.min(23, Math.max(0, this.selected + by));
    };
    return [
      iconButton({ key: "previousItem", icon: "arrow_upward", title: "Previous item", onClick: callback("previousItem", step(-1)) }),
      iconButton({ key: "nextItem", icon: "arrow_downward", title: "Next item", onClick: callback("nextItem", step(1)) }),
    ];
  }

  // The filters - each category with its icon beside it, unless that's in
  // the bar (`icons` null).
  buildFilters(icons) {
    const toggleCategory = (category) => (checked) => this.chooseCategory(category, checked);
    return div(
      { style: { display: "flex", flexDirection: "column", gap: "4px", padding: "16px" } },
      div({ style: { fontWeight: "bold", marginBottom: "4px" } }, text("Categories")),
      categories.map((category, index) => div(
        { key: category + "Row", style: { display: "flex", alignItems: "center", gap: "8px", minHeight: "32px" } },
        icons ? icons[index] : null,
        checkbox({
          label: category,
          checked: this.chosen.includes(category),
          onChange: callback("category" + category, toggleCategory(category)),
        }),
      )),
      div({ style: { fontWeight: "bold", marginTop: "8px" } }, text("Sort by")),
      ["Newest", "Cheapest", "Most popular"].map((order) => listItem(
        { key: order, active: this.picked === order },
        text(order),
        callback("pick" + order, () => { this.picked = order; }),
      )),
    );
  }

  // Without a header: the content is the whole panel - one of its own,
  // closing the drawer itself.
  buildOwnPanel(close) {
    return div(
      { style: { display: "flex", flexDirection: "column", height: "100%" } },
      div(
        { style: { padding: "24px 20px", background: accentColor, color: "white" } },
        div({ style: { fontSize: "20px", fontWeight: "bold" } }, text("A panel of its own")),
        div({ style: { marginTop: "4px", opacity: 0.85 } }, text("No header - this content is the whole panel.")),
      ),
      div(
        { style: { flex: "1 1 auto", padding: "16px 20px" } },
        text("It closes the drawer itself, with the button below: it's given the same close callback the drawer is."),
      ),
      div(
        { style: { display: "flex", justifyContent: "flex-end", padding: "12px 16px", borderTop: "1px solid " + themeColor.border } },
        button({ variant: "filled" }, "Done", close),
      ),
    );
  }

  // The item clicked, the previous and next item's arrows under it (unless
  // they're in the bar: `arrows` null) - and, without a header, a close
  // button of its own.
  buildDetails(close, arrows) {
    const item = this.selected;
    return div(
      { style: { display: "flex", flexDirection: "column", gap: "12px", padding: "16px", height: "100%", boxSizing: "border-box" } },
      div({ key: "detailsTitle", style: { fontSize: "18px", fontWeight: "bold" } }, text(item === null ? "Details" : "Item " + (item + 1))).showIf(!this.header),
      div(
        { style: { height: "140px", borderRadius: "8px", background: themeColor.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", color: themeColor.textSoft } },
        text(item === null ? "Nothing chosen" : "Item " + (item + 1)),
      ),
      div({ key: "detailsArrows", style: { display: "flex", justifyContent: "center", gap: "8px" } }, arrows).showIf(!!arrows),
      div(text(item === null
        ? "Click an item on the stage: its details open here, while the filters stay as they are."
        : "One of " + categories.length + " categories, sorted " + this.picked.toLowerCase() + " first. Click another item: this panel follows.")),
      filler(),
      div({ key: "detailsDone", style: { display: "flex", justifyContent: "flex-end" } }, button("Done", close)).showIf(!this.header),
    );
  }
}
