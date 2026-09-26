import { Component, frozen, callback } from "@liquefy/cascade.component";
import { button as htmlButton, input as htmlInput, label as htmlLabel, span, div, text } from "@liquefy/cascade.dom";
import { row, column, filler, wrapper } from "./Layout.js";
import { icon, iconButton, alertSeverities } from "./widgets.js";

/**
 * The basic theme - plain HTML, lightly styled (ported from
 * flow.ui/basic's own buttons.js, card.js, alert.js, listItem.js and
 * dialogue.js). A service locator (see cascade.component's
 * ServiceLocator.js) answering `{ type: "widget", name }` queries for the
 * widgets in widgets.js (see there for each one's property contract),
 * built out of ordinary HTML elements - which are themselves looked up the
 * same way, so a DOM-level locator further along still decides what an
 * HTML `button` actually is. Widgets used inside other widgets (the icon
 * in an alert, ...) are asked for the same way too, so they come from
 * whatever theme is in the context.
 */

const shadow = "0px 2px 1px -1px rgba(0, 0, 0, 0.2), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px 0px rgba(0, 0, 0, 0.12)";
const dialogShadow = "0 8px 24px rgba(0, 0, 0, 0.3)";

const cardStyles = {
  elevated: { background: "white", boxShadow: shadow },
  filled: { background: "#e8ecef" },
  outlined: { background: "white", border: "1px solid rgba(0, 0, 0, 0.2)" },
};

const onClickOf = (onClick) => (onClick ? { onclick: onClick } : {});

// A round button with just an icon in it. Its color is inherited, so it
// fits on a dark bar as well as a light page.
class BasicIconButton extends Component {
  setProperties({ icon, onClick, style, children, ...rest }) {
    this.icon = icon;
    this.onClick = onClick || null;
    this.style = frozen(style || null);
    this.rest = frozen(rest);
  }

  build() {
    return htmlButton(
      {
        ...this.rest,
        key: "button",
        ...onClickOf(this.onClick),
        style: {
          width: "40px", height: "40px", padding: 0, border: "none", borderRadius: "50%", flex: "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "transparent", color: "inherit", cursor: "pointer", ...this.style,
        },
      },
      icon({ key: "icon", name: this.icon }),
    );
  }
}

class BasicAlert extends Component {
  setProperties({ severity, style, children }) {
    this.severity = alertSeverities[severity] ? severity : "info";
    this.style = frozen(style || null);
    this.alertChildren = frozen(children || []);
  }

  build() {
    const severity = alertSeverities[this.severity];
    return row(
      {
        key: "alert",
        style: {
          gap: "12px", padding: "12px 16px", borderRadius: "4px", alignItems: "center", boxSizing: "border-box",
          background: severity.background, color: severity.color, ...this.style,
        },
      },
      icon({ key: "icon", name: severity.icon, style: { fontSize: "32px", color: severity.iconColor, flex: "none" } }),
      wrapper({ key: "message", style: { flex: "1 1 auto", minWidth: 0 } }, this.alertChildren),
    );
  }
}

class BasicDialog extends Component {
  setProperties({ title, close, fullScreen, style, children }) {
    this.title = title || "";
    this.close = close || null;
    this.fullScreen = !!fullScreen;
    this.style = frozen(style || null);
    this.dialogChildren = frozen(children || []);
  }

  build() {
    const close = callback("close", () => this.close && this.close());
    const frame = this.fullScreen
      ? { width: "100%", height: "100%" }
      : { borderRadius: "8px", boxShadow: dialogShadow };
    return column(
      {
        key: "dialog",
        style: { background: "white", boxSizing: "border-box", overflow: "hidden", pointerEvents: "auto", ...frame, ...this.style },
      },
      row(
        {
          key: "titleBar",
          style: {
            padding: this.fullScreen ? "4px 16px 4px 4px" : "4px 4px 4px 16px",
            ...(this.fullScreen ? { minHeight: "48px" } : {}),
            background: "#2c3e50", color: "white", flex: "none", alignItems: "center", gap: "8px",
          },
        },
        iconButton({ key: "back", icon: "arrow_back", title: "Back", onClick: close }).show(this.fullScreen),
        // text(): a lone string starting lowercase (a file name, say)
        // would be taken for an implicit key.
        filler({ key: "title" }, text({ key: "titleText", text: this.title })),
        iconButton({ key: "close", icon: "close", title: "Close", onClick: close }).show(!this.fullScreen),
      ),
      // Sized by its content, scrolling once the dialog has a height of its own.
      column({ key: "body", style: { flex: "1 1 auto", minHeight: 0, overflow: "auto" } }, this.dialogChildren),
    );
  }
}

