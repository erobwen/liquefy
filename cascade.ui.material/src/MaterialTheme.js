import { Component, frozen, callback } from "@liquefy/cascade.component";
import { element, text, input as htmlInput, label as htmlLabel, button as htmlButton, div } from "@liquefy/cascade.dom";
import { row, column, filler, wrapper, icon, iconButton, alertSeverities, ColorScheme } from "@liquefy/cascade.ui";
import { argbFromHex, Scheme, CorePalette, redFromArgb, greenFromArgb, blueFromArgb } from "@material/material-color-utilities";

/**
 * The Material theme - ported from flow.ui/material's own components.js,
 * alert.js and dialogue.js: the same widgets as cascade.ui's basic theme
 * (see its widgets.js for each widget's property contract), rendered as
 * mdui 2 web components where mdui has one (button, icon, icon button,
 * list item), and otherwise as plain elements styled with mdui's own
 * design tokens (--mdui-color-*, --mdui-elevation-*, --mdui-shape-*), so
 * they match. mdui's own dialog isn't used for dialog: it's a modal of
 * its own, and where a dialog is shown is up to whoever places it (see
 * cascade.ui's overlay()). A service locator answering
 * `{ type: "widget", name }` queries (see cascade.component's
 * ServiceLocator.js); the custom elements themselves are just HTML
 * elements with other tag names, looked up the same way as any other.
 *
 * Needs the mdui components registered to look like anything - import this
 * package's index.js (which does that) in a browser, not this file.
 */

const onClickOf = (onClick) => (onClick ? { onclick: onClick } : {});

// mdui's own colors, from one: its variables (--mdui-color-primary, ...,
// each "r, g, b"), made from the base color the way mdui's
// setColorScheme() makes them - Material's tonal palettes - but as data,
// for whoever gives a part of the app its colors to set on an element
// (see cascade.ui's colorScheme.js). The light scheme only.
const mduiVariablesByColor = new Map();
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
const rgbOf = (argb) => [redFromArgb(argb), greenFromArgb(argb), blueFromArgb(argb)].join(", ");

export function mduiColorVariables(hex) {
  let variables = mduiVariablesByColor.get(hex);
  if (variables) return variables;
  const source = argbFromHex(hex);
  const scheme = Scheme.light(source).toJSON();
  // The surface containers mdui adds, which the color library lacks.
  const palette = CorePalette.of(source);
  Object.assign(scheme, {
    surfaceDim: palette.n1.tone(87),
    surfaceBright: palette.n1.tone(98),
    surfaceContainerLowest: palette.n1.tone(100),
    surfaceContainerLow: palette.n1.tone(96),
    surfaceContainer: palette.n1.tone(94),
    surfaceContainerHigh: palette.n1.tone(92),
    surfaceContainerHighest: palette.n1.tone(90),
    surfaceTintColor: scheme.primary,
  });
  variables = {};
  for (const name in scheme) variables["--mdui-color-" + kebab(name)] = rgbOf(scheme[name]);
  mduiVariablesByColor.set(hex, variables);
  return variables;
}

// Material's baseline purple, and its tertiary rose as the accent.
export const materialDefaultColors = { base: "#6750a4", accent: "#7d5260" };

const cardStyles = {
  elevated: { background: "rgb(var(--mdui-color-surface-container-low))", boxShadow: "var(--mdui-elevation-level1)" },
  filled: { background: "rgb(var(--mdui-color-surface-container-highest))" },
  outlined: { background: "rgb(var(--mdui-color-surface))", border: "1px solid rgb(var(--mdui-color-outline-variant))" },
};

class MaterialAlert extends Component {
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
          gap: "12px", padding: "12px 16px", borderRadius: "var(--mdui-shape-corner-medium)", alignItems: "center",
          boxSizing: "border-box", background: severity.background, color: severity.color, ...this.style,
        },
      },
      icon({ key: "icon", name: severity.icon, style: { fontSize: "32px", color: severity.iconColor, flex: "none" } }),
      wrapper({ key: "message", style: { flex: "1 1 auto", minWidth: 0 } }, this.alertChildren),
    );
  }
}

