import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, ObservableCompoundServiceLocator, observable } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { DOMServiceLocator } from "../DOMServiceLocator.js";
import { DOMNodeRenderComponent } from "../DOMNodeRenderComponent.js";
import { FlipAnimationContainer, flipAnimationContainer } from "../FlipAnimationContainer.js";
import { div, span, p, button, h1, h2, ul, li } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// FlipAnimationContainer, before any animation: it places its whole
// subtree itself (expanding every child down to components that provide
// their own node - see Component.expand() - and putting those nodes in
// order), and
// the result has to be exactly what rendering the same subtree normally
// gives. Every scenario below builds the same app twice - once inside a
// plain div, once inside the container - drives both through the same
// changes, and compares them.
describe("FlipAnimationContainer (placement, no animation yet)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  // The DOM without what legitimately differs: debug ids (component
  // numbering), and island holders (the elements the container renders
  // islands into, to give them a box of their own).
  function normalized(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("[id]").forEach((each) => each.removeAttribute("id"));
    clone.querySelectorAll("[data-flip-island]").forEach((each) => each.replaceWith(...each.childNodes));
    return clone.innerHTML;
  }

  // Renders `makeApp(withContainer)` twice - as a plain div and through the
  // container - side by side; returns both roots and both app components.
  function renderBoth(makeApp, serviceLocator) {
    const plainRoot = document.createElement("div");
    const flipRoot = document.createElement("div");
    const plain = makeApp(false);
    const flip = makeApp(true);
    plain.renderOnto(new RenderContext(new DOMElementTarget(plainRoot), { serviceLocator }));
    flip.renderOnto(new RenderContext(new DOMElementTarget(flipRoot), { serviceLocator }));
    return { plainRoot, flipRoot, plain, flip };
  }

  const same = ({ plainRoot, flipRoot }, message) => assert.equal(normalized(flipRoot), normalized(plainRoot), message);

  class Item extends Component {
    initializeState() {
      return { count: 0 };
    }
    build() {
      return li({ key: "item" }, text({ key: "label", text: this.label + ": " + this.count }));
    }
  }

  class List extends Component {
    initializeState() {
      return { order: ["a", "b", "c"], title: "Title", big: true };
    }
    build() {
      const heading = this.big ? h1 : h2;
      return [
        heading({ key: "heading" }, text({ key: "headingText", text: this.title })),
        p({ key: "intro" }, "Loose text, ", span({ key: "inline" }, text("inline")), " and more."),
        ul({ key: "list" }, this.order.map((key) => new Item({ key, label: key.toUpperCase() }))),
        p({ key: "hidden" }, text("not shown")).show(false),
      ];
    }
  }

  // The app: a plain wrapping div, or the container, around the same list.
  const app = (children, Container = FlipAnimationContainer) => (withContainer) => {
    class App extends Component {
      build() {
        return withContainer
          ? new Container({ key: "root", style: { padding: 8 } }, children())
          : div({ key: "root", style: { padding: 8 } }, children());
      }
    }
    return new App();
  };

  function listOf(appComponent) {
    // App -> root (div/container) -> the List it was built with.
    return appComponent.newBuild.children[0];
  }

  it("renders the same DOM as rendering normally - nested builds, arrays, loose and keyed text, show(false)", function () {
    const both = renderBoth(app(() => [new List({ key: "list" })]));
    same(both);
    assert.ok(both.flipRoot.querySelector("h1"));
    assert.equal(both.flipRoot.querySelectorAll("li").length, 3);
  });

  it("stays the same through state changes, reordering, adding, removing and a tag change - reusing every element it can", function () {
    const both = renderBoth(app(() => [new List({ key: "list" })]));
    const lists = [listOf(both.plain), listOf(both.flip)];
    const itemElements = () => Array.from(both.flipRoot.querySelectorAll("li"));
    const [a, b, c] = itemElements();

    lists.forEach((list) => { list.title = "Renamed"; });
    same(both, "state change");

    lists.forEach((list) => { list.order = ["c", "a", "b"]; });
    same(both, "reorder");
    assert.deepEqual(itemElements(), [c, a, b], "the same elements, moved");

    lists.forEach((list) => { list.order = ["c", "d", "a", "b"]; });
    same(both, "add");
    assert.deepEqual([itemElements()[0], itemElements()[2], itemElements()[3]], [c, a, b]);

    lists.forEach((list) => { list.order = ["d", "b"]; });
    same(both, "remove");
    assert.equal(itemElements()[1], b);

    const heading = both.flipRoot.querySelector("h1");
    const headingText = heading.firstChild;
    lists.forEach((list) => { list.big = false; });
    same(both, "tag change");
    assert.equal(both.flipRoot.querySelector("h2").firstChild, headingText, "the heading's text node moved over");
  });

  it("an item's own state survives its container's rebuilds", function () {
    const both = renderBoth(app(() => [new List({ key: "list" })]));
    const list = listOf(both.flip);
    const flipItems = () => list.newBuild[2].children;
    flipItems()[1].count = 5;
    list.order = ["b", "a", "c"];
    assert.equal(both.flipRoot.querySelectorAll("li")[0].textContent, "B: 5");
  });

  it("builds find their services through the render context - including a runtime swap", function () {
    class RedButtons {
      locate(query) {
        if (query.type !== "htmlElement" || query.name !== "button") return undefined;
        return new DOMServiceLocator().locate({ ...query, properties: { ...query.properties, style: { color: "red" } } });
      }
    }
    class Buttons extends Component {
      build() {
        return div({ key: "buttons" }, button({ key: "save" }, "Save"));
      }
    }
    const services = new ObservableCompoundServiceLocator(new DOMServiceLocator());
    const both = renderBoth(app(() => [new Buttons({ key: "buttons" })]), services);
    same(both);

    services.locators.unshift(new RedButtons());
    same(both, "after the swap");
    assert.equal(both.flipRoot.querySelector("button").style.color, "red");
  });

  it("islands - components that can only be rendered - render normally inside it, and edit without rerunning the container", function () {
    class Counter extends DOMNodeRenderComponent {
      initializeState() {
        return { value: 0 };
      }
      renderElement(context, existingElement) {
        const element = existingElement || document.createElement("output");
        context.target.reattachElement(element);
        element.textContent = "value " + this.value;
        return element;
      }
    }
    // Counts its own runs - a subclass, since patching render() on an
    // instance would itself be a write the container's render depends on.
    class CountingContainer extends FlipAnimationContainer {
      render(context) {
        this.unobservable.runs = (this.unobservable.runs || 0) + 1;
        super.render(context);
      }
    }
    let counters = [];
    const both = renderBoth(app(() => {
      const counter = new Counter({ key: "counter" });
      counters.push(counter);
      return [p({ key: "before" }, text("before")), counter, p({ key: "after" }, text("after"))];
    }, CountingContainer));
    same(both);

    const flipContainer = both.flip.newBuild;
    assert.ok(flipContainer instanceof FlipAnimationContainer);
    const runsBefore = flipContainer.unobservable.runs;

    counters.forEach((counter) => { counter.value = 7; });
    same(both, "after an edit inside the island");
    assert.equal(both.flipRoot.querySelector("output").textContent, "value 7");
    assert.equal(flipContainer.unobservable.runs, runsBefore, "the island reran on its own - the container didn't");
  });

  it("while hidden, the builds of the components it expanded don't run - they're pulled, and revalidated once, when it's shown again", function () {
    // The container is what pulls those builds (they're never rendered
    // themselves - see Component.reactiveBuildEquivalent()'s pulledBy), so
    // while it's hidden they wait, like any hidden component's build.
    const model = observable({ show: true, label: "one" });
    class Labelled extends Component {
      build() {
        this.unobservable.builds = (this.unobservable.builds || 0) + 1;
        return p({ key: "label" }, text({ key: "text", text: model.label }));
      }
    }
    const labelled = new Labelled({ key: "labelled" });
    class Frame extends Component {
      render(context) {
        if (model.show) this.flip.renderOnto(context);
      }
    }
    const frame = new Frame();
    frame.flip = flipAnimationContainer({ key: "flip" }, labelled);
    frame.renderOnto(new RenderContext(new DOMElementTarget(container)));
    assert.equal(labelled.unobservable.builds, 1);

    model.show = false;
    model.label = "two";
    model.label = "three";
    assert.equal(labelled.unobservable.builds, 1, "not rebuilt while hidden");

    model.show = true;
    assert.equal(labelled.unobservable.builds, 2, "rebuilt once, when shown");
    assert.equal(container.querySelector("p").textContent, "three");
  });

  it("hidden and shown again, it comes back with its elements and state", function () {
    const model = observable({ show: true });
    const list = new List({ key: "list" });
    class Frame extends Component {
      render(context) {
        if (model.show) this.flip.renderOnto(context);
      }
    }
    const frame = new Frame();
    frame.flip = flipAnimationContainer({ key: "flip" }, list);
    frame.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const items = Array.from(container.querySelectorAll("li"));
    list.title = "Before hiding";

    model.show = false;
    assert.equal(container.querySelectorAll("li").length, 0);
    list.order = ["b", "c", "a"];

    model.show = true;
    assert.deepEqual(Array.from(container.querySelectorAll("li")), [items[1], items[2], items[0]]);
    assert.equal(container.querySelector("h1").textContent, "Before hiding");
  });

  it("tells what it places when it's shown and hidden, as rendering would - with no DOM mechanics", function () {
    // Build-composed, so the container expands (places) it rather than
    // rendering it; records the notifications it gets.
    class Watched extends Component {
      initialUnobservables() {
        return { events: [] };
      }
      build() {
        return p({ key: "watchedText" }, text({ key: "text", text: "watched" }));
      }
      onShow() {
        this.unobservable.events.push("show");
      }
      onHide() {
        this.unobservable.events.push("hide");
      }
    }
    const model = observable({ inTree: true, pageShown: true });
    const watched = new Watched({ key: "watched" });
    class Frame extends Component {
      render(context) {
        if (model.pageShown) this.flip.renderOnto(context);
      }
    }
    class Holder extends Component {
      build() {
        return model.inTree ? watched : null;
      }
    }
    const frame = new Frame();
    frame.flip = flipAnimationContainer({ key: "flip" }, new Holder({ key: "holder" }));
    frame.renderOnto(new RenderContext(new DOMElementTarget(container)));
    const events = () => watched.unobservable.events;
    assert.deepEqual(events(), ["show"], "placed: shown");
    assert.equal(container.querySelector("p").textContent, "watched");

    model.inTree = false;
    assert.deepEqual(events(), ["show", "hide"], "no longer in the tree: hidden");
    model.inTree = true;
    assert.deepEqual(events(), ["show", "hide", "show"]);

    model.pageShown = false;
    assert.deepEqual(events(), ["show", "hide", "show", "hide"], "the container hidden: so is what it placed");
    model.pageShown = true;
    assert.deepEqual(events(), ["show", "hide", "show", "hide", "show"]);
    assert.equal(container.querySelector("p").textContent, "watched", "and it's all back");
  });
});