const errorColor = "#c0392b";

// A label above an input (and its unit, if any), and the error under it,
// if there is one.
class BasicTextField extends Component {
  setProperties({ label, value, onInput, type, unit, error, style }) {
    this.label = label || "";
    this.value = value === undefined || value === null ? "" : value;
    this.onInput = onInput || null;
    this.type = type || "text";
    this.unit = unit || null;
    this.error = error || null;
    this.style = frozen(style || null);
  }

  build() {
    return htmlLabel(
      { key: "field", style: { display: "flex", flexDirection: "column", gap: "4px", ...this.style } },
      span({ key: "label", style: { fontSize: "13px", opacity: 0.8 } }, text({ key: "labelText", text: this.label })),
      row(
        { key: "inputRow", style: { alignItems: "center", gap: "6px" } },
        htmlInput({
          key: "input",
          type: this.type,
          value: this.value,
          oninput: callback("input", (event) => this.onInput && this.onInput(event.target.value)),
          style: {
            boxSizing: "border-box", height: "32px", padding: "0 8px", font: "inherit", minWidth: 0,
            border: "1px solid " + (this.error ? errorColor : "#b2bec3"), borderRadius: "4px",
            background: this.error ? "#fdf0ef" : "white",
            ...(this.type === "number" ? { width: "80px" } : { flex: "1 1 auto" }),
          },
        }),
        this.unit ? span({ key: "unit" }, text({ key: "unitText", text: this.unit })) : null,
      ),
      div({ key: "error", style: { fontSize: "12px", color: errorColor } }, text({ key: "errorText", text: this.error || "" })).show(!!this.error),
    );
  }
}

class BasicCheckbox extends Component {
  setProperties({ label, checked, onChange, style }) {
    this.label = label || "";
    this.checked = !!checked;
    this.onChange = onChange || null;
    this.style = frozen(style || null);
  }

  build() {
    return htmlLabel(
      { key: "field", style: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none", ...this.style } },
      htmlInput({
        key: "input",
        type: "checkbox",
        checked: this.checked,
        onchange: callback("change", (event) => this.onChange && this.onChange(event.target.checked)),
        style: { width: "18px", height: "18px", margin: 0 },
      }),
      text({ key: "labelText", text: this.label }),
    );
  }
}

const widgets = {
  button({ onClick, style, children, ...rest }) {
    return htmlButton({
      ...rest,
      ...onClickOf(onClick),
      style: { lineHeight: "28px", padding: "0 14px", cursor: "pointer", ...style },
      children,
    });
  },

  // Google's Material Symbols font: the icon's name, drawn as a ligature.
  // A function, not a component - so the key of its text is derived from
  // its own: a fixed one would collide between icons built by one build.
  // lineHeight as a string: a number would be taken for pixels.
  icon({ key, name, style, ...rest }) {
    return span(
      {
        ...rest,
        key,
        class: "material-symbols-outlined",
        style: { fontSize: "24px", lineHeight: "1", userSelect: "none", ...style },
      },
      text({ key: key ? key + "Name" : undefined, text: name || "" }),
    );
  },

  iconButton: (properties) => new BasicIconButton(properties),

  card({ variant, style, children, ...rest }) {
    return wrapper({
      ...rest,
      style: { padding: "12px", borderRadius: "4px", boxSizing: "border-box", ...(cardStyles[variant] || cardStyles.elevated), ...style },
      children,
    });
  },

  alert: (properties) => new BasicAlert(properties),

  listItem({ active, onClick, style, children, ...rest }) {
    return wrapper({
      ...rest,
      ...onClickOf(onClick),
      style: {
        padding: "8px 12px", borderRadius: "4px", cursor: "pointer", userSelect: "none",
        background: active ? "rgba(0, 0, 0, 0.12)" : "transparent", fontWeight: active ? "bold" : "normal", ...style,
      },
      children,
    });
  },

  dialog: (properties) => new BasicDialog(properties),

  textField: (properties) => new BasicTextField(properties),

  checkbox: (properties) => new BasicCheckbox(properties),
};

export class BasicThemeServiceLocator {
  locate(query) {
    if (query.type !== "widget") return undefined;
    const build = widgets[query.name];
    return build ? build(query.properties) : undefined;
  }
}

export const basicTheme = new BasicThemeServiceLocator();
