import { Component, flush, withoutRecording, frozen, contextScope } from "@liquefy/cascade.component";
import { div } from "./HTMLTags.js";

/**
 * Portals - ported from flow.ui/basic/src/Portals.js: a place in the tree
 * (portal()) whose content is supplied from somewhere else entirely
 * (portalSource()) - a page putting its own buttons in the app's top
 * bar, say, which the page knows nothing else about.
 *
 *  - portal({ style, children }): a div, showing whatever is currently
 *    assigned to it - or its own children (a default) when nothing is, or
 *    nothing but an empty list (an empty cart).
 *  - portalSource({ portal, children }): builds nothing where it
 *    stands; while it's shown, its children are shown in `portal` - a
 *    portal, or the name of one to inherit() ("topBarPortal"), found when
 *    it builds, so it can be created before it has a place in the tree
 *    instead, and once it isn't (it's hidden, or its page is switched
 *    away from), they're taken back out - see Component.onShow()/onHide().
 *    The last one shown wins. Its children keep the context of where it
 *    stands - what it passes on to its own children - so what's put
 *    through a portal inherits from where it came from, not from where it
 *    ends up (see Component.enteredContext(), ContextScope).
 *
 * The same mechanism as OverlayFrame/Overlay (see OverlayFrame.js - an
 * overlay frame is a portal with a modal layer): the contents are
 * typically rendered *after* the portal (a page's work area comes after
 * the top bar), so assigning them is a write backwards in the pipeline -
 * setState() puts it at the baseline, where the portal's build reads it,
 * and flush() gets it rebuilt in the same wave, so the portal fills in the
 * same frame, not the next.
 *
 * Who holds the portal: something that creates it itself and owns it (not
 * one built in some build() and also referenced - see
 * cascade.component/README.md), typically providing it for inherit() too,
 * so that whatever is rendered below can find it without being handed it.
 */
export function portal(...parameters) {
  return new Portal(...parameters);
}

export function portalSource(...parameters) {
  return new PortalSource(...parameters);
}

export class Portal extends Component {
  setProperties({ style, children }) {
    this.style = frozen(style || null);
    this.defaultContents = frozen(children || []);
  }

  // What some PortalSource has assigned is state: changed only by
  // show()/hide(), never reset by a rebuild - and the context they're
  // shown with, that PortalSource'.
  initialState() {
    return { contents: null, contentsContext: null };
  }

  initialUnobservables() {
    return { assignedBy: null };
  }

  // Called from a PortalSource render: what is shown now is read
  // without recording, so that render never depends on it - two contents
  // taking turns would otherwise keep rerunning each other.
  show(contentsProvider, contents, context) {
    this.unobservable.assignedBy = contentsProvider;
    const current = withoutRecording(() => [this.contents, this.contentsContext]);
    if (current[0] !== contents || current[1] !== (context || null)) {
      flush(() => this.setState({ contents, contentsContext: context || null }));
    }
  }

  // Only the PortalSource that assigned what's shown can take it back -
  // one that has since been taken over by another doesn't clear its
  // successor's.
  hide(contentsProvider) {
    const u = this.unobservable;
    if (u.assignedBy !== contentsProvider) return;
    u.assignedBy = null;
    flush(() => this.setState({ contents: null, contentsContext: null }));
  }

  build() {
    const assigned = this.contents && this.contents.length > 0;
    return div(
      { key: "portal", style: this.style || {} },
      assigned ? contextScope({ key: "contents", context: this.contentsContext }, this.contents) : this.defaultContents,
    );
  }
}

export class PortalSource extends Component {
  setProperties({ portal, children }) {
    this.portal = portal || null;
    this.portalChildren = frozen(children || []);
  }

  initialUnobservables() {
    return { shownIn: null };
  }

  // Build-only - so it's also placed like any other component by one that
  // places its subtree itself (cascade.DOM's FlipAnimationContainer), where
  // it expands to nothing. A build only runs while something is showing
  // this component (rendering or expanding it pulls it), so building is
  // where the contents are assigned - again whenever they change.
  build() {
    this.assign();
    return null;
  }

  // Shown again (see Component.onShow()): an up-to-date build doesn't
  // rerun, so assign the contents here. Read without recording - this runs
  // inside whoever is rendering.
  onShow() {
    withoutRecording(() => this.assign());
  }

  // No longer shown (hidden, its page switched away from, dropped): take
  // the contents back.
  onHide() {
    const u = this.unobservable;
    if (u.shownIn) {
      u.shownIn.hide(this);
      u.shownIn = null;
    }
  }

  assign() {
    const u = this.unobservable;
    const portal = typeof(this.portal) === "string" ? this.inherit(this.portal) : this.portal;
    // A name nothing provides - a typo, or placed outside what provides
    // it: its contents are shown nowhere. Said once, not silently.
    if (!portal && typeof(this.portal) === "string" && !u.warnedMissing) {
      u.warnedMissing = true;
      console.warn("portalSource(): nothing provides a portal named \"" + this.portal + "\" where it's placed - its contents aren't shown.");
    }
    if (u.shownIn && u.shownIn !== portal) {
      u.shownIn.hide(this);
      u.shownIn = null;
    }
    if (portal) {
      portal.show(this, this.portalChildren, u.childContext);
      u.shownIn = portal;
    }
  }
}
