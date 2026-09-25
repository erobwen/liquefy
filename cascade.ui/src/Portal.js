import { Component, flush, withoutRecording } from "@liquefy/cascade.component";
import { wrapper } from "./Layout.js";

/**
 * Portals - ported from flow.ui/basic/src/Portals.js: a place in the tree
 * (portal()) whose content is supplied from somewhere else entirely
 * (portalContents()) - a page putting its own buttons in the app's top
 * bar, say, which the page knows nothing else about.
 *
 *  - portal({ style, children }): a div, showing whatever is currently
 *    assigned to it - or its own children (a default) when nothing is.
 *  - portalContents({ portal, children }): renders nothing where it
 *    stands; while it's rendered, its children are shown in `portal`
 *    instead, and once it isn't (it's hidden, or its page is switched
 *    away from), they're taken back out. The last one rendered wins.
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

export function portalContents(...parameters) {
  return new PortalContents(...parameters);
}

export class Portal extends Component {
  setProperties({ style, children }) {
    this.style = style || null;
    this.defaultContents = children || [];
  }

  // What some PortalContents has assigned is state: changed only by
  // show()/hide(), never reset by a rebuild.
  initializeState() {
    return { contents: null };
  }

  initialUnobservables() {
    return { assignedBy: null };
  }

  // Called from a PortalContents render: what is shown now is read
  // without recording, so that render never depends on it - two contents
  // taking turns would otherwise keep rerunning each other.
  show(contentsProvider, contents) {
    this.unobservable.assignedBy = contentsProvider;
    const current = withoutRecording(() => this.contents);
    if (current !== contents) flush(() => this.setState({ contents }));
  }

  // Only the PortalContents that assigned what's shown can take it back -
  // one that has since been taken over by another doesn't clear its
  // successor's.
  hide(contentsProvider) {
    const u = this.unobservable;
    if (u.assignedBy !== contentsProvider) return;
    u.assignedBy = null;
    flush(() => this.setState({ contents: null }));
  }

  build() {
    return wrapper({ key: "portal", style: this.style || {} }, this.contents || this.defaultContents);
  }
}

export class PortalContents extends Component {
  setProperties({ portal, children }) {
    this.portal = portal || null;
    this.portalChildren = children || [];
  }

  initialUnobservables() {
    return { shownIn: null };
  }

  render() {
    const u = this.unobservable;
    if (u.shownIn && u.shownIn !== this.portal) {
      u.shownIn.hide(this);
      u.shownIn = null;
    }
    if (this.portal) {
      this.portal.show(this, this.portalChildren);
      u.shownIn = this.portal;
    }
  }

  // No longer rendered (hidden, or its page switched away from): take the
  // contents back - render() won't run again to do it (see Overlay's own
  // onRetract()).
  onRetract() {
    const u = this.unobservable;
    if (u.shownIn) {
      u.shownIn.hide(this);
      u.shownIn = null;
    }
  }
}
