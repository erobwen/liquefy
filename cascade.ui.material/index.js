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

// A guard for an mdui race: a text field starts watching its own size only
// once its first update is done - taken out of the page and put back
// before then (a toolbar trying its tools in place does just that), it
// starts watching twice, and stops only once when removed. The watch left
// over then fires for a field whose input is gone.
const setTextareaHeight = TextField.prototype.setTextareaHeight;
TextField.prototype.setTextareaHeight = function () {
  if (this.inputRef && this.inputRef.value) setTextareaHeight.call(this);
};

export { MaterialThemeServiceLocator, materialTheme, mduiColorVariables, materialDefaultColors } from "./src/MaterialTheme.js";
