import { Component } from "@liquefy/cascade.component";
import { element, text } from "@liquefy/cascade.dom";
import { row, column, filler, wrapper, icon, iconButton, alertSeverities } from "@liquefy/cascade.ui";

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

const cardStyles = {
  elevated: { background: "rgb(var(--mdui-color-surface-container-low))", boxShadow: "var(--mdui-elevation-level1)" },
  filled: { background: "rgb(var(--mdui-color-surface-container-highest))" },
  outlined: { background: "rgb(var(--mdui-color-surface))", border: "1px solid rgb(var(--mdui-color-outline-variant))" },
};

class MaterialAlert extends Component {
  setProperties({ severity, style, children }) {
    this.severity = alertSeverities[severity] ? severity : "info";
    this.style = style || null;
    this.alertChildren = children || [];
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
    this.style = style || null;
    this.dialogChildren = children || [];
  }

  build() {
    const close = () => this.close && this.close();
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
};

export class MaterialThemeServiceLocator {
  locate(query) {
    if (query.type !== "widget") return undefined;
    const build = widgets[query.name];
    return build ? build(query.properties) : undefined;
  }
}

export const materialTheme = new MaterialThemeServiceLocator();
