// Registers the mdui web components the Material theme renders (and their
// stylesheet) - browsers only. The theme itself (the service locator) lives
// in src/, free of mdui imports, so it can be tested under node.
import "mdui/mdui.css";
import "mdui/components/button.js";

export { MaterialThemeServiceLocator, materialTheme } from "./src/MaterialTheme.js";
