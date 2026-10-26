import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, span, text, button as htmlButton } from "@liquefy/cascade.dom";
import { overlay } from "@liquefy/cascade.ui";
import { settingsFor, appSettingsDefaults } from "./settings.js";

/**
 * CreationDot - a dot, for creating something where it is. Clicked, it
 * opens the creation menu: a circle around it of everything the plugins in
 * use can create (`documentTypes`, see documents.js), each flying out from
 * the dot. Choosing one calls `onCreate(documentType)`; a click anywhere
 * else closes it.
 *
 *   creationDot({ documentTypes, onCreate, label, title, shape })
 *
 * `label` is said under it ("Create", for the null document); `title` is
 * its tooltip. `shape` says where it is - pointing where what it creates
 * goes:
 *
 *  - "dot" (the default): nothing there yet - the null document's, larger.
 *  - "up": before the first document - a triangle pointing up.
 *  - "diamond": between two - two triangles, one up, one down, as one.
 *  - "down": after the last.
 *  - "right": where documents are lined up on the left (the web) - a
 *    triangle pointing right, at their left edge.
 *
 * Its color is the app's (`creationColor` in the "tabula" settings, see
 * settings.js) - the placeholders' blue unless set otherwise - as faint as
 * a placeholder, until it's clicked.
 *
 * The menu is shown through the nearest OverlayFrame (see cascade.ui's
 * Overlay.js), over everything, where the dot is on the screen - its
 * circle moved in from the window's edges as far as it takes to be all
 * there, the items still flying out from the dot itself.
 */
export class CreationDot extends Component {
  setProperties({ documentTypes, onCreate, label, title, shape }) {
    this.documentTypes = documentTypes || [];
    this.onCreate = onCreate;
    this.label = label || null;
    this.title = title || "Create something";
    this.shape = shape || "dot";
  }

  initialState() {
    // center: where the dot was on the screen, when it was clicked.
    return { open: false, center: null };
  }

  onEstablish() {
    super.onEstablish();
    if (typeof(document) !== "undefined") addKeyframes(document);
  }

  build() {
    const { open, label } = this;
    const color = settingsFor("tabula", appSettingsDefaults).creationColor;
    return div(
      { style: { position: "relative", width: 0, height: 0 } },
      htmlButton(
        {
          title: this.title,
          onclick: callback("open", (event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            this.center = frozen({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 });
            this.open = true;
          }),
          style: {
            ...buttonStyle,
            ...shapes[this.shape],
            background: withAlpha(color, open ? 1 : faint),
            transform: open ? "translate(-50%, -50%) scale(1.4)" : "translate(-50%, -50%)",
          },
        },
      ),
      label
        ? div({ style: { ...labelStyle, color, opacity: open ? 0 : 0.7 } }, text(label))
        : null,
      overlay({ showing: open }, this.menu()),
    );
  }

  // Over everything: a layer catching the clicks outside the items - and
  // the items, around where the dot is.
  menu() {
    const { documentTypes, center: dot } = this;
    if (!dot) return div();
    const color = settingsFor("tabula", appSettingsDefaults).creationColor;
    // Far enough out for the items not to touch, however many there are.
    const radius = Math.max(96, documentTypes.length * itemSize / Math.PI * 0.75);
    const center = withinWindow(dot, radius + itemSize / 2 + 8);
    return div(
      {
        style: { position: "fixed", inset: 0, pointerEvents: "auto" },
        onmousedown: callback("close", () => { this.open = false; }),
      },
      documentTypes.length === 0
        ? div({ style: { ...labelStyle, position: "fixed", left: center.x + "px", top: center.y + 22 + "px", opacity: 0.8 } },
          text("Nothing to create - turn on a plugin in the settings."))
        : null,
      documentTypes.map((type, index) => {
        // From the top, clockwise.
        const angle = -Math.PI / 2 + index * 2 * Math.PI / documentTypes.length;
        const x = Math.round(Math.cos(angle) * radius);
        const y = Math.round(Math.sin(angle) * radius);
        return htmlButton(
          {
            key: type.name,
            title: type.description || type.label,
            onmousedown: callback("keep" + type.name, (event) => event.stopPropagation()),
            onclick: callback("create" + type.name, () => {
              this.open = false;
              this.onCreate(type);
            }),
            style: {
              ...itemStyle,
              left: center.x - itemSize / 2 + "px",
              top: center.y - itemSize / 2 + "px",
              // Out from the dot, one after the other (see addKeyframes()).
              "--from-x": dot.x - center.x + "px",
              "--from-y": dot.y - center.y + "px",
              "--x": x + "px",
              "--y": y + "px",
              transform: `translate(${x}px, ${y}px)`,
              animation: `tabula-fly-out 240ms cubic-bezier(0.2, 0.9, 0.3, 1.2) ${index * 30}ms both`,
            },
          },
          span({ class: "material-symbols-outlined", style: { fontSize: "28px", color } }, text(type.icon || "description")),
          span({ style: { fontSize: "12px", lineHeight: 1.2, textAlign: "center" } }, text(type.label)),
        );
      }),
    );
  }
}

