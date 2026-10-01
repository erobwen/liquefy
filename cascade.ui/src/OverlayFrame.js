import { Component, flush, frozen, withoutRecording } from "@liquefy/cascade.component";
import { div, elementBoundsProvider } from "@liquefy/cascade.dom";

/**
 * OverlayFrame - ported from flow.ui/basic/src/overlay.js's own
 * OverlayFrame/Overlay pair, adapted to cascade's direct-render model
 * (no separate build-then-mount pass, so no `ensure()`/creators-stack
 * dance is needed to keep a modal's content correctly parented - see
 * the comment on `overlayContent.overlayFrame` below for the one place
 * that actually mattered and turned out to already be free here).
 *
 * Any component nested arbitrarily deep underneath an OverlayFrame -
 * through any mix of build() and hardcoded child references - can find
 * *this* one specifically via `this.inherit("overlayFrame")` (see
 * Component.inherit()): every OverlayFrame provides itself as
 * `overlayFrame`, so a lookup always finds the *nearest* one, never
 * skipping past it to an outer frame. That's what makes recursive modality
 * work: a dialog opened from inside another modal's own content finds
 * *that* modal's own frame, not the page's top-level one, so a third modal
 * opened from inside it stacks correctly on top of the second, not the
 * first.
 *
 * The content an Overlay shows keeps the context of where the Overlay
 * stands - so a dialog inherits what its page provides - with the frame it
 * is shown in on top: the sub-frame showing it enters the tree with the
 * Overlay's context (see Component.enteredContext()), and provides itself
 * as `overlayFrame` on top of that.
 *
 * A frame's own real children are its static content plus, when
 * something is currently showing a modal on it, exactly one nested
 * `modalSubFrame` - itself just another OverlayFrame, absolutely
 * positioned to cover this frame's own area (`pointerEvents: none` so it
 * doesn't block clicks through the parts of itself nothing is actually
 * using) - which is what lets an Overlay shown *inside* that sub-frame's
 * own content recurse the exact same way, arbitrarily deep.
 *
 * One overlay per frame: a frame shows the content of the Overlay that
 * showed it last. An Overlay shown on a frame already showing another's
 * content evicts it - the other keeps its `showing`, but isn't shown again
 * until it's shown anew - and hiding the newer one leaves the frame empty,
 * not the evicted one back. Overlays stack across frames (one opened from
 * inside another's content, above), not side by side on one. This is by
 * design, not an oversight - and may change only should a use case turn up
 * that needs several overlays on one frame.
 */
export function overlayFrame(...parameters) {
  return new OverlayFrame(...parameters);
}

export class OverlayFrame extends Component {
  setProperties({ style, children, overlayContent, originContext, isLayer }) {
    this.style = frozen(style || null);
    this.staticContent = frozen(children || []);
    // The alternative to showOverlay()/hideOverlay() below: an overlay
    // frame can be handed its modal content directly as a property
    // instead, for a frame that's dedicated to one specific modal rather
    // than a general, shared one any Overlay can find via inherit().
    this.propertyContent = overlayContent || null;
    // A sub-frame showing an Overlay's content: the context of where that
    // Overlay stands - what the content inherits from (see build()).
    this.originContext = originContext || null;
    // One this frame opens itself, to show overlay content on (see build()).
    this.isLayer = !!isLayer;
  }

  // Found by inherit("overlayFrame") from anywhere below - see
  // Component.provide().
  provide() {
    return { overlayFrame: this };
  }

  enteredContext(given) {
    return this.originContext || given;
  }

  // What some Overlay has currently assigned to this frame is *state* (see
  // cascade.component/README.md): established as nothing, then changed
  // only through showOverlay()/hideOverlay() below - and, crucially, never
  // reset by a rebuild, even though this frame is reconstructed (and
  // reconciled by key) every time whoever builds it reruns. Declaring it
  // here is also what positions it at the baseline (time 0, writer null),
  // which is exactly where setState() in show/hideOverlay writes it back
  // to - the same writing, reused, not a fresh one spliced in ahead of a
  // reader that could never actually reach it (see their comment).
  initialState() {
    return { shownContent: null, shownContext: null };
  }

