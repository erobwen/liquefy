import { span, text } from "@liquefy/cascade.dom";

/**
 * How Tabula's UI looks as a whole, beyond any one component - a style
 * sheet of its own, for everything inside an element of the class
 * `tabula-app` (see TabulaApp.js):
 *
 *  - Scroll bars thin, out of the way: there for the wheel and the touch
 *    pad's two fingers, hardly for grabbing.
 *  - Icons all one size - the app setting `iconSize` (see settings.js),
 *    set as `--tabula-icon-size` on that element - the buttons around them
 *    sized to match: the theme's icon buttons, and Tabula's own icons
 *    (icon(), below).
 */
export const iconSizes = Object.freeze({ small: 18, medium: 20, large: 24 });

export const iconSizeStyle = (size) => ({ "--tabula-icon-size": (iconSizes[size] || iconSizes.small) + "px" });

const sheet = `
.tabula-app * { scrollbar-width: thin; scrollbar-color: rgba(60, 64, 67, 0.28) transparent; }
.tabula-app *::-webkit-scrollbar { width: 6px; height: 6px; }
.tabula-app *::-webkit-scrollbar-thumb { background: rgba(60, 64, 67, 0.28); border-radius: 3px; }
.tabula-app *::-webkit-scrollbar-track { background: transparent; }
.tabula-app .tabula-icon, .tabula-app .cb-icon-button .material-symbols-outlined { font-size: var(--tabula-icon-size, 18px) !important; }
.tabula-app .cb-icon-button { width: calc(var(--tabula-icon-size, 18px) + 12px); height: calc(var(--tabula-icon-size, 18px) + 12px); }
`;

// Once per document.
export function addAppStyle(doc) {
  if (!doc || !doc.head || doc.getElementById("tabula-app-style")) return;
  const style = doc.createElement("style");
  style.id = "tabula-app-style";
  style.textContent = sheet;
  doc.head.appendChild(style);
}

// One of Tabula's own icons - a Material Symbols name - at the app's icon
// size.
export const icon = (name, style = {}) => span({ class: "material-symbols-outlined tabula-icon", style }, text(name));
