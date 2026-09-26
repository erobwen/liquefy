/**
 * A guard for an mdui race. An mdui component that takes focus (a text
 * field, a checkbox, a button, ...) sets up its focus handling in its first
 * update, on an element inside its template - found through a reference
 * that is only set while the component is in the page. Flow can take a
 * component out of the page again before that first update has run (a page
 * being built, an element being moved), and then the setup finds nothing
 * there, and throws.
 *
 * So a first update that runs while the component is out of the page waits:
 * for the component to be back in the page - with its references restored -
 * and runs then. One that is never back in the page never needed it.
 */
const focusableTags = [
  "mdui-button", "mdui-button-icon", "mdui-fab", "mdui-chip", "mdui-segmented-button",
  "mdui-checkbox", "mdui-radio", "mdui-switch", "mdui-slider", "mdui-range-slider",
  "mdui-text-field", "mdui-select", "mdui-list-item", "mdui-menu-item", "mdui-tab",
  "mdui-navigation-bar-item", "mdui-navigation-rail-item", "mdui-card",
];

const guarded = new WeakSet();

for (const tag of focusableTags) {
  const Element = customElements.get(tag);
  if (!Element || guarded.has(Element)) continue;
  guarded.add(Element);
  const firstUpdated = Element.prototype.firstUpdated;
  Element.prototype.firstUpdated = function (changedProperties) {
    if (this.isConnected || this.focusElement) return firstUpdated.call(this, changedProperties);
    const element = this;
    const controller = {
      hostConnected() {
        element.removeController(controller);
        // Its references are restored just after its controllers are told.
        queueMicrotask(() => {
          if (element.focusElement) firstUpdated.call(element, changedProperties);
        });
      },
    };
    this.addController(controller);
  };
}

/**
 * And the same race for a text field's size: it starts watching its own
 * size only once its first update is done, and stops when it leaves the
 * page - but taken out and put back before that update is done, it can
 * start watching twice, or after it has left, and it keeps pointing at a
 * watch it has already ended. So: one watch at a time, none for a field no
 * longer in the page, a watch that can be ended more than once, and no
 * resizing for a field whose input isn't there. (The same guards as
 * @liquefy/cascade.ui.material's.)
 */
const TextField = customElements.get("mdui-text-field");
if (TextField && !guarded.has(TextField.prototype)) {
  guarded.add(TextField.prototype);
  const watches = new WeakMap();
  Object.defineProperty(TextField.prototype, "observeResize", {
    configurable: true,
    get() {
      return watches.get(this);
    },
    set(watch) {
      const previous = watches.get(this);
      if (previous && previous !== watch) previous.unobserve();
      if (!watch) {
        watches.delete(this);
        return;
      }
      const end = watch.unobserve;
      let ended = false;
      watch.unobserve = () => {
        if (ended) return;
        ended = true;
        end();
        if (watches.get(this) === watch) watches.delete(this);
      };
      watches.set(this, watch);
      if (!this.isConnected) watch.unobserve();
    },
  });
  const setTextareaHeight = TextField.prototype.setTextareaHeight;
  TextField.prototype.setTextareaHeight = function () {
    if (this.inputRef && this.inputRef.value) setTextareaHeight.call(this);
  };
}