  initialUnobservables() {
    return { assigningContentProvider: null };
  }

  // Called by an Overlay component (via inherit("overlayFrame")) when it
  // becomes visible - see Overlay.update(). `contentProvider` is the
  // Overlay itself, kept so a later hideOverlay() call from a *different*
  // Overlay (e.g. one that's since taken over) can't clear content it
  // never actually assigned - one overlay per frame (see the class doc).
  //
  // Called from inside an Overlay's own update - which is to say, from
  // *later* in this same pipeline than OverlayFrame's own build() (a
  // descendant calling back up to an ancestor). A plain write here could
  // never actually reach OverlayFrame's own already-registered dependency
  // on `shownContent`: "time as tree position" means a
  // later-positioned write can never overtake an earlier-positioned
  // reader, by construction (see cascade.reactive's own
  // migrateOvertakenObserversFor) - this is exactly the motivating case
  // flush()/accessInitialValues() were built for (a modal whose frame
  // already rendered needing new content added back into it, in the same
  // frame, without flicker - see docs/plan-flagged-scheduling.md).
  // setState() (Component.js) makes the write land at the baseline
  // position (before everything), reusing the exact writing
  // initialState() above set up rather than splicing a new one in
  // ahead of it that could never reach OverlayFrame's own reader either
  // way - it's also the only way a state property *may* be written from
  // inside a repeater at all - and flush() makes sure the resulting
  // rebuild happens within this same wave rather than waiting for the
  // next one.
  //
  // `context` is where the Overlay stands: the content is shown with it
  // (see the class doc).
  showOverlay(contentProvider, overlayContent, context) {
    this.unobservable.assigningContentProvider = contentProvider;
    const current = withoutRecording(() => [this.shownContent, this.shownContext]);
    if (current[0] !== overlayContent || current[1] !== (context || null)) {
      flush(() => this.setState({ shownContent: overlayContent, shownContext: context || null }));
    }
  }

  hideOverlay(contentProvider) {
    const u = this.unobservable;
    if (u.assigningContentProvider !== contentProvider) return;
    u.assigningContentProvider = null;
    flush(() => this.setState({ shownContent: null, shownContext: null }));
  }

  build() {
    if (this.shownContent && this.propertyContent) {
      throw new Error("Cannot both assign overlay content via showOverlay() and set it as a property on the same overlay frame.");
    }
    const overlayContent = this.shownContent || this.propertyContent;

    // A layer (a sub-frame showing what an overlay assigned - see below)
    // shows its content on a measured element, covering the frame: what's
    // shown there reads the frame's size with this.fromTarget() (see
    // modalAssembly(), which goes full screen below a width).
    const children = this.isLayer
      ? this.staticContent.map((content) => elementBoundsProvider({
        style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" },
        child: content,
      }))
      : [...this.staticContent];

    if (overlayContent) {
      children.push(new OverlayFrame(overlayContent, {
        key: "modalSubFrame",
        isLayer: true,
        // Content an Overlay assigned keeps the context of where it came
        // from; content handed over as a property is this frame's creator's
        // own, and is simply shown with this frame's.
        originContext: this.shownContent ? this.shownContext : null,
        style: {
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          pointerEvents: "none",
        },
      }));
    }

    // A stable key - this frame's own real element (and everything
    // reconciled underneath it) must survive across rebuilds triggered
    // by a modal opening/closing, not be torn down and recreated every
    // single time (see the constructor's own docs on why a key is what
    // makes build()-composed reconciliation possible at all).
    return div({ class: "overlay-frame", key: "frame", style: { position: "relative", ...this.style }, children });
  }
}
