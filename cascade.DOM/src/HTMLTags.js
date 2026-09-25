import { toPropertiesWithChildren, toProperties, locateService } from "@liquefy/cascade.component";
import { defaultDOMServiceLocator } from "./DOMServiceLocator.js";

/**
 * HTML tags - ported from flow.DOM/src/HTMLTags.js: same ~100-tag list,
 * same one-line-per-tag mechanical shape (`locateElement(tagName,
 * toPropertiesWithChildren(parameters))`), same grouping/order, so the two
 * files stay easy to compare. Flow's own `button`/`input` went through
 * toButtonProperties()/toInputProperties() - implicit-argument parsing
 * tied to flow.core's own two-way-binding convention (a loose function
 * argument becomes onclick, a {getter, setter} pair becomes a bound
 * input) - which cascade hasn't adopted, so both stay plain
 * toPropertiesWithChildren() here, same as every other tag; add that
 * convention later, on top of this, if cascade ever wants it. `br` is the
 * one void element with no children at all, hence toProperties() instead.
 *
 * Each tag function asks the service locator in the render context of the
 * component whose build() is running (see cascade.component's
 * ServiceLocator.js) for `{ type: "htmlElement", name: tag, properties }`,
 * rather than constructing DOMElementComponent directly - normally
 * answered by cascade.dom's DOMServiceLocator. A tag function called from
 * anywhere inside build() (however deeply nested in ordinary JS argument
 * position, e.g. `div(h1(...), p(...))`) resolves against whichever
 * component's build() is actually running. This is what makes the same
 * `div()` call able to resolve to a different platform's own element -
 * or to a theme's restyled one - without this file itself ever changing.
 */
function locateElement(tag, properties) {
  return locateService({ type: "htmlElement", name: tag, properties }, defaultDOMServiceLocator);
}

// Any element by tag name, for tags not listed below - custom elements
// especially (`element("mdui-button", {...}, "Save")`).
export const element = (tagName, ...parameters) => locateElement(tagName, toPropertiesWithChildren(parameters));

// Content sectioning / structure
export const address = (...parameters) => locateElement("address", toPropertiesWithChildren(parameters));
export const article = (...parameters) => locateElement("article", toPropertiesWithChildren(parameters));
export const aside = (...parameters) => locateElement("aside", toPropertiesWithChildren(parameters));
export const footer = (...parameters) => locateElement("footer", toPropertiesWithChildren(parameters));
export const header = (...parameters) => locateElement("header", toPropertiesWithChildren(parameters));
export const h1 = (...parameters) => locateElement("h1", toPropertiesWithChildren(parameters));
export const h2 = (...parameters) => locateElement("h2", toPropertiesWithChildren(parameters));
export const h3 = (...parameters) => locateElement("h3", toPropertiesWithChildren(parameters));
export const h4 = (...parameters) => locateElement("h4", toPropertiesWithChildren(parameters));
export const h5 = (...parameters) => locateElement("h5", toPropertiesWithChildren(parameters));
export const h6 = (...parameters) => locateElement("h6", toPropertiesWithChildren(parameters));
export const group = (...parameters) => locateElement("group", toPropertiesWithChildren(parameters));
export const main = (...parameters) => locateElement("main", toPropertiesWithChildren(parameters));
export const nav = (...parameters) => locateElement("nav", toPropertiesWithChildren(parameters));
export const section = (...parameters) => locateElement("section", toPropertiesWithChildren(parameters));
export const search = (...parameters) => locateElement("search", toPropertiesWithChildren(parameters));

