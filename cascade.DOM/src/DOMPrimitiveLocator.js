import { DOMElementComponent } from "./DOMElementComponent.js";

/**
 * DOMPrimitiveLocator: the DOM platform's own primitive locator - the
 * concrete counterpart to cascade.component's own
 * `unobservable.primitiveLocator` (see Component.js's own constructor/
 * renderOnto(), which propagate whichever instance a tree's root
 * DOMElementTarget created down to every component in it, at construction
 * time, for free - see DOMElementTarget.js's own comment on why nested
 * targets pass the same instance along rather than each minting their
 * own). HTMLTags.js's own tag functions (div(), span(), ...) are what
 * actually call this, reached via getCreator() - whichever component's
 * own build() is running right now.
 *
 * A plain, global, non-reactive lookup - a locator is never itself
 * observed and never changes once a tree's root creates it, so there's
 * nothing here that needs to participate in cascade's own dependency
 * tracking at all.
 *
 * Every HTML tag maps to the same generic DOMElementComponent - unlike a
 * hypothetical native or print platform's own locator, DOM doesn't need
 * any real per-tag dispatch or graceful-degradation logic: a `<div>` and
 * a `<span>` are both just an Element with a different tagName. This is
 * intentionally almost trivial today; a future platform's own locator
 * (or a later, more selective DOM one) is where actual per-tag mapping,
 * fallbacks, or unsupported-tag handling would go - see this file's own
 * git history for the larger idea this is the first, minimal step of.
 */
export class DOMPrimitiveLocator {
  build(tag, properties) {
    return new DOMElementComponent({ tagName: tag, ...properties });
  }
}

// Used by HTMLTags.js's own tag functions only when no creator is
// currently building at all (getCreator() === null) - a component
// constructed eagerly and held for later use (the "hardcoded child
// reference" style - see cascade.component/src/Component.js's own build()
// doc), rather than returned from anyone's build(), has no construction
// chain to reach a real tree's own locator through yet. Every
// DOMPrimitiveLocator behaves identically today (every HTML tag resolves
// to DOMElementComponent regardless of which tree created it), so this is
// a safe stand-in - not a real tree's own instance, just a shared default
// with the exact same behavior. Revisit if a locator ever gains real,
// tree-specific state (per-tree registration, theming, ...): at that
// point eager, outside-build() primitive construction may need its own
// answer instead of silently falling back to this.
export const defaultDOMPrimitiveLocator = new DOMPrimitiveLocator();
