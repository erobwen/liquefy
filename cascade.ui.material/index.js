// Registers the mdui web components the Material theme renders (and their
// stylesheet) - browsers only. The theme itself (the service locator) lives
// in src/, free of mdui imports, so it can be tested under node.
import "mdui/mdui.css";
import "mdui/components/button.js";
import "mdui/components/button-icon.js";
import "mdui/components/icon.js";
import "mdui/components/list-item.js";
import { TextField } from "mdui/components/text-field.js";
import "mdui/components/checkbox.js";

// Guards for an mdui race. A text field starts watching its own size only
// once its first update is done, and stops when it leaves the page - but
// taken out and put back (a toolbar trying its tools in place does just
// that) before that update is done, it can start watching twice, or after
// it has left, and it keeps pointing at a watch it has already ended: one
// watch left over fires for a field whose input is gone, and ending one
// twice throws. So: one watch at a time, none for a field no longer in the
// page, and a watch that can be ended more than once - forgotten when it
// is. (Guarded where the field keeps its watch, not in its
// disconnectedCallback(): the browser takes a custom element's lifecycle
// callbacks once, when it's defined - replacing them later does nothing.)
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

export { MaterialThemeServiceLocator, materialTheme, mduiColorVariables, materialDefaultColors } from "./src/MaterialTheme.js";