// Text content
export const blockquote = (...parameters) => locateElement("blockquote", toPropertiesWithChildren(parameters));
export const dd = (...parameters) => locateElement("dd", toPropertiesWithChildren(parameters));
export const div = (...parameters) => locateElement("div", toPropertiesWithChildren(parameters));
export const dl = (...parameters) => locateElement("dl", toPropertiesWithChildren(parameters));
export const dt = (...parameters) => locateElement("dt", toPropertiesWithChildren(parameters));
export const figcaption = (...parameters) => locateElement("figcaption", toPropertiesWithChildren(parameters));
export const figure = (...parameters) => locateElement("figure", toPropertiesWithChildren(parameters));
export const hr = (...parameters) => locateElement("hr", toPropertiesWithChildren(parameters));
export const li = (...parameters) => locateElement("li", toPropertiesWithChildren(parameters));
export const menu = (...parameters) => locateElement("menu", toPropertiesWithChildren(parameters));
export const ol = (...parameters) => locateElement("ol", toPropertiesWithChildren(parameters));
export const p = (...parameters) => locateElement("p", toPropertiesWithChildren(parameters));
export const pre = (...parameters) => locateElement("pre", toPropertiesWithChildren(parameters));
export const ul = (...parameters) => locateElement("ul", toPropertiesWithChildren(parameters));

// Inline text semantics
export const a = (...parameters) => locateElement("a", toPropertiesWithChildren(parameters));
export const abbr = (...parameters) => locateElement("abbr", toPropertiesWithChildren(parameters));
export const b = (...parameters) => locateElement("b", toPropertiesWithChildren(parameters));
export const bdi = (...parameters) => locateElement("bdi", toPropertiesWithChildren(parameters));
export const bdo = (...parameters) => locateElement("bdo", toPropertiesWithChildren(parameters));
export const br = (...parameters) => locateElement("br", toProperties(parameters));
export const cite = (...parameters) => locateElement("cite", toPropertiesWithChildren(parameters));
export const code = (...parameters) => locateElement("code", toPropertiesWithChildren(parameters));
export const data = (...parameters) => locateElement("data", toPropertiesWithChildren(parameters));
export const dfn = (...parameters) => locateElement("dfn", toPropertiesWithChildren(parameters));
export const em = (...parameters) => locateElement("em", toPropertiesWithChildren(parameters));
export const i = (...parameters) => locateElement("i", toPropertiesWithChildren(parameters));
export const kbd = (...parameters) => locateElement("kbd", toPropertiesWithChildren(parameters));
export const mark = (...parameters) => locateElement("mark", toPropertiesWithChildren(parameters));
export const q = (...parameters) => locateElement("q", toPropertiesWithChildren(parameters));
export const rp = (...parameters) => locateElement("rp", toPropertiesWithChildren(parameters));
export const rt = (...parameters) => locateElement("rt", toPropertiesWithChildren(parameters));
export const ruby = (...parameters) => locateElement("ruby", toPropertiesWithChildren(parameters));
export const s = (...parameters) => locateElement("s", toPropertiesWithChildren(parameters));
export const samp = (...parameters) => locateElement("samp", toPropertiesWithChildren(parameters));
export const small = (...parameters) => locateElement("small", toPropertiesWithChildren(parameters));
export const span = (...parameters) => locateElement("span", toPropertiesWithChildren(parameters));
export const strong = (...parameters) => locateElement("strong", toPropertiesWithChildren(parameters));
export const sub = (...parameters) => locateElement("sub", toPropertiesWithChildren(parameters));
export const sup = (...parameters) => locateElement("sup", toPropertiesWithChildren(parameters));
export const time = (...parameters) => locateElement("time", toPropertiesWithChildren(parameters));
export const u = (...parameters) => locateElement("u", toPropertiesWithChildren(parameters));
export const htmlVar = (...parameters) => locateElement("var", toPropertiesWithChildren(parameters));
export const wbr = (...parameters) => locateElement("wbr", toPropertiesWithChildren(parameters));

