import { Component, frozen, callback } from "@liquefy/cascade.component";
import { span, text } from "@liquefy/cascade.dom";
import { button, icon, card, listItem } from "./widgets.js";
import { popover } from "./Popover.js";

/**
 * Dropdown - one choice out of several, compactly: a button showing the
 * choice made, opening a list of them all below it (a popover - see
 * Popover.js). Made of the theme's own widgets - button, card, list
 * items - so it looks like the rest of whatever theme it's in.
 *
 *   dropdown({
 *     options: [{ value: "Title", label: "Title", style: { fontWeight: 700 } }, ...],
 *     value: "Title",
 *     onSelect: (value) => ...,
 *   })
 *
 *  - options: `{ value, label, style }` - `style`, if given, is the label's
 *    own in the list: a preview of what choosing it means (a font, say).
 *  - value: the option chosen - none shows `placeholder`.
 *  - onSelect(value): called with the option clicked; the list closes.
 *  - disabled, title, placeholder, style (the button's).
 */
export function dropdown(...parameters) {
  return new Dropdown(...parameters);
}

export class Dropdown extends Component {
  setProperties({ options, value, onSelect, disabled, title, placeholder, style }) {
    this.options = frozen(options || []);
    this.value = value;
    this.onSelect = onSelect || null;
    this.disabled = !!disabled;
    this.title = title || undefined;
    this.placeholder = placeholder || "";
    this.style = frozen(style || null);
  }

  initialState() {
    return { open: false, anchor: null };
  }

  choose(value) {
    this.open = false;
    if (this.onSelect) this.onSelect(value);
  }

  build() {
    // Disabled while open: closed, for good - not hidden only to pop open on
    // its own again once it's enabled.
    if (this.disabled && this.open) this.setState({ open: false });
    const chosen = this.options.find((option) => option.value === this.value);
    return [
      button(
        {
          disabled: this.disabled,
          title: this.title,
          style: { justifyContent: "space-between", gap: "4px", paddingRight: "6px", ...this.style },
          onClick: callback("toggle", (event) => {
            // The button itself - the list follows it, should it move.
            this.anchor = event.currentTarget;
            this.open = !this.open;
          }),
        },
        text(chosen ? chosen.label : this.placeholder),
        icon({ name: "arrow_drop_down" }),
      ),
      popover(
        { anchor: this.anchor, showing: this.open, close: callback("close", () => { this.open = false; }) },
        card(
          { style: { padding: "4px", display: "flex", flexDirection: "column", gap: "2px", minWidth: "160px", maxHeight: "60vh", overflowY: "auto", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)" } },
          this.options.map((option) => listItem(
            {
              key: "option" + option.value,
              active: option.value === this.value,
              onClick: callback("choose" + option.value, () => this.choose(option.value)),
            },
            span({ style: option.style || {} }, text(option.label)),
          )),
        ),
      ),
    ];
  }
}
