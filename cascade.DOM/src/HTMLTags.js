import { toPropertiesWithChildren, toProperties, getCreator } from "@liquefy/cascade.component";
import { defaultDOMPrimitiveLocator } from "./DOMPrimitiveLocator.js";

/**
 * HTML tags - ported from flow.DOM/src/HTMLTags.js: same ~100-tag list,
 * same one-line-per-tag mechanical shape (`buildPrimitive(tagName,
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
 * Each tag function goes through the primitive locator of the target the
 * currently-building component was rendered onto (cascade.dom's
 * DOMPrimitiveLocator, owned by DOMElementTarget) rather than constructing
 * DOMElementComponent directly: getCreator() is exactly the "currently
 * building" component - the same stack Component.js itself pushes onto
 * around every build() call - so a tag function called from anywhere
 * inside build() (however deeply nested in ordinary JS argument position,
 * e.g. `div(h1(...), p(...))`) always resolves against whichever
 * component's own build() is actually running. build() only ever runs from
 * that component's own render(), so its render context is always set by
 * then. This is what makes the same `div()` call able to eventually
 * resolve to a different platform's own primitive without this file itself
 * ever changing - see this file's own git history for the larger
 * portability idea this is one piece of.
 */
function buildPrimitive(tag, properties) {
  const creator = getCreator();
  // unobservable.renderContext, not the observable this.renderContext: the
  // locator is timeless (fixed for a target's whole lifetime), so there is
  // nothing to depend on, and an unobservable read costs nothing and can't
  // resolve to a retracted writing. No creator (a component constructed
  // eagerly outside anyone's build() - the "hardcoded child reference"
  // style), or a context whose target carries no locator, falls back to the
  // shared default - see defaultDOMPrimitiveLocator's own comment for why
  // that's safe today.
  const context = creator && creator.unobservable.renderContext;
  const locator = (context && context.target && context.target.primitiveLocator) || defaultDOMPrimitiveLocator;
  return locator.build(tag, properties);
}

// Content sectioning / structure
export const address = (...parameters) => buildPrimitive("address", toPropertiesWithChildren(parameters));
export const article = (...parameters) => buildPrimitive("article", toPropertiesWithChildren(parameters));
export const aside = (...parameters) => buildPrimitive("aside", toPropertiesWithChildren(parameters));
export const footer = (...parameters) => buildPrimitive("footer", toPropertiesWithChildren(parameters));
export const header = (...parameters) => buildPrimitive("header", toPropertiesWithChildren(parameters));
export const h1 = (...parameters) => buildPrimitive("h1", toPropertiesWithChildren(parameters));
export const h2 = (...parameters) => buildPrimitive("h2", toPropertiesWithChildren(parameters));
export const h3 = (...parameters) => buildPrimitive("h3", toPropertiesWithChildren(parameters));
export const h4 = (...parameters) => buildPrimitive("h4", toPropertiesWithChildren(parameters));
export const h5 = (...parameters) => buildPrimitive("h5", toPropertiesWithChildren(parameters));
export const h6 = (...parameters) => buildPrimitive("h6", toPropertiesWithChildren(parameters));
export const group = (...parameters) => buildPrimitive("group", toPropertiesWithChildren(parameters));
export const main = (...parameters) => buildPrimitive("main", toPropertiesWithChildren(parameters));
export const nav = (...parameters) => buildPrimitive("nav", toPropertiesWithChildren(parameters));
export const section = (...parameters) => buildPrimitive("section", toPropertiesWithChildren(parameters));
export const search = (...parameters) => buildPrimitive("search", toPropertiesWithChildren(parameters));

