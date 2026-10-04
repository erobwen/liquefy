import { Component, callback } from "@liquefy/cascade.component";
import { card, iconButton, popover } from "@liquefy/cascade.ui";

/**
 * InfoButton - a small icon button - an information icon, by default, or
 * any `icon` - and what it holds: `details` (what build makes - components),
 * shown in a popover beside it when it's clicked, closed by a click anywhere
 * outside it. For what's good to know, or to set, but needn't take room all
 * the time.
 *
 *   infoButton({ key: "info", title: "About this flow", details: [...] })
 *   infoButton({ key: "settings", icon: "settings", title: "Settings", details: [...] })
 *
 * The popover shows through the nearest OverlayFrame (see cascade.ui's
 * Popover.js).
 */
export class InfoButton extends Component {
  setProperties({ icon, title, details }) {
    this.icon = icon || "info";
    this.title = title || "More";
    this.details = details || [];
  }

  initialState() {
    return { open: false, anchor: null };
  }

  build() {
    return [
      iconButton({ icon: this.icon, title: this.title, style: { color: "#4285f4" } }, (event) => {
        // The button itself - the popover follows it, should it move.
        this.anchor = event.currentTarget;
        this.open = true;
      }),
      popover(
        { anchor: this.anchor, showing: this.open, close: callback("close", () => { this.open = false; }) },
        card(
          { style: { display: "flex", flexDirection: "column", gap: "6px", maxWidth: "260px", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)" } },
          // Flat: what's given may hold lists - a checkbox for every kind of
          // something, say - and a card takes components, not lists of them.
          this.details.flat(Infinity),
        ),
      ),
    ];
  }
}

export function infoButton(...parameters) {
  return new InfoButton(...parameters);
}
