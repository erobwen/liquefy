import { Component } from "@liquefy/cascade.component";
import { DOMNodeComponent } from "./DOMNodeComponent.js";

/**
 * SingleNodeComponent: the abstract counterpart to DOMNodeComponent - for
 * a component that composes via the ordinary build() style (like any other
 * Component) but wants the type-level guarantee that it still expands to
 * exactly one real DOM node underneath, not zero, not several, and not
 * something that never bottoms out in a real element at all. Concretely:
 * build() must return exactly one DOMNodeComponent (directly, not
 * buried in an array or behind another build() step) - anything else is a
 * programming error, caught here rather than surfacing later as a mysterious
 * failure wherever code assumed that guarantee held (e.g.
 * FlipAnimationContainer, which needs to reach into "the one real element
 * this thing owns" without caring how many build() steps it took to get
 * there).
 *
 * Extend this (not DOMNodeComponent directly) for a build()-composed
 * component that should still count as "a real DOM node" to anything
 * upstream; extend DOMNodeComponent directly only for the other style -
 * hardcoded child references, or owning the one real element yourself (see
 * DOMElementComponent/DOMTextComponent/DOMProvidingElement).
 */
export class SingleNodeComponent extends Component {
  // render() below only verifies what build() returns before rendering it
  // the default way - this is still purely build()-composed, so it can be
  // expanded (see Component.expand()).
  isExpandable() {
    return true;
  }

  render(target, context) {
    // buildOneStep() is cached per run (see its own comment) -
    // calling it here to verify, then again via super.render() below, does
    // not run build() twice.
    const equivalent = this.buildOneStep();
    if (!(equivalent instanceof DOMNodeComponent)) {
      const got = equivalent === null || typeof(equivalent) === "undefined"
        ? String(equivalent)
        : equivalent instanceof Array
          ? "an array of " + equivalent.length
          : equivalent.constructor.name;
      throw new Error(
        this.constructor.name + ".build() must return exactly one DOMNodeComponent, not " + got
      );
    }
    super.render(target, context);
  }
}
