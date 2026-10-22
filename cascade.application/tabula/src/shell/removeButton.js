import { callback } from "@liquefy/cascade.component";
import { span, text, button as htmlButton } from "@liquefy/cascade.dom";

// The button taking a document out of the sequence it's in - an x in a
// small round button, for an editor to place where it likes (see
// documents.js): `removeButton(onRemove, { left, top })` - placed
// absolutely, its centre on that point.
export function removeButton(onRemove, { left = 0, top = 0 } = {}) {
  return htmlButton(
    {
      title: "Remove it from the sequence",
      onclick: callback("remove", () => onRemove()),
      style: {
        position: "absolute", left, top, transform: "translate(-50%, -50%)", zIndex: 1,
        width: "26px", height: "26px", padding: 0, borderRadius: "50%", border: "1px solid rgba(0, 0, 0, 0.12)",
        background: "white", color: "#555", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18)",
      },
    },
    span({ class: "material-symbols-outlined", style: { fontSize: "18px" } }, text("close")),
  );
}
