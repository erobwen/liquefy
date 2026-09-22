import { Component } from "@liquefy/cascade.component";
import { DOMNodeRenderComponent } from "./DOMNodeRenderComponent.js";

/**
 * DOMNodeComponent: the abstract counterpart to DOMNodeRenderComponent - for
 * a component that composes via the ordinary build() style (like any other
 * Component) but wants the type-level guarantee that it still expands to
 * exactly one real DOM node underneath, not zero, not several, and not
 * something that never bottoms out in a real element at all. Concretely:
 * build() must return exactly one DOMNodeRenderComponent (directly, not
 * buried in an array or behind another build() step) - anything else is a
 * programming error, caught here rather than surfacing later as a mysterious
 * failure wherever code assumed that guarantee held (e.g. a future
 * FlipAnimationContainer, which needs to reach into "the one real element
 * this thing owns" without caring how many build() steps it took to get
 * there).
 *
 * Extend this (not DOMNodeRenderComponent directly) for a build()-composed
 * component that should still count as "a real DOM node" to anything
 * upstream; extend DOMNodeRenderComponent directly only for the other style -
 * hardcoded child references, or owning the one real element yourself (see
 * DOMElementComponent/DOMTextComponent/DOMContextContainer).
 */
export class DOMNodeComponent extends Component {
  render(context) {
    // reactiveBuildEquivalent() is cached per run (see its own comment) -
    // calling it here to verify, then again via super.render() below, does
    // not run build() twice.
    const equivalent = this.reactiveBuildEquivalent();
    if (!(equivalent instanceof DOMNodeRenderComponent)) {
      const got = equivalent === null || typeof(equivalent) === "undefined"
        ? String(equivalent)
        : equivalent instanceof Array
          ? "an array of " + equivalent.length
          : equivalent.constructor.name;
      throw new Error(
        this.constructor.name + ".build() must return exactly one DOMNodeRenderComponent, not " + got
      );
    }
    super.render(context);
  }
}
