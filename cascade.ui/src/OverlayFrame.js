import { Component, flush } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";

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
 * Component.inherit()): every OverlayFrame provides itself
 * (`this.overlayFrame = this`), so the walk always resolves to the
 * *nearest* one, never skipping past it to an outer frame. That's what
 * makes recursive modality work: a dialog opened from inside another
 * modal's own content finds *that* modal's own frame, not the page's
 * top-level one, so a third modal opened from inside it stacks correctly
 * on top of the second, not the first.
 *
 * A frame's own real children are its static content plus, when
 * something is currently showing a modal on it, exactly one nested
 * `modalSubFrame` - itself just another OverlayFrame, absolutely
 * positioned to cover this frame's own area (`pointerEvents: none` so it
 * doesn't block clicks through the parts of itself nothing is actually
 * using) - which is what lets an Overlay shown *inside* that sub-frame's
 * own content recurse the exact same way, arbitrarily deep.
 */
export function overlayFrame(...parameters) {
  return new OverlayFrame(...parameters);
}

export class OverlayFrame extends Component {
  setProperties({ style, children, overlayContent }) {
    this.style = style || null;
    this.staticContent = children || [];
    // The alternative to showOverlay()/hideOverlay() below: an overlay
    // frame can be handed its modal content directly as a property
    // instead, for a frame that's dedicated to one specific modal rather
    // than a general, shared one any Overlay can find via inherit().
    this.receivedOverlayContent = overlayContent || null;
    // Provides itself for inherit("overlayFrame") - see Component.provide().
    this.overlayFrame = this;
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
  initializeState() {
    return { assignedOverlayContent: null };
  }

  initialUnobservables() {
    return { assigningContentProvider: null };
  }

  // Called by an Overlay component (via inherit("overlayFrame")) when it
  // becomes visible - see Overlay.render(). `contentProvider` is the
  // Overlay itself, kept so a later hideOverlay() call from a *different*
  // Overlay (e.g. one that's since taken over) can't clear content it
  // never actually assigned.
  //
  // Called from inside an Overlay's own render() - which is to say, from
  // *later* in this same pipeline than OverlayFrame's own build() (a
  // descendant calling back up to an ancestor). A plain write here could
  // never actually reach OverlayFrame's own already-registered dependency
  // on `assignedOverlayContent`: "time as tree position" means a
  // later-positioned write can never overtake an earlier-positioned
  // reader, by construction (see cascade.reactive's own
  // migrateOvertakenObserversFor) - this is exactly the motivating case
  // flush()/accessInitialValues() were built for (a modal whose frame
  // already rendered needing new content added back into it, in the same
  // frame, without flicker - see docs/plan-flagged-scheduling.md).
  // setState() (Component.js) makes the write land at the baseline
  // position (before everything), reusing the exact writing
  // initializeState() above set up rather than splicing a new one in
  // ahead of it that could never reach OverlayFrame's own reader either
  // way - it's also the only way a state property *may* be written from
  // inside a repeater at all - and flush() makes sure the resulting
  // rebuild happens within this same wave rather than waiting for the
  // next one.
  showOverlay(contentProvider, overlayContent) {
    this.unobservable.assigningContentProvider = contentProvider;
    flush(() => this.setState({ assignedOverlayContent: overlayContent }));
  }

  hideOverlay(contentProvider) {
    if (this.unobservable.assigningContentProvider === contentProvider) {
      flush(() => this.setState({ assignedOverlayContent: null }));
    }
  }

  // Replace this frame's own static content in place - used when the
  // *same* modalSubFrame is reused for new overlay content (see build()
  // below) rather than tearing the sub-frame down and recreating it,
  // which would also retract and rebuild everything recursively nested
  // inside it for no reason.
  setStaticContent(staticContent) {
    this.staticContent = staticContent instanceof Array ? staticContent : [staticContent];
  }

  build() {
    if (this.assignedOverlayContent && this.receivedOverlayContent) {
      throw new Error("Cannot both assign overlay content via showOverlay() and set it as a property on the same overlay frame.");
    }
    const overlayContent = this.assignedOverlayContent || this.receivedOverlayContent;

    // const u = this.unobservable;

    const children = [...this.staticContent];

    if (overlayContent) {
      children.push(new OverlayFrame(overlayContent, {
        key: "modalSubFrame",
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