// Text content
export const blockquote = (...parameters) => buildPrimitive("blockquote", toPropertiesWithChildren(parameters));
export const dd = (...parameters) => buildPrimitive("dd", toPropertiesWithChildren(parameters));
export const div = (...parameters) => buildPrimitive("div", toPropertiesWithChildren(parameters));
export const dl = (...parameters) => buildPrimitive("dl", toPropertiesWithChildren(parameters));
export const dt = (...parameters) => buildPrimitive("dt", toPropertiesWithChildren(parameters));
export const figcaption = (...parameters) => buildPrimitive("figcaption", toPropertiesWithChildren(parameters));
export const figure = (...parameters) => buildPrimitive("figure", toPropertiesWithChildren(parameters));
export const hr = (...parameters) => buildPrimitive("hr", toPropertiesWithChildren(parameters));
export const li = (...parameters) => buildPrimitive("li", toPropertiesWithChildren(parameters));
export const menu = (...parameters) => buildPrimitive("menu", toPropertiesWithChildren(parameters));
export const ol = (...parameters) => buildPrimitive("ol", toPropertiesWithChildren(parameters));
export const p = (...parameters) => buildPrimitive("p", toPropertiesWithChildren(parameters));
export const pre = (...parameters) => buildPrimitive("pre", toPropertiesWithChildren(parameters));
export const ul = (...parameters) => buildPrimitive("ul", toPropertiesWithChildren(parameters));

// Inline text semantics
export const a = (...parameters) => buildPrimitive("a", toPropertiesWithChildren(parameters));
export const abbr = (...parameters) => buildPrimitive("abbr", toPropertiesWithChildren(parameters));
export const b = (...parameters) => buildPrimitive("b", toPropertiesWithChildren(parameters));
export const bdi = (...parameters) => buildPrimitive("bdi", toPropertiesWithChildren(parameters));
export const bdo = (...parameters) => buildPrimitive("bdo", toPropertiesWithChildren(parameters));
export const br = (...parameters) => buildPrimitive("br", toProperties(parameters));
export const cite = (...parameters) => buildPrimitive("cite", toPropertiesWithChildren(parameters));
export const code = (...parameters) => buildPrimitive("code", toPropertiesWithChildren(parameters));
export const data = (...parameters) => buildPrimitive("data", toPropertiesWithChildren(parameters));
export const dfn = (...parameters) => buildPrimitive("dfn", toPropertiesWithChildren(parameters));
export const em = (...parameters) => buildPrimitive("em", toPropertiesWithChildren(parameters));
export const i = (...parameters) => buildPrimitive("i", toPropertiesWithChildren(parameters));
export const kbd = (...parameters) => buildPrimitive("kbd", toPropertiesWithChildren(parameters));
export const mark = (...parameters) => buildPrimitive("mark", toPropertiesWithChildren(parameters));
export const q = (...parameters) => buildPrimitive("q", toPropertiesWithChildren(parameters));
export const rp = (...parameters) => buildPrimitive("rp", toPropertiesWithChildren(parameters));
export const rt = (...parameters) => buildPrimitive("rt", toPropertiesWithChildren(parameters));
export const ruby = (...parameters) => buildPrimitive("ruby", toPropertiesWithChildren(parameters));
export const s = (...parameters) => buildPrimitive("s", toPropertiesWithChildren(parameters));
export const samp = (...parameters) => buildPrimitive("samp", toPropertiesWithChildren(parameters));
export const small = (...parameters) => buildPrimitive("small", toPropertiesWithChildren(parameters));
export const span = (...parameters) => buildPrimitive("span", toPropertiesWithChildren(parameters));
export const strong = (...parameters) => buildPrimitive("strong", toPropertiesWithChildren(parameters));
export const sub = (...parameters) => buildPrimitive("sub", toPropertiesWithChildren(parameters));
export const sup = (...parameters) => buildPrimitive("sup", toPropertiesWithChildren(parameters));
export const time = (...parameters) => buildPrimitive("time", toPropertiesWithChildren(parameters));
export const u = (...parameters) => buildPrimitive("u", toPropertiesWithChildren(parameters));
export const htmlVar = (...parameters) => buildPrimitive("var", toPropertiesWithChildren(parameters));
export const wbr = (...parameters) => buildPrimitive("wbr", toPropertiesWithChildren(parameters));

