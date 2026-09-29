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
    return button(text(this.label + ": " + this.count), callback("increment", () => { this.count++; }));
  }
}

// Two tabs, and the tab bar to switch between them.
class Tabs extends Component {
  initializeState() {
    return { tab: "first" };
  }

  tabBar() {
    const tab = (key, label) => button(
      { variant: this.tab === key ? "filled" : undefined },
      text(label),
      callback(key + "Tab", () => { this.tab = key; }),
    );
    return row({ style: { gap: "8px" } }, tab("first", "First"), tab("second", "Second"));
  }
}

// Don't: the tab not shown isn't built at all - its key drops out of the
// build, and it's gone for good. Switch back, and it starts over from 0.
export class Guarded extends Tabs {
  build() {
    return column(
      { style: { gap: "12px" } },
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
      { style: { gap: "12px" } },
      this.tabBar(),
      new Tally({ key: "first", label: "First" }).show(this.tab === "first"),
      new Tally({ key: "second", label: "Second" }).show(this.tab === "second"),
    );
  }
}

// 2. Full control: created once, in initialization - and established
// there, and disposed when this is, since no build() does either for them
// (see Component.establish()). Kept as unobservables - nothing needs to observe the references, so
// an observable property for them would only be overhead.
export class Owned extends Tabs {
  initialUnobservables() {
    return {
      first: new Tally({ key: "first", label: "First" }).establish(),
      second: new Tally({ key: "second", label: "Second" }).establish(),
    };
  }

  onDispose() {
    this.unobservable.first.dispose();
    this.unobservable.second.dispose();
    super.onDispose();
  }

  build() {
    return column(
      { style: { gap: "12px" } },
      this.tabBar(),
      this.tab === "first" ? this.unobservable.first : this.unobservable.second,
    );
  }
}

// All three, side by side: count up, switch tab, and switch back.
export class KeepAlive extends Component {
  build() {
    const variant = (title, child) => card(
      { style: { display: "flex", flexDirection: "column", gap: "12px", flex: "1 1 180px", boxSizing: "border-box" } },
      div({ style: { fontWeight: "bold" } }, text(title)),
      child,
    );
    return row(
      { style: { gap: "16px", flexWrap: "wrap", alignItems: "stretch" } },
      variant("if - forgets", new Guarded()),
      variant("1. .show() - remembers", new Shown()),
      variant("2. Owned - remembers", new Owned()),
    );
  }
}
