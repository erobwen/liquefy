import { JSDOM } from "jsdom";
import assert from "assert";
import { Component, RenderContext, observable } from "@liquefy/cascade.component";
import { DOMElementTarget } from "../DOMElementTarget.js";
import { div, p, span, h1, h2, ul, li } from "../HTMLTags.js";
import { text } from "../DOMTextComponent.js";

// Pattern matching: what a rebuild constructs without a key is matched to
// what the previous build constructed in the same place - same class, and
// for a DOM element the same tag - and keeps its identity, state and DOM,
// as a key would have (see Component.reactiveBuildEquivalent()'s
// rebuildShapeAnalysis, and cascade.reactive's "Rebuild shape analysis").
describe("Pattern matching (rebuilding without keys)", function () {
  let container;

  beforeEach(function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    container = document.createElement("div");
  });

  const render = (component) => component.renderOnto(new RenderContext(new DOMElementTarget(container)));
  const html = () => container.innerHTML.replace(/ id="[^"]*"/g, "");

  // Counts its builds, and remembers every one of its instances that got
  // disposed.
  const disposed = [];
  class Counter extends Component {
    setProperties({ label }) {
      this.label = label;
    }
    initializeState() {
      return { count: 0 };
    }
    build() {
      return p(text(this.label + " " + this.count));
    }
    onDispose() {
      // The instance, not its label: a disposed component's properties are
      // retracted with its creator's build.
      disposed.push(this);
      super.onDispose();
    }
  }

  // Reads the counters' identities from the build's result: what's
  // actually rendered, not a closure's reference to a throwaway twin.
  function countersIn(page) {
    const found = [];
    const walk = (value) => {
      if (value instanceof Array) return value.forEach(walk);
      if (value instanceof Counter) found.push(value);
      else if (value && value.children) walk(value.children);
    };
    walk(page.newBuild);
    return found;
  }

  it("static children without keys keep their identity, state and elements through a rebuild", function () {
    const model = observable({ title: "one" });
    class Page extends Component {
      build() {
        return div(p(text(model.title)), new Counter({ label: "count" }), span(text("static")));
      }
    }
    const page = new Page();
    render(page);
    const [counter] = countersIn(page);
    counter.count = 5;
    const elements = Array.from(container.querySelectorAll("*"));

    model.title = "two";
    assert.equal(html(), "<div><p>two</p><p>count 5</p><span>static</span></div>");
    assert.equal(countersIn(page)[0], counter, "the same counter");
    assert.deepEqual(Array.from(container.querySelectorAll("*")), elements, "every element kept");
    assert.deepEqual(disposed, []);
  });

  it("a different class, or a different tag, in the same place is a new one - and the old one is disposed", function () {
    disposed.length = 0;
    class Other extends Component {
      build() {
        return p(text("other"));
      }
    }
    const model = observable({ other: false, big: true });
    class Page extends Component {
      build() {
        return div(
          (model.big ? h1 : h2)(text("title")),
          model.other ? new Other() : new Counter({ label: "count" }),
        );
      }
    }
    const page = new Page();
    render(page);
    const heading = container.querySelector("h1");
    const [counter] = countersIn(page);
    counter.count = 3;

    model.big = false;
    assert.equal(html(), "<div><h2>title</h2><p>count 3</p></div>", "tag changed: a new element; the counter kept");
    assert.notEqual(container.querySelector("h2"), heading);

    model.other = true;
    assert.equal(html(), "<div><h2>title</h2><p>other</p></div>");
    assert.ok(disposed.length === 1 && disposed[0] === counter, "the counter replaced, and disposed");

    model.other = false;
    assert.equal(html(), "<div><h2>title</h2><p>count 0</p></div>", "back: a new counter, with fresh state");
  });

  it("keyed items move with their keys, while the unkeyed siblings around them are matched in order", function () {
    const model = observable({ order: ["a", "b", "c"] });
    class Page extends Component {
      build() {
        return ul(
          li(text("first")),
          ...model.order.map((key) => new Counter({ key, label: key })),
          li(text("last")),
        );
      }
    }
    const page = new Page();
    render(page);
    const [a, b, c] = countersIn(page);
    a.count = 1;
    b.count = 2;
    c.count = 3;
    const first = container.querySelector("li");

    model.order = ["c", "a", "b"];
    assert.equal(html(), "<ul><li>first</li><p>c 3</p><p>a 1</p><p>b 2</p><li>last</li></ul>");
    assert.deepEqual(countersIn(page), [c, a, b]);
    assert.equal(container.querySelector("li"), first, "the unkeyed item before them kept");
  });

  it("unkeyed children of a keyed parent are matched too", function () {
    const model = observable({ title: "one" });
    class Page extends Component {
      build() {
        return div({ key: "panel" }, span(text(model.title)), new Counter({ label: "inside" }));
      }
    }
    const page = new Page();
    render(page);
    countersIn(page)[0].count = 4;
    model.title = "two";
    assert.equal(html(), "<div><span>two</span><p>inside 4</p></div>");
  });

  it("what a keyed component built but not shown holds stays alive with it, through rebuilds while hidden", function () {
    const model = observable({ open: true, title: "one" });
    class Page extends Component {
      build() {
        return div(
          p(text(model.title)),
          div({ key: "drawer" }, new Counter({ label: "inside" })).show(model.open),
        );
      }
    }
    const page = new Page();
    render(page);
    const panel = page.newBuild.children[1];
    panel.children[0].count = 6;

    model.open = false;
    model.title = "two";
    model.title = "three";
    model.open = true;
    assert.equal(html(), "<div><p>three</p><div><p>inside 6</p></div></div>");
  });

  it("matching records no dependencies: changing a built child doesn't rebuild the builder", function () {
    const model = observable({ title: "one" });
    let builds = 0;
    class Page extends Component {
      build() {
        builds++;
        return div(p(text(model.title)), new Counter({ label: "count" }));
      }
    }
    const page = new Page();
    render(page);
    model.title = "two"; // a rebuild - matching, and the shape taken
    assert.equal(builds, 2);
    // Taking the shape reads every property of what it built - its state
    // among them. Recorded, this would rebuild the page.
    countersIn(page)[0].count = 7;
    assert.equal(builds, 2, "not rebuilt by what it built");
    assert.equal(html(), "<div><p>two</p><p>count 7</p></div>");
  });

  it("a rebuilt children array stays frozen - compared by content, not rerendering what didn't change", function () {
    const model = observable({ title: "one" });
    class Page extends Component {
      build() {
        return div(p(text(model.title)), span(text("static")));
      }
    }
    const page = new Page();
    render(page);
    model.title = "two";
    const root = page.newBuild;
    assert.ok(Object.isFrozen(root.children), "still frozen after its references were replaced");
    assert.equal(html(), "<div><p>two</p><span>static</span></div>");
  });
});
