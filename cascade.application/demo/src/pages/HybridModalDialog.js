import { Component } from "@liquefy/cascade.component";
import { p, text } from "@liquefy/cascade.dom";
import { button, card, dialog as themedDialog, alert, overlay, row, column, centerMiddle, fitContainerStyle, fillerStyle, overflowVisibleStyle } from "@liquefy/cascade.ui";
import { modalPresentation, fullScreenPresentation } from "../components/modal.js";
import { pageActions } from "../components/pageActions.js";
import source from "./HybridModalDialog.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A hybrid modal dialog - modal only when there isn't room for it:",
  points: [
    "Docked beside the controls when there's room, a modal window when there isn't - and full screen, with a back arrow, on a phone-sized screen.",
    "The same dialog content component moves between all three as the window is resized.",
    "So its state (the counter) is simply kept - never saved and restored.",
  ],
};

// The three presentations, as flow.application/demo's modalDemo.js has
// them. Resize the browser window while the dialog is open to see it move
// between them.
//
//  - Docked, beside the controls, while the page itself (its usableWidth,
//    handed down by ApplicationMenuFrame's workArea from a real
//    measurement) has room for both: at least DOCKED_MIN_WIDTH. That's high
//    enough to be decided only while the app's menu is docked too - the
//    menu going modal gives the page ~200px more at once, and a threshold
//    below that jump would flip the dialog back and forth as the window is
//    narrowed past it.
//  - A modal window otherwise.
//  - Full screen - the whole app, like a phone app's screen - when the app
//    itself (appWidth, not the page) is narrower than FULL_SCREEN_BELOW. By
//    the app's width, which follows the window, not the page's, which jumps
//    with the menu.
const PANEL_WIDTH = 400;
const DOCKED_MIN_WIDTH = 800;
const FULL_SCREEN_BELOW = 600;
const MODAL_WIDTH = 360;
const MODAL_HEIGHT = 420;

/**
 * HybridModalDialog - ported from flow.application/demo/src/pages/modalDemo.js's
 * own ModalExample/DialogueContent. The point of the demo: DialogContent
 * (below) carries its own independent state (a counter) that survives the
 * dialog transitioning between docked (beside the controls), modal
 * (centered over a backdrop, reached through cascade.ui's own
 * Overlay/OverlayFrame) and full screen (the whole app, with a back arrow)
 * - it's the exact same live component instance either way, never
 * saved/restored externally.
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
    const bounds = this.renderContext || {};
    const usableWidth = typeof(bounds.usableWidth) === "number" ? bounds.usableWidth : 1000;
    const appWidth = typeof(bounds.appWidth) === "number" ? bounds.appWidth : usableWidth;
    const mode = usableWidth >= DOCKED_MIN_WIDTH ? "docked" : appWidth < FULL_SCREEN_BELOW ? "fullScreen" : "modal";
    const close = () => { this.showDialog = false; };

    // Constructed unconditionally, every rebuild, regardless of
    // showDialog/mode - only where it's shown below is conditional. A
    // key that drops out for even one rebuild is gone for good (see
    // cascade.component/README.md), so skipping this construction while
    // the dialog happens to be closed would silently reset its state
    // (the counter) the next time it's reopened.
    const content = new DialogContent({ key: "dialogContent" });
    const dialog = themedDialog({
      key: "dialog",
      title: "Hybrid Modal Dialog",
      close,
      fullScreen: mode === "fullScreen",
      style: {
        docked: { ...fillerStyle },
        modal: { width: MODAL_WIDTH + "px", height: MODAL_HEIGHT + "px", flex: "none" },
        fullScreen: {},
      }[mode],
      children: [content],
    });

    return row(
      // Deliberately *not* alignItems: "flex-start" here - the docked
      // dialog's own fillerStyle (flex: 1 1 0) needs this row to give it a
      // definite, stretched height to fill.
      { key: "page", style: { ...fitContainerStyle, ...overflowVisibleStyle, gap: "16px" } },
      pageActions({ information, source, fileName: "src/pages/HybridModalDialog.js" }),
      // The controls, on a panel of their own (an elevated card - white,
      // with a shadow, on the grey page) - its edge is the border between
      // them and the docked dialog. As wide as the page when the
      // dialog isn't docked beside it.
      card(
        {
          key: "panel",
          style: {
            display: "flex", flexDirection: "column", gap: "16px", boxSizing: "border-box",
            ...(mode === "docked" ? { width: PANEL_WIDTH + "px", flex: "none" } : { ...fillerStyle }),
          },
        },
        alert(
          { key: "info", style: { flex: "none" } },
          text({
            key: "infoText",
            text: "A hybrid modal dialog - docked when there's room, modal when there isn't, and full screen on a " +
              "phone-sized screen. Open it, then resize the window: the same dialog (and its counter) moves between " +
              "them, never resetting.",
          }),
        ),
        // A themed widget (cascade.ui's button()) - the app's theme decides
        // what it looks like; only its placement here is set here.
        centerMiddle(
          { key: "openButtonArea", style: { ...fillerStyle, ...overflowVisibleStyle } },
          button({ key: "openButton" }, "Open Hybrid Modal Dialog", () => { this.showDialog = true; }),
        ),
      ),
      // The dialog has one place per build: docked here, or in the
      // overlay - never both. Put in the overlay's content while docked
      // too, the overlay (still shown as this build runs) would render it
      // there once more, taking its element back from the docked slot just
      // before the overlay closes - and the dialog would be gone.
      dialog.show(this.showDialog && mode === "docked"),
      overlay(
        { key: "dialogOverlay", showing: this.showDialog && mode !== "docked" },
        mode === "docked" ? null : mode === "fullScreen" ? fullScreenPresentation(dialog) : modalPresentation(dialog, close),
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
        "This counter's value survives moving between docked, modal and full screen - it's the exact same " +
        "component instance each way, not a fresh one.",
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
