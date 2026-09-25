import { Component } from "@liquefy/cascade.component";
import { div, p } from "@liquefy/cascade.dom";
import { button, overlay, row, column, fitContainerStyle, fillerStyle, overflowVisibleStyle } from "@liquefy/cascade.ui";
import { DialogChrome, modalPresentation } from "../components/dialog.js";

// Below this usableWidth (the page's own allotted content area, handed
// down by ApplicationMenuFrame's own workArea - ultimately sourced from
// DOMElementBoundsProvider's real measurement, not raw window size), the
// dialog goes modal instead of docked. Resize the browser window while
// the dialog is open to see it flip between the two presentations, same
// as flow.application/demo's own modalDemo.js.
const MODAL_BREAKPOINT = 560;
const MODAL_WIDTH = 360;
const MODAL_HEIGHT = 420;

/**
 * HybridModalDialog - ported from flow.application/demo/src/pages/modalDemo.js's
 * own ModalExample/DialogueContent. The point of the demo: DialogContent
 * (below) carries its own independent state (a counter) that survives the
 * dialog transitioning between docked (inline, next to the controls) and
 * modal (centered over a backdrop, reached through cascade.ui's own
 * Overlay/OverlayFrame) - it's the exact same live component instance
 * either way, never saved/restored externally.
 *
 * The mechanism is cascade's ordinary keyed build() reconciliation, not
 * anything modal-specific: `dialog` (and, nested inside it, `content`)
 * are constructed with the same key on every single rebuild of this
 * component, in *both* branches below - see Component.js's own
 * constructor ("constructing a component with a key that matches one
 * from the enclosing repeater's previous run discards this freshly-
 * constructed instance and returns the established one instead"). Both
 * branches are always evaluated - only .show(condition)/`showing:` (which
 * never clone or wrap, just return the same reference or null/nothing)
 * decide which one is actually visible in the rendered tree at any given
 * moment, so the object is transplanted between the two potential
 * parents, never duplicated and never torn down in between. This is
 * exactly flow's own approach (see this file's own git history / the
 * Flow demo this replicates) - no cascade-specific "portal for state"
 * trick needed beyond the ordinary keyed reconciliation every build()-
 * composed child already gets.
 *
 * Reaches the app-wide OverlayFrame (created once, in ApplicationMenuFrame's
 * own build()) via cascade.ui's overlay()/inherit("overlayFrame") -
 * nothing here wires that connection up explicitly.
 */
export class HybridModalDialog extends Component {
  initializeState() {
    return { showDialog: false };
  }

  build() {
    const bounds = this.renderContext;
    const usableWidth = bounds && typeof (bounds.usableWidth) === "number" ? bounds.usableWidth : 1000;
    const dialogIsModal = usableWidth < MODAL_BREAKPOINT;

    // Constructed unconditionally, every rebuild, regardless of
    // showDialog/dialogIsModal - only visibility below is conditional. A
    // key that drops out for even one rebuild is gone for good (see
    // cascade.component/README.md), so skipping this construction while
    // the dialog happens to be closed would silently reset its state
    // (the counter) the next time it's reopened.
    const content = new DialogContent({ key: "dialogContent" });
    const dialog = new DialogChrome({
      key: "dialog",
      title: "Hybrid Modal Dialog",
      close: () => { this.showDialog = false; },
      style: dialogIsModal
        ? { width: MODAL_WIDTH + "px", height: MODAL_HEIGHT + "px", flex: "none" }
        : { ...fillerStyle, maxWidth: "420px" },
      children: [content],
    });

    const dockedSlot = dialog.show(this.showDialog && !dialogIsModal);

    return column(
      { key: "page", style: { ...fitContainerStyle, ...overflowVisibleStyle, gap: "16px", padding: "16px" } },
      div(
        { key: "info", style: { padding: "12px 16px", background: "#eaf4ff", border: "1px solid #b8dcff", borderRadius: "6px" } },
        "A hybrid modal dialog - only modal when there isn't enough room. Open it, then resize the window: " +
        "the same dialog (and its counter) moves between docked and modal, never resetting.",
      ),
      row(
        // Deliberately *not* alignItems: "flex-start" here - the docked
        // dialog's own fillerStyle (flex: 1 1 0) needs this row to give it
        // a definite, stretched height to fill; without that, its own
        // body (also fillerStyle) has nothing to fill either and
        // collapses to zero height instead. The button opts back out
        // individually (alignSelf) rather than the row opting every
        // child out of stretch.
        { key: "controls", style: { gap: "16px", minHeight: 0, flex: "1 1 auto" } },
        // A themed widget (cascade.ui's button()) - the app's theme decides
        // what it looks like; only its placement in this row is set here.
        button(
          { key: "openButton", style: { flex: "none", alignSelf: "flex-start" } },
          "Open Hybrid Modal Dialog",
          () => { this.showDialog = true; },
        ),
        dockedSlot,
      ),
      overlay(
        modalPresentation(dialog, () => { this.showDialog = false; }),
        { key: "dialogOverlay", showing: this.showDialog && dialogIsModal },
      ),
    );
  }
}

// Dialog content - the component whose state (the counter) is the whole
// point of the demo: it must read the same value whether the dialog
// enclosing it is currently docked or modal.
class DialogContent extends Component {
  initializeState() {
    return { counter: 0 };
  }

  build() {
    return column(
      { key: "content", style: { padding: "16px", gap: "12px" } },
      p({ key: "explanation" },
        "This counter's value survives the docked ⇄ modal transition - it's the exact same component " +
        "instance either way, not a fresh one.",
      ),
      p({ key: "counter" }, "Counter: " + this.counter),
      button(
        { key: "increment", style: { alignSelf: "flex-start" } },
        "Increment Counter",
        () => { this.counter += 1; },
      ),
    );
  }
}