class MaterialDialog extends Component {
  setProperties({ title, close, fullScreen, style, children }) {
    this.title = title || "";
    this.close = close || null;
    this.fullScreen = !!fullScreen;
    this.style = frozen(style || null);
    this.dialogChildren = frozen(children || []);
  }

  build() {
    const close = callback("close", () => this.close && this.close());
    // Full screen: Material's full-screen dialog - the surface itself, with
    // a back arrow and the title in a top app bar.
    const frame = this.fullScreen
      ? { width: "100%", height: "100%", background: "rgb(var(--mdui-color-surface))" }
      : {
        background: "rgb(var(--mdui-color-surface-container-high))",
        borderRadius: "var(--mdui-shape-corner-extra-large)", boxShadow: "var(--mdui-elevation-level3)",
      };
    return column(
      {
        key: "dialog",
        style: { color: "rgb(var(--mdui-color-on-surface))", boxSizing: "border-box", overflow: "hidden", pointerEvents: "auto", ...frame, ...this.style },
      },
      row(
        {
          key: "titleBar",
          style: this.fullScreen
            ? { padding: "8px 16px 8px 4px", minHeight: "56px", flex: "none", alignItems: "center", gap: "8px", fontSize: "22px" }
            : { padding: "8px 8px 0 24px", flex: "none", alignItems: "center", gap: "8px", fontSize: "20px" },
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

// mdui's outlined text field - its label inside the outline, the unit as
// its suffix - and the error under it, in the theme's error color.
class MaterialTextField extends Component {
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
    // Overflow visible: a filled-in field's label floats half above its
    // outline.
    return column(
      { key: "field", style: { gap: "4px", overflow: "visible", ...this.style } },
      element("mdui-text-field", {
        key: "input",
        variant: "outlined",
        label: this.label,
        placeholder: this.placeholder,
        type: this.type,
        value: String(this.value),
        suffix: this.unit || "",
        oninput: callback("input", (event) => this.onInput && this.onInput(event.target.value)),
        style: {
          ...(this.type === "number" ? { width: "140px" } : {}),
          ...(this.error ? { "--mdui-color-outline": "var(--mdui-color-error)", "--mdui-color-on-surface-variant": "var(--mdui-color-error)" } : {}),
        },
      }),
      wrapper(
        { key: "error", style: { fontSize: "12px", padding: "0 16px", color: "rgb(var(--mdui-color-error))" } },
        text({ key: "errorText", text: this.error || "" }),
      ).show(!!this.error),
    );
  }
}

class MaterialCheckbox extends Component {
  setProperties({ label, checked, onChange, style }) {
    this.label = label || "";
    this.checked = !!checked;
    this.onChange = onChange || null;
    this.style = frozen(style || null);
  }

  build() {
    return element(
      "mdui-checkbox",
      {
        key: "checkbox",
        checked: this.checked,
        onchange: callback("change", (event) => this.onChange && this.onChange(event.target.checked)),
        style: this.style || {},
      },
      text({ key: "labelText", text: this.label }),
    );
  }
}

// The browser's own color picker, in Material's outline and corners.
class MaterialColorField extends Component {
  setProperties({ label, value, onInput, style }) {
    this.label = label || "";
    this.value = value || "#000000";
    this.onInput = onInput || null;
    this.style = frozen(style || null);
  }

  build() {
    return htmlLabel(
      { key: "field", style: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "rgb(var(--mdui-color-on-surface))", ...this.style } },
      htmlInput({
        key: "input",
        type: "color",
        value: this.value,
        oninput: callback("input", (event) => this.onInput && this.onInput(event.target.value)),
        style: {
          boxSizing: "border-box", width: "44px", height: "36px", padding: "3px", margin: 0, flex: "none", cursor: "pointer",
          background: "transparent", border: "1px solid rgb(var(--mdui-color-outline))", borderRadius: "var(--mdui-shape-corner-small)",
        },
      }),
      text({ key: "labelText", text: this.label }),
    );
  }
}

// Material's primary tabs: the selected one in the primary color, with its
// indicator under it.
class MaterialTabBar extends Component {
  setProperties({ tabs, selected, onSelect, style }) {
    this.tabs = frozen(tabs || []);
    this.selected = selected;
    this.onSelect = onSelect || null;
    this.style = frozen(style || null);
  }

  build() {
    return div(
      {
        key: "tabs",
        role: "tablist",
        style: { display: "flex", flexWrap: "wrap", borderBottom: "1px solid rgb(var(--mdui-color-surface-variant))", ...this.style },
      },
      this.tabs.map((tab) => {
        const selected = tab.key === this.selected;
        return htmlButton(
          {
            key: tab.key,
            role: "tab",
            onclick: callback("select" + tab.key, () => this.onSelect && this.onSelect(tab.key)),
            style: {
              padding: "12px 20px", margin: "0 0 -1px 0", font: "inherit", fontWeight: "500", cursor: "pointer",
              background: "transparent", border: "none", borderBottom: "3px solid " + (selected ? "rgb(var(--mdui-color-primary))" : "transparent"),
              color: selected ? "rgb(var(--mdui-color-primary))" : "rgb(var(--mdui-color-on-surface-variant))",
            },
          },
          text({ key: tab.key + "Title", text: tab.title }),
        );
      }),
    );
  }
}

const widgets = {
  button({ onClick, children, ...rest }) {
    return element("mdui-button", {
      ...rest,
      ...onClickOf(onClick),
      children,
    });
  },

  icon({ name, ...rest }) {
    return element("mdui-icon", { ...rest, name: name || "" });
  },

  iconButton({ icon: iconName, onClick, children, ...rest }) {
    return element("mdui-button-icon", { ...rest, icon: iconName || "", ...onClickOf(onClick) });
  },

  card({ variant, style, children, ...rest }) {
    return wrapper({
      ...rest,
      style: {
        padding: "12px", borderRadius: "var(--mdui-shape-corner-medium)", boxSizing: "border-box",
        ...(cardStyles[variant] || cardStyles.elevated), ...style,
      },
      children,
    });
  },

  // Controls in a row, on a surface - Material's own corners and tone.
  controlPanel({ style, children, ...rest }) {
    return wrapper({
      ...rest,
      style: {
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", flex: "none",
        padding: "8px 16px", borderRadius: "var(--mdui-shape-corner-large)", boxSizing: "border-box", overflow: "visible",
        ...cardStyles.elevated, ...style,
      },
      children,
    });
  },

  alert: (properties) => new MaterialAlert(properties),

  listItem({ active, onClick, children, ...rest }) {
    return element("mdui-list-item", {
      ...rest,
      active: !!active,
      rounded: true,
      ...onClickOf(onClick),
      children,
    });
  },

  dialog: (properties) => new MaterialDialog(properties),

  textField: (properties) => new MaterialTextField(properties),

  checkbox: (properties) => new MaterialCheckbox(properties),

  colorField: (properties) => new MaterialColorField(properties),

  tabBar: (properties) => new MaterialTabBar(properties),
};

export class MaterialThemeServiceLocator {
  constructor() {
    this.colorScheme = new ColorScheme({ ...materialDefaultColors, extraVariables: (base) => mduiColorVariables(base) });
  }

  locate(query) {
    if (query.type === "colorScheme") return this.colorScheme;
    if (query.type !== "widget") return undefined;
    const build = widgets[query.name];
    return build ? build(query.properties) : undefined;
  }
}

export const materialTheme = new MaterialThemeServiceLocator();