// Image and multimedia / embedded content
export const area = (...parameters) => locateElement("area", toPropertiesWithChildren(parameters));
export const audio = (...parameters) => locateElement("audio", toPropertiesWithChildren(parameters));
export const img = (...parameters) => locateElement("img", toPropertiesWithChildren(parameters));
export const map = (...parameters) => locateElement("map", toPropertiesWithChildren(parameters));
export const track = (...parameters) => locateElement("track", toPropertiesWithChildren(parameters));
export const video = (...parameters) => locateElement("video", toPropertiesWithChildren(parameters));
export const embed = (...parameters) => locateElement("embed", toPropertiesWithChildren(parameters));
export const iframe = (...parameters) => locateElement("iframe", toPropertiesWithChildren(parameters));
export const object = (...parameters) => locateElement("object", toPropertiesWithChildren(parameters));
export const picture = (...parameters) => locateElement("picture", toPropertiesWithChildren(parameters));
export const portal = (...parameters) => locateElement("portal", toPropertiesWithChildren(parameters));
export const source = (...parameters) => locateElement("source", toPropertiesWithChildren(parameters));
export const svg = (...parameters) => locateElement("svg", toPropertiesWithChildren(parameters));
export const math = (...parameters) => locateElement("math", toPropertiesWithChildren(parameters));
export const canvas = (...parameters) => locateElement("canvas", toPropertiesWithChildren(parameters));
export const noscript = (...parameters) => locateElement("noscript", toPropertiesWithChildren(parameters));
export const script = (...parameters) => locateElement("script", toPropertiesWithChildren(parameters));
export const del = (...parameters) => locateElement("del", toPropertiesWithChildren(parameters));
export const ins = (...parameters) => locateElement("ins", toPropertiesWithChildren(parameters));

// Table content
export const caption = (...parameters) => locateElement("caption", toPropertiesWithChildren(parameters));
export const col = (...parameters) => locateElement("col", toPropertiesWithChildren(parameters));
export const colgroup = (...parameters) => locateElement("colgroup", toPropertiesWithChildren(parameters));
export const table = (...parameters) => locateElement("table", toPropertiesWithChildren(parameters));
export const tbody = (...parameters) => locateElement("tbody", toPropertiesWithChildren(parameters));
export const td = (...parameters) => locateElement("td", toPropertiesWithChildren(parameters));
export const tfoot = (...parameters) => locateElement("tfoot", toPropertiesWithChildren(parameters));
export const th = (...parameters) => locateElement("th", toPropertiesWithChildren(parameters));
export const thead = (...parameters) => locateElement("thead", toPropertiesWithChildren(parameters));
export const tr = (...parameters) => locateElement("tr", toPropertiesWithChildren(parameters));

// Forms / interactive elements
export const button = (...parameters) => locateElement("button", toPropertiesWithChildren(parameters));
export const datalist = (...parameters) => locateElement("datalist", toPropertiesWithChildren(parameters));
export const fieldset = (...parameters) => locateElement("fieldset", toPropertiesWithChildren(parameters));
export const form = (...parameters) => locateElement("form", toPropertiesWithChildren(parameters));
export const input = (...parameters) => locateElement("input", toPropertiesWithChildren(parameters));
export const label = (...parameters) => locateElement("label", toPropertiesWithChildren(parameters));
export const legend = (...parameters) => locateElement("legend", toPropertiesWithChildren(parameters));
export const meter = (...parameters) => locateElement("meter", toPropertiesWithChildren(parameters));
export const optgroup = (...parameters) => locateElement("optgroup", toPropertiesWithChildren(parameters));
export const option = (...parameters) => locateElement("option", toPropertiesWithChildren(parameters));
export const output = (...parameters) => locateElement("output", toPropertiesWithChildren(parameters));
export const progress = (...parameters) => locateElement("progress", toPropertiesWithChildren(parameters));
export const select = (...parameters) => locateElement("select", toPropertiesWithChildren(parameters));
export const textarea = (...parameters) => locateElement("textarea", toPropertiesWithChildren(parameters));
export const details = (...parameters) => locateElement("details", toPropertiesWithChildren(parameters));
export const dialog = (...parameters) => locateElement("dialog", toPropertiesWithChildren(parameters));
export const summary = (...parameters) => locateElement("summary", toPropertiesWithChildren(parameters));
export const slot = (...parameters) => locateElement("slot", toPropertiesWithChildren(parameters));
export const template = (...parameters) => locateElement("template", toPropertiesWithChildren(parameters));