// Image and multimedia / embedded content
export const area = (...parameters) => buildPrimitive("area", toPropertiesWithChildren(parameters));
export const audio = (...parameters) => buildPrimitive("audio", toPropertiesWithChildren(parameters));
export const img = (...parameters) => buildPrimitive("img", toPropertiesWithChildren(parameters));
export const map = (...parameters) => buildPrimitive("map", toPropertiesWithChildren(parameters));
export const track = (...parameters) => buildPrimitive("track", toPropertiesWithChildren(parameters));
export const video = (...parameters) => buildPrimitive("video", toPropertiesWithChildren(parameters));
export const embed = (...parameters) => buildPrimitive("embed", toPropertiesWithChildren(parameters));
export const iframe = (...parameters) => buildPrimitive("iframe", toPropertiesWithChildren(parameters));
export const object = (...parameters) => buildPrimitive("object", toPropertiesWithChildren(parameters));
export const picture = (...parameters) => buildPrimitive("picture", toPropertiesWithChildren(parameters));
export const portal = (...parameters) => buildPrimitive("portal", toPropertiesWithChildren(parameters));
export const source = (...parameters) => buildPrimitive("source", toPropertiesWithChildren(parameters));
export const svg = (...parameters) => buildPrimitive("svg", toPropertiesWithChildren(parameters));
export const math = (...parameters) => buildPrimitive("math", toPropertiesWithChildren(parameters));
export const canvas = (...parameters) => buildPrimitive("canvas", toPropertiesWithChildren(parameters));
export const noscript = (...parameters) => buildPrimitive("noscript", toPropertiesWithChildren(parameters));
export const script = (...parameters) => buildPrimitive("script", toPropertiesWithChildren(parameters));
export const del = (...parameters) => buildPrimitive("del", toPropertiesWithChildren(parameters));
export const ins = (...parameters) => buildPrimitive("ins", toPropertiesWithChildren(parameters));

// Table content
export const caption = (...parameters) => buildPrimitive("caption", toPropertiesWithChildren(parameters));
export const col = (...parameters) => buildPrimitive("col", toPropertiesWithChildren(parameters));
export const colgroup = (...parameters) => buildPrimitive("colgroup", toPropertiesWithChildren(parameters));
export const table = (...parameters) => buildPrimitive("table", toPropertiesWithChildren(parameters));
export const tbody = (...parameters) => buildPrimitive("tbody", toPropertiesWithChildren(parameters));
export const td = (...parameters) => buildPrimitive("td", toPropertiesWithChildren(parameters));
export const tfoot = (...parameters) => buildPrimitive("tfoot", toPropertiesWithChildren(parameters));
export const th = (...parameters) => buildPrimitive("th", toPropertiesWithChildren(parameters));
export const thead = (...parameters) => buildPrimitive("thead", toPropertiesWithChildren(parameters));
export const tr = (...parameters) => buildPrimitive("tr", toPropertiesWithChildren(parameters));

// Forms / interactive elements
export const button = (...parameters) => buildPrimitive("button", toPropertiesWithChildren(parameters));
export const datalist = (...parameters) => buildPrimitive("datalist", toPropertiesWithChildren(parameters));
export const fieldset = (...parameters) => buildPrimitive("fieldset", toPropertiesWithChildren(parameters));
export const form = (...parameters) => buildPrimitive("form", toPropertiesWithChildren(parameters));
export const input = (...parameters) => buildPrimitive("input", toPropertiesWithChildren(parameters));
export const label = (...parameters) => buildPrimitive("label", toPropertiesWithChildren(parameters));
export const legend = (...parameters) => buildPrimitive("legend", toPropertiesWithChildren(parameters));
export const meter = (...parameters) => buildPrimitive("meter", toPropertiesWithChildren(parameters));
export const optgroup = (...parameters) => buildPrimitive("optgroup", toPropertiesWithChildren(parameters));
export const option = (...parameters) => buildPrimitive("option", toPropertiesWithChildren(parameters));
export const output = (...parameters) => buildPrimitive("output", toPropertiesWithChildren(parameters));
export const progress = (...parameters) => buildPrimitive("progress", toPropertiesWithChildren(parameters));
export const select = (...parameters) => buildPrimitive("select", toPropertiesWithChildren(parameters));
export const textarea = (...parameters) => buildPrimitive("textarea", toPropertiesWithChildren(parameters));
export const details = (...parameters) => buildPrimitive("details", toPropertiesWithChildren(parameters));
export const dialog = (...parameters) => buildPrimitive("dialog", toPropertiesWithChildren(parameters));
export const summary = (...parameters) => buildPrimitive("summary", toPropertiesWithChildren(parameters));
export const slot = (...parameters) => buildPrimitive("slot", toPropertiesWithChildren(parameters));
export const template = (...parameters) => buildPrimitive("template", toPropertiesWithChildren(parameters));
