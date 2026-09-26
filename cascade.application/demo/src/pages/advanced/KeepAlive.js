import { Component, callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, card, column, row } from "@liquefy/cascade.ui";

// A child with state of its own - to see whether it survives.
class Tally extends Component {
  setProperties({ label }) {
    this.label = label;
  }

  initializeState() {
    return { count: 0 };
  }

  build() {
    return button(
      { key: "tally" },
      text({ key: "tallyText", text: this.label + ": " + this.count }),
      callback("increment", () => { this.count++; }),
    );
  }
}

// Two tabs, and the tab bar to switch between them.
class Tabs extends Component {
  initializeState() {
    return { tab: "first" };
  }

  tabBar() {
    const tab = (key, label) => button(
      { key: key + "Tab", variant: this.tab === key ? "filled" : undefined },
      text({ key: key + "TabText", text: label }),
      callback(key + "Tab", () => { this.tab = key; }),
    );
    return row({ key: "tabBar", style: { gap: "8px" } }, tab("first", "First"), tab("second", "Second"));
  }
}

// Don't: the tab not shown isn't built at all - its key drops out of the
// build, and it's gone for good. Switch back, and it starts over from 0.
export class Guarded extends Tabs {
  build() {
    return column(
      { key: "guarded", style: { gap: "12px" } },
      this.tabBar(),
      this.tab === "first"
        ? new Tally({ key: "first", label: "First" })
        : new Tally({ key: "second", label: "Second" }),
    );
  }
}

// 1. Built in every build, with a key - and shown or not with .show().
export class Shown extends Tabs {
  build() {
    return column(
      { key: "shown", style: { gap: "12px" } },
      this.tabBar(),
      new Tally({ key: "first", label: "First" }).show(this.tab === "first"),
      new Tally({ key: "second", label: "Second" }).show(this.tab === "second"),
    );
  }
}

// 2. Full control: created once, in initialization, and disposed when this
// is. Kept as unobservables - nothing needs to observe the references, so
// an observable property for them would only be overhead.
export class Owned extends Tabs {
  initialUnobservables() {
    return {
      first: new Tally({ key: "first", label: "First" }),
      second: new Tally({ key: "second", label: "Second" }),
    };
  }

  onDispose() {
    this.unobservable.first.onDispose();
    this.unobservable.second.onDispose();
    super.onDispose();
  }

  build() {
    return column(
      { key: "owned", style: { gap: "12px" } },
      this.tabBar(),
      this.tab === "first" ? this.unobservable.first : this.unobservable.second,
    );
  }
}

// All three, side by side: count up, switch tab, and switch back.
export class KeepAlive extends Component {
  build() {
    const variant = (key, title, child) => card(
      { key, style: { display: "flex", flexDirection: "column", gap: "12px", flex: "1 1 180px", boxSizing: "border-box" } },
      div({ key: key + "Title", style: { fontWeight: "bold" } }, text({ key: key + "TitleText", text: title })),
      child,
    );
    return row(
      { key: "keepAlive", style: { gap: "16px", flexWrap: "wrap", alignItems: "stretch" } },
      variant("guardedVariant", "if - forgets", new Guarded({ key: "guarded" })),
      variant("shownVariant", "1. .show() - remembers", new Shown({ key: "shown" })),
      variant("ownedVariant", "2. Owned - remembers", new Owned({ key: "owned" })),
    );
  }
}
