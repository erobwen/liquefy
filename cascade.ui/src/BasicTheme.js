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
 *
 * The look: the blue tones of the Cascade app's own navy and slate, soft
 * corners - square, just rounded a little (6px on controls, 8px on
 * surfaces; the Material theme's are pill shaped) - and one discreet
 * shadow for whatever lies on the page. Buttons are white chips on it.
 *
 * What changes on hover, focus or press can't be written as inline style,
 * so those widgets get their look from a small stylesheet of the theme's
 * own, added to the document the first time one is made (see
 * ensureStyleSheet()) - and inline style is left for what the caller gives.
 */

// The palette - exported for whoever builds something of their own in the
// same look (a widget no theme provides, say).
export const basicColors = {
  navy: "#2c3e50",
  slate: "#34495e",
  text: "#2c3e50",
  page: "#eaf0f6",
  surface: "#ffffff",
  filled: "#e1e9f2",
  border: "#cdd7e2",
  accent: "#2e86c1",
  error: "#c0392b",
};
export const basicShadow = "0 1px 2px rgba(44, 62, 80, 0.10), 0 2px 6px rgba(44, 62, 80, 0.08)";
const dialogShadow = "0 12px 32px rgba(44, 62, 80, 0.35)";
const c = basicColors;

const styleSheet = `
.cb-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-sizing: border-box; min-height: 32px; padding: 0 14px; margin: 0;
  font: inherit; font-size: 14px; font-weight: 500; line-height: 1.2; white-space: nowrap;
  color: ${c.text}; background: ${c.surface}; border: 1px solid ${c.border}; border-radius: 6px;
  box-shadow: ${basicShadow}; cursor: pointer; user-select: none;
  transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.cb-button:hover:not(:disabled) { background: #f3f7fb; border-color: #b4c3d3; }
.cb-button:active:not(:disabled) { background: ${c.filled}; box-shadow: none; }
.cb-button.cb-filled { color: white; background: ${c.slate}; border-color: ${c.slate}; }
.cb-button.cb-filled:hover:not(:disabled) { background: #3f5a74; border-color: #3f5a74; }
.cb-button.cb-filled:active:not(:disabled) { background: ${c.navy}; }
.cb-button:disabled { opacity: 0.5; cursor: default; box-shadow: none; }
.cb-button .cb-icon { font-size: 20px; }
.cb-icon { font-size: 24px; line-height: 1; user-select: none; }
.cb-icon-button {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 36px; height: 36px; padding: 0; margin: 0; border: none; border-radius: 6px;
  color: inherit; background: transparent; cursor: pointer; transition: background-color 0.15s;
}
.cb-icon-button:hover { background: rgba(127, 150, 175, 0.18); }
.cb-icon-button:active { background: rgba(127, 150, 175, 0.32); }
.cb-list-item { padding: 8px 12px; border-radius: 6px; cursor: pointer; user-select: none; transition: background-color 0.15s; }
.cb-list-item:hover { background: rgba(46, 134, 193, 0.08); }
.cb-list-item.cb-active { background: rgba(46, 134, 193, 0.16); font-weight: bold; }
.cb-input {
  box-sizing: border-box; height: 32px; padding: 0 10px; min-width: 0; font: inherit;
  color: ${c.text}; background: ${c.surface}; border: 1px solid ${c.border}; border-radius: 6px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cb-input:focus { outline: none; border-color: ${c.accent}; box-shadow: 0 0 0 3px rgba(46, 134, 193, 0.2); }
.cb-input.cb-invalid { border-color: ${c.error}; background: #fdf1f0; }
.cb-button:focus-visible, .cb-icon-button:focus-visible, .cb-list-item:focus-visible {
  outline: 2px solid ${c.accent}; outline-offset: 2px;
}
`;

// Per document - each gets its own copy.
const documentsStyled = new WeakSet();

function ensureStyleSheet() {
  if (typeof(document) === "undefined" || !document.head || documentsStyled.has(document)) return;
  documentsStyled.add(document);
  const element = document.createElement("style");
  element.setAttribute("data-cascade-theme", "basic");
  element.textContent = styleSheet;
  document.head.appendChild(element);
}

const cardStyles = {
  elevated: { background: c.surface, boxShadow: basicShadow },
  filled: { background: c.filled },
  outlined: { background: c.surface, border: "1px solid " + c.border },
};

const onClickOf = (onClick) => (onClick ? { onclick: onClick } : {});

// A square button (rounded a little) with just an icon in it. Its color is
// inherited, so it fits on a dark bar as well as a light page.
class BasicIconButton extends Component {
  setProperties({ icon, onClick, style, children, ...rest }) {
    this.icon = icon;
    this.onClick = onClick || null;
    this.style = frozen(style || null);
    this.rest = frozen(rest);
  }

  build() {
    ensureStyleSheet();
    return htmlButton(
      { ...this.rest, key: "button", class: "cb-icon-button", ...onClickOf(this.onClick), style: this.style || {} },
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
          gap: "12px", padding: "12px 16px", borderRadius: "8px", alignItems: "center", boxSizing: "border-box",
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
      : { borderRadius: "10px", boxShadow: dialogShadow };
    return column(
      {
        key: "dialog",
        style: { background: c.surface, color: c.text, boxSizing: "border-box", overflow: "hidden", pointerEvents: "auto", ...frame, ...this.style },
      },
      row(
        {
          key: "titleBar",
          style: {
            padding: this.fullScreen ? "6px 16px 6px 6px" : "6px 6px 6px 16px",
            ...(this.fullScreen ? { minHeight: "48px" } : {}),
            background: c.navy, color: "white", flex: "none", alignItems: "center", gap: "8px", fontWeight: "bold",
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

// A label above an input (and its unit, if any), and the error under it,
// if there is one.
class BasicTextField extends Component {
  setProperties({ label, placeholder, value, onInput, type, unit, error, style }) {
    this.label = label || "";
    this.placeholder = placeholder || "";
    this.value = value === undefined || value === null ? "" : value;
    this.onInput = onInput || null;
    this.type = type || "text";
    this.unit = unit || null;
    this.error = error || null;
    this.style = frozen(style || null);
  }

  build() {
    ensureStyleSheet();
    return htmlLabel(
      { key: "field", style: { display: "flex", flexDirection: "column", gap: "4px", ...this.style } },
      span({ key: "label", style: { fontSize: "13px", opacity: 0.8 } }, text({ key: "labelText", text: this.label })).show(!!this.label),
      row(
        { key: "inputRow", style: { alignItems: "center", gap: "6px" } },
        htmlInput({
          key: "input",
          class: this.error ? "cb-input cb-invalid" : "cb-input",
          type: this.type,
          placeholder: this.placeholder,
          value: this.value,
          oninput: callback("input", (event) => this.onInput && this.onInput(event.target.value)),
          style: this.type === "number" ? { width: "88px" } : { flex: "1 1 auto" },
        }),
        this.unit ? span({ key: "unit" }, text({ key: "unitText", text: this.unit })) : null,
      ),
      div({ key: "error", style: { fontSize: "12px", color: c.error } }, text({ key: "errorText", text: this.error || "" })).show(!!this.error),
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
        style: { width: "18px", height: "18px", margin: 0, accentColor: c.slate },
      }),
      text({ key: "labelText", text: this.label }),
    );
  }
}

const widgets = {
  // A chip: white, on the page - or, `variant: "filled"`, slate, for the
  // one thing to do.
  button({ onClick, variant, style, children, ...rest }) {
    ensureStyleSheet();
    return htmlButton({
      ...rest,
      class: variant === "filled" ? "cb-button cb-filled" : "cb-button",
      ...onClickOf(onClick),
      style: style || {},
      children,
    });
  },

  // Google's Material Symbols font: the icon's name, drawn as a ligature.
  // A function, not a component - so the key of its text is derived from
  // its own: a fixed one would collide between icons built by one build.
  icon({ key, name, style, ...rest }) {
    ensureStyleSheet();
    return span(
      { ...rest, key, class: "material-symbols-outlined cb-icon", style: style || {} },
      text({ key: key ? key + "Name" : undefined, text: name || "" }),
    );
  },

  iconButton: (properties) => new BasicIconButton(properties),

  card({ variant, style, children, ...rest }) {
    return wrapper({
      ...rest,
      style: { padding: "16px", borderRadius: "8px", boxSizing: "border-box", ...(cardStyles[variant] || cardStyles.elevated), ...style },
      children,
    });
  },

  // Controls in a row, on a surface of their own - wrapping when there
  // isn't room for them all.
  controlPanel({ style, children, ...rest }) {
    return wrapper({
      ...rest,
      style: {
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", flex: "none",
        padding: "10px 16px", borderRadius: "8px", boxSizing: "border-box", overflow: "visible",
        background: c.surface, boxShadow: basicShadow, ...style,
      },
      children,
    });
  },

  alert: (properties) => new BasicAlert(properties),

  listItem({ active, onClick, style, children, ...rest }) {
    ensureStyleSheet();
    return wrapper({
      ...rest,
      class: active ? "cb-list-item cb-active" : "cb-list-item",
      ...onClickOf(onClick),
      style: style || {},
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
