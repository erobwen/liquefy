import assert from "assert";
import { observable } from "../Cascade.js";
import { Component } from "../Component.js";
import { RenderContext } from "../RenderContext.js";

// A component dropped for good takes everything its build constructed with
// it - also what it built but wasn't showing. Otherwise, inside a container
// that expands its subtree (see cascade.DOM's FlipAnimationContainer), such
// a component's build stays alive, pulled by the container, and builds once
// more after its creator is gone - its properties, that creator's writings,
// retracted: undefined.
describe("disposing what a dropped component built", function () {
  const context = () => new RenderContext({ name: "target" });
  const isLeaf = (component) => component instanceof Leaf;

  class Leaf extends Component {
    setProperties({ label }) {
      this.label = label;
    }
    build() {
      return null;
    }
  }

  // Reads its item's own data - undefined, if built without its properties.
  class Item extends Component {
    setProperties({ item }) {
      this.item = item;
    }
    build() {
      return new Leaf({ key: "leaf", label: "item " + this.item.weight });
    }
  }

  // Its items in a drawer: built while open, left out while closed.
  class Form extends Component {
    setProperties({ form }) {
      this.form = form;
    }
    build() {
      const items = this.form.items.map((item) => new Item({ key: "item" + item.id, item }));
      return [new Leaf({ key: "title", label: "form " + this.form.id }), ...(this.form.open ? items : [])];
    }
  }

  class List extends Component {
    setProperties({ data }) {
      this.data = data;
    }
    build() {
      return this.data.forms.map((form) => new Form({ key: "form" + form.id, form }));
    }
  }

  // Expands the list itself, as a placing container would.
  class Expanding extends Component {
    constructor(list) {
      super();
      this.list = list;
    }
    initialUnobservables() {
      return { labels: [] };
    }
    render(renderContext) {
      this.unobservable.labels = this.list.expand(renderContext, this, isLeaf).map((leaf) => leaf.label);
    }
  }

  it("a closed drawer's items are disposed with their form - never built again without their properties", function () {
    const data = observable({ forms: observable([]) });
    const first = observable({ id: 1, open: true, items: observable([observable({ id: 1, weight: 3 })]) });
    data.forms.push(first);
    const list = new List({ data });
    const expanding = new Expanding(list);
    expanding.renderOnto(context());
    assert.deepEqual(expanding.unobservable.labels, ["form 1", "item 3"]);

    const item = list.newBuild[0].newBuild[1];
    first.open = false;
    assert.deepEqual(expanding.unobservable.labels, ["form 1"], "closed: the item built, but left out");

    // Removing the form: its item must go with it, not build again.
    data.forms.splice(0, 1);
    assert.deepEqual(expanding.unobservable.labels, []);
    assert.ok(item.unobservable.buildRepeater.retracted, "the closed drawer's item is disposed too");
  });
});