// The circle's centre: the dot, moved in from the window's edges by as
// much as it takes for `reach` around it to be in the window - in the
// middle, if the window is too small for it either way.
function withinWindow(point, reach) {
  if (typeof(window) === "undefined") return point;
  const clamp = (value, size) => size < 2 * reach ? size / 2 : Math.min(Math.max(value, reach), size - reach);
  return { x: clamp(point.x, window.innerWidth), y: clamp(point.y, window.innerHeight) };
}

// From the dot - small, unseen - out to the item's place on the circle:
// from --from-x and --from-y to --x and --y, around the circle's centre.
function addKeyframes(doc) {
  if (!doc || !doc.head || doc.getElementById("tabula-creation-keyframes")) return;
  const style = doc.createElement("style");
  style.id = "tabula-creation-keyframes";
  style.textContent = "@keyframes tabula-fly-out {"
    + " from { transform: translate(var(--from-x), var(--from-y)) scale(0.2); opacity: 0; }"
    + " to { transform: translate(var(--x), var(--y)) scale(1); opacity: 1; } }";
  doc.head.appendChild(style);
}

const itemSize = 88;
const itemStyle = {
  position: "fixed", width: itemSize + "px", height: itemSize + "px",
  borderRadius: "50%", border: "none", background: "white", color: "#333", cursor: "pointer",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", padding: "6px",
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)", font: "inherit",
};
// As faint as a placeholder (see ../print/dom/paperStyles.js).
const faint = 0.35;
const buttonStyle = {
  position: "absolute", left: 0, top: 0, padding: 0, border: "none", cursor: "pointer",
  transition: "transform 160ms ease-out, background 160ms",
};
// Each shape: its size, and its outline (clip-path) - centred on where it is.
const shapes = {
  dot: { width: "18px", height: "18px", borderRadius: "50%" },
  up: { width: "18px", height: "13px", clipPath: "polygon(50% 0, 100% 100%, 0 100%)" },
  down: { width: "18px", height: "13px", clipPath: "polygon(0 0, 100% 0, 50% 100%)" },
  diamond: { width: "18px", height: "24px", clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" },
  right: { width: "13px", height: "18px", clipPath: "polygon(0 0, 100% 50%, 0 100%)" },
};

// "#4285f4" at `alpha`: "rgba(66, 133, 244, alpha)".
function withAlpha(hex, alpha) {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!value) return hex;
  const number = parseInt(value[1], 16);
  return "rgba(" + (number >> 16) + ", " + ((number >> 8) & 255) + ", " + (number & 255) + ", " + alpha + ")";
}
const labelStyle = {
  position: "absolute", left: 0, top: "22px", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: "13px",
  letterSpacing: "0.08em", textTransform: "uppercase", color: "#333", pointerEvents: "none", transition: "opacity 160ms",
};

export const creationDot = (...parameters) => new CreationDot(...parameters);
