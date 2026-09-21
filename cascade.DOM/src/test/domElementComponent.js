import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext } from "@liquefy/cascade.component";
import { DOMTarget } from "../DOMTarget.js";
import { div, h1, p, ul, li } from "../HTMLTags.js";
import { text as textNode, DOMTextComponent } from "../DOMTextComponent.js";

// Exercises the tag-builder layer (HTMLTags -> taggedElement ->
// DOMElementComponent/DOMTextComponent) the way a real component actually uses it:
// build() returning a tree of div/h1/p/ul/li/loose-string-children, the
// same style flow.application/demo/src/pages/introductionPage.js is
// written in - see cascade.application/demo/src/pages/IntroductionPage.js
// for the real, migrated component this proves out.
//
// Note the explicit keys and text(...) wrapping below, and *why*: a
// leading loose string passed alone becomes an *implicit key*, not text
// content, whenever it starts with a lowercase letter (see
// implicitProperties.js's own canBeKey) - faithfully ported from flow's
// own convention, not a bug here. `li("first")` would silently end up
// keyed "first" with no children at all; text("first") sidesteps that
// (an observable component instance is never mistaken for key content),
// and an explicit `key` on each element is what actually lets its own
// real DOM element identity survive a rebuild (see the third test).
describe("DOMElementComponent/HTMLTags (build()-composed real DOM elements)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  class Page extends Component {
    initializeState() {
      return { heading: "Hello", highlighted: false };
    }

    build() {
      return div(
        h1({ key: "heading" }, this.heading),
        p({ key: "intro", style: this.highlighted ? { backgroundColor: "yellow" } : {} }, "A paragraph with a "),
        ul({ key: "list" },
          li({ key: "item1" }, textNode("first")),
          li({ key: "item2" }, textNode("second")),
        ),
        { key: "root", style: { margin: 10 } },
      );
    }
  }

  it("renders a real DOM tree matching the built structure, including loose string children as text nodes", function () {
    const page = new Page();
    page.renderOnto(new RenderContext(new DOMTarget(container)));

    const rootDiv = container.children[0];
    assert.equal(rootDiv.tagName, "DIV");
    assert.equal(rootDiv.style.margin, "10px");

    const h1El = rootDiv.children[0];
    assert.equal(h1El.tagName, "H1");
    assert.equal(h1El.textContent, "Hello");

    const pEl = rootDiv.children[1];
    assert.equal(pEl.tagName, "P");
    assert.equal(pEl.textContent, "A paragraph with a ");

    const ulEl = rootDiv.children[2];
    assert.equal(ulEl.tagName, "UL");
    assert.equal(ulEl.children.length, 2);
    assert.equal(ulEl.children[0].textContent, "first");
    assert.equal(ulEl.children[1].textContent, "second");
  });

  it("diffs attributes/style on a rerun: a style that's no longer set is cleared, not just left stale", function () {
    const page = new Page();
    const context = new RenderContext(new DOMTarget(container));
    page.renderOnto(context);

    const pEl = container.children[0].children[1];
    assert.equal(pEl.style.backgroundColor, "");

    page.highlighted = true;
    assert.equal(pEl.style.backgroundColor, "yellow");

    page.highlighted = false;
    assert.equal(pEl.style.backgroundColor, "", "a style property removed on rerun must be cleared from the real element, not left over from before");
  });

  it("a rerun that changes an unrelated leaf's own text does not recreate the whole tree's real elements", function () {
    const page = new Page();
    const context = new RenderContext(new DOMTarget(container));
    page.renderOnto(context);

    const rootDivBefore = container.children[0];
    const ulElBefore = rootDivBefore.children[2];

    page.heading = "Hello again"; // triggers a rerun on its own - an observable write, same as any other

    assert.equal(container.children[0], rootDivBefore, "the root div's own element identity must survive a rerun");
    assert.equal(container.children[0].children[2], ulElBefore, "an unrelated sibling's element must survive too");
    assert.equal(container.children[0].children[0].textContent, "Hello again");
  });

  // text()'s own dual signature (see DOMTextComponent.js) - `text("value")`
  // (unkeyed, used above) vs `text({key, text})`/`text("value", {key})`
  // (keyed) - and why the keyed form matters: found while building
  // cascade.application/demo's RecursiveDemo, whose whole point is
  // demonstrating minimal DOM updates through a chain of components that
  // *all* rerun their own build() on every change. A loose string child
  // (DOMElementComponent.render()'s own auto-wrap) is always a fresh, unkeyed
  // DOMTextComponent - reconciled by nothing, so a real DOM Text node gets
  // recreated on every single rerun of whatever renders it, even when the
  // text itself doesn't actually change. A keyed text() node instead
  // reconciles to the same DOMTextComponent instance (and so the same real
  // Text node) across reruns, mutating `.data` in place only when the
  // content genuinely differs - the same story DOMElementComponent's own keyed
  // elements already have, just for a leaf text node instead of a tag.
  it("text({key, text}) reconciles to the same real Text node across a rerun, mutating its data in place - unlike an unkeyed loose string child", function () {
    class KeyedPage extends Component {
      initializeState() {
        return { count: 1 };
      }
      build() {
        return div(
          { key: "root" },
          textNode({ key: "counter", text: "Count: " + this.count }),
        );
      }
    }

    const page = new KeyedPage();
    page.renderOnto(new RenderContext(new DOMTarget(container)));

    const rootEl = container.children[0];
    const textNodeBefore = rootEl.childNodes[0];
    assert.equal(textNodeBefore.data, "Count: 1");

    page.count = 2; // rerun - build() reconstructs a fresh text({key:"counter",...}) call every time

    assert.equal(rootEl.childNodes.length, 1, "must not append a second Text node alongside the old one");
    assert.equal(rootEl.childNodes[0], textNodeBefore, "the same real Text node, mutated in place - not a new one");
    assert.equal(textNodeBefore.data, "Count: 2");
  });

  // The actual "minimal updates" story, end to end: a chain of components
  // each rebuilding in full (RecursiveDemo's own List/Item shape,
  // scaled down) - every level's build() reruns on every change, but
  // only the one real DOM node whose content actually differs is ever
  // touched; everything else (including every other level's own wrapper
  // element and unrelated leaf) keeps its exact real DOM identity.
  it("a chain of components that all rebuild in full still leaves every unaffected real DOM node - element or text - untouched", function () {
    class Leaf extends Component {
      setProperties({ depth, shared }) {
        this.depth = depth;
        this.shared = shared;
      }
      build() {
        return div(
          { key: "leaf" },
          textNode({ key: "depthLabel", text: "Depth " + this.depth }), // never changes once constructed
          textNode({ key: "sharedLabel", text: "Shared: " + this.shared }), // changes whenever `shared` does
        );
      }
    }

    class Level extends Component {
      setProperties({ depth, maxDepth, shared }) {
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.shared = shared;
      }
      build() {
        const children = [new Leaf({ key: "leaf", depth: this.depth, shared: this.shared })];
        if (this.depth < this.maxDepth) {
          children.push(new Level({ key: "rest", depth: this.depth + 1, maxDepth: this.maxDepth, shared: this.shared }));
        }
        return div({ key: "level" }, children);
      }
    }

    class Chain extends Component {
      initializeState() {
        return { shared: 1 };
      }
      build() {
        return new Level({ key: "root", depth: 1, maxDepth: 3, shared: this.shared });
      }
      render(context) {
        this.reactiveBuildEquivalent().renderOnto(context);
      }
    }

    const chain = new Chain();
    chain.renderOnto(new RenderContext(new DOMTarget(container)));

    // Walk down: level(1) > [leaf(1), level(2) > [leaf(2), level(3) > [leaf(3)]]]
    const level1El = container.children[0];
    const leaf1El = level1El.children[0];
    const level2El = level1El.children[1];
    const leaf2El = level2El.children[0];
    const level3El = level2El.children[1];
    const leaf3El = level3El.children[0];

    const sharedTextsBefore = [leaf1El, leaf2El, leaf3El].map((leaf) => leaf.childNodes[1]);
    const depthTextsBefore = [leaf1El, leaf2El, leaf3El].map((leaf) => leaf.childNodes[0]);
    sharedTextsBefore.forEach((node) => assert.equal(node.data, "Shared: 1"));

    chain.shared = 2; // every Level and every Leaf's own build() reruns, all the way down

    // Every element and every depth-label Text node kept its own identity...
    assert.equal(container.children[0], level1El);
    assert.equal(level1El.children[0], leaf1El);
    assert.equal(level1El.children[1], level2El);
    assert.equal(level2El.children[0], leaf2El);
    assert.equal(level2El.children[1], level3El);
    assert.equal(level3El.children[0], leaf3El);
    [leaf1El, leaf2El, leaf3El].forEach((leaf, i) => assert.equal(leaf.childNodes[0], depthTextsBefore[i]));

    // ...and the one thing that actually changed - each leaf's own shared-value
    // text - was mutated in place, same Text node, new data, at every level.
    [leaf1El, leaf2El, leaf3El].forEach((leaf, i) => {
      assert.equal(leaf.childNodes[1], sharedTextsBefore[i], "the shared-value Text node must be reused, not recreated");
      assert.equal(leaf.childNodes[1].data, "Shared: 2");
    });
  });

  it("a sibling added after an unrelated rerun still lands after it, not before", function () {
    // Found via cascade.application/demo's RecursiveDemo: touch a value
    // every Leaf inherits (rerunning each Leaf's build(), reusing its
    // existing real element throughout, per the test above), then add a
    // *new* Level as a later sibling of the existing one. Without
    // DOMElementComponent.renderElement() reconfirming a reused element's
    // position on every render (not just on creation), the existing
    // Level's earlier write to target.lastChild gets silently retracted
    // the moment its own repeater is invalidated for that rerun - it never
    // gets rewritten, since reusing an element skips appendElement - so
    // the new sibling's own insertion reads target.lastChild as the
    // baseline (null) and lands *before* the existing one instead of
    // after it.
    class Leaf extends Component {
      setProperties({ depth, shared }) {
        this.depth = depth;
        this.shared = shared;
      }
      build() {
        return div({ key: "leaf" }, textNode({ key: "sharedLabel", text: "Depth " + this.depth + " shared " + this.shared }));
      }
    }

    class Level extends Component {
      setProperties({ depth, maxDepth, shared }) {
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.shared = shared;
      }
      build() {
        const children = [new Leaf({ key: "leaf", depth: this.depth, shared: this.shared })];
        if (this.depth < this.maxDepth) {
          children.push(new Level({ key: "rest", depth: this.depth + 1, maxDepth: this.maxDepth, shared: this.shared }));
        }
        return div({ key: "level" }, children);
      }
    }

    class Chain extends Component {
      initializeState() {
        return { maxDepth: 1, shared: 1 };
      }
      build() {
        return new Level({ key: "root", depth: 1, maxDepth: this.maxDepth, shared: this.shared });
      }
      render(context) {
        this.reactiveBuildEquivalent().renderOnto(context);
      }
    }

    const chain = new Chain();
    chain.renderOnto(new RenderContext(new DOMTarget(container)));

    const level1El = container.children[0];
    const leaf1El = level1El.children[0];

    chain.shared = 2; // Leaf reruns, reusing its existing element - no structural change yet
    assert.equal(level1El.children[0], leaf1El, "leaf keeps its identity across the unrelated rerun");

    chain.maxDepth = 2; // a brand new Level joins as leaf1's sibling, right after it

    assert.equal(level1El.children.length, 2);
    assert.equal(level1El.children[0], leaf1El, "the pre-existing leaf must still come first");
    assert.equal(level1El.children[0].textContent, "Depth 1 shared 2");
    assert.equal(level1El.children[1].textContent, "Depth 2 shared 2");
  });

  it("adding a level does not move any real node that was already correctly positioned", function () {
    // Robert, watching the real RecursiveDemo in DevTools: adding a level
    // showed changes all the way down to the root, not just the one new
    // node - because every existing Level/Item's own maxDepth property
    // changes too (same shared value, rewritten at every depth), so every
    // one of them reruns and, per the test above, reconfirms its element's
    // position every time it reruns - which used to always mean a real
    // insertBefore(), even into the exact spot the element already
    // occupied. Real insertBefore() is never a true no-op: it fires
    // mutation records (what makes DevTools' Elements panel flash), can
    // restart a CSS transition, and can steal focus - so growing the chain
    // should move only the brand-new node, not reconfirm-move everything
    // above it too.
    class Leaf extends Component {
      setProperties({ depth }) {
        this.depth = depth;
      }
      build() {
        return div({ key: "leaf" }, textNode({ key: "depthLabel", text: "Depth " + this.depth }));
      }
    }

    class Level extends Component {
      setProperties({ depth, maxDepth }) {
        this.depth = depth;
        this.maxDepth = maxDepth;
      }
      build() {
        const children = [new Leaf({ key: "leaf", depth: this.depth })];
        if (this.depth < this.maxDepth) {
          children.push(new Level({ key: "rest", depth: this.depth + 1, maxDepth: this.maxDepth }));
        }
        return div({ key: "level" }, children);
      }
    }

    class Chain extends Component {
      initializeState() {
        return { maxDepth: 3 };
      }
      build() {
        return new Level({ key: "root", depth: 1, maxDepth: this.maxDepth });
      }
      render(context) {
        this.reactiveBuildEquivalent().renderOnto(context);
      }
    }

    const chain = new Chain();
    chain.renderOnto(new RenderContext(new DOMTarget(container)));

    let moveCount = 0;
    const NodePrototype = document.defaultView.Node.prototype;
    const originalInsertBefore = NodePrototype.insertBefore;
    NodePrototype.insertBefore = function (...args) {
      moveCount++;
      return originalInsertBefore.apply(this, args);
    };
    try {
      chain.maxDepth = 4; // every existing Level/Leaf reruns (maxDepth changed for all of them), one brand-new Level+Leaf pair joins at the end
    } finally {
      NodePrototype.insertBefore = originalInsertBefore;
    }

    // Exactly the three brand-new real nodes (the new Level's own div, its
    // Leaf's div, and that Leaf's own text node) ever needed to move -
    // nothing pre-existing did, even though every pre-existing Level's own
    // div did reconfirm its position this same rerun.
    assert.equal(moveCount, 3);
  });
});
