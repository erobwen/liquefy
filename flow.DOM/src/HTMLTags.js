import { getFlowPropertiesIncludingChildren, findImplicitChildrenAndOnClick, getFlowProperties } from "@liquefy/flow.core";
import { extractAttributes } from "./domNodeAttributes";
import { elementNode } from "./HTMLBuilding";

/**
 * Tag creation helper
 */
function standardTag(tagName, parameters) {
  let properties = getFlowPropertiesIncludingChildren(parameters); 
  extractAttributes(properties);
  return elementNode({tagName: tagName, classNameOverride: tagName, ...properties});
}

/**
 * HTML tags
 */
export const address = (...parameters) => standardTag("address", parameters);
export const article = (...parameters) => standardTag("article", parameters);
export const aside = (...parameters) => standardTag("aside", parameters);
export const footer = (...parameters) => standardTag("footer", parameters);
export const header = (...parameters) => standardTag("header", parameters);
export const h1 = (...parameters) => standardTag("h1", parameters);
export const h2 = (...parameters) => standardTag("h2", parameters);
export const h3 = (...parameters) => standardTag("h3", parameters);
export const h4 = (...parameters) => standardTag("h4", parameters);
export const h5 = (...parameters) => standardTag("h5", parameters);
export const h6 = (...parameters) => standardTag("h6", parameters);
export const group = (...parameters) => standardTag("group", parameters);
export const main = (...parameters) => standardTag("main", parameters);
export const nav = (...parameters) => standardTag("nav", parameters);
export const section = (...parameters) => standardTag("section", parameters);
export const search = (...parameters) => standardTag("search", parameters);
export const blockquote = (...parameters) => standardTag("blockquote", parameters);
export const dd = (...parameters) => standardTag("dd", parameters);
export const div = (...parameters) => standardTag("div", parameters);
export const dl = (...parameters) => standardTag("dl", parameters);
export const dt = (...parameters) => standardTag("dt", parameters);
export const figcaption = (...parameters) => standardTag("figcaption", parameters);
export const figure = (...parameters) => standardTag("figure", parameters);
export const hr = (...parameters) => standardTag("hr", parameters);
export const li = (...parameters) => standardTag("li", parameters);
export const menu = (...parameters) => standardTag("menu", parameters);
export const ol = (...parameters) => standardTag("ol", parameters);
export const p = (...parameters) => standardTag("p", parameters);
export const pre = (...parameters) => standardTag("pre", parameters);
export const ul = (...parameters) => standardTag("ul", parameters);
export const a = (...parameters) => standardTag("a", parameters);
export const abbr = (...parameters) => standardTag("abbr", parameters);
export const b = (...parameters) => standardTag("b", parameters);
export const bdi = (...parameters) => standardTag("bdi", parameters);
export const bdo = (...parameters) => standardTag("bdo", parameters);
export const br = (...parameters) => standardTag("br", parameters);
export const cite = (...parameters) => standardTag("cite", parameters);
export const code = (...parameters) => standardTag("code", parameters);
export const data = (...parameters) => standardTag("data", parameters);
export const dfn = (...parameters) => standardTag("dfn", parameters);
export const em = (...parameters) => standardTag("em", parameters);
export const i = (...parameters) => standardTag("i", parameters);
export const kbd = (...parameters) => standardTag("kbd", parameters);
export const mark = (...parameters) => standardTag("mark", parameters);
export const q = (...parameters) => standardTag("q", parameters);
export const rp = (...parameters) => standardTag("rp", parameters);
export const rt = (...parameters) => standardTag("rt", parameters);
export const ruby = (...parameters) => standardTag("ruby", parameters);
export const s = (...parameters) => standardTag("s", parameters);
export const samp = (...parameters) => standardTag("samp", parameters);
export const small = (...parameters) => standardTag("small", parameters);
export const span = (...parameters) => standardTag("span", parameters);
export const strong = (...parameters) => standardTag("strong", parameters);
export const sub = (...parameters) => standardTag("sub", parameters);
export const sup = (...parameters) => standardTag("sup", parameters);
export const time = (...parameters) => standardTag("time", parameters);
export const u = (...parameters) => standardTag("u", parameters);
export const htmlVar = (...parameters) => standardTag("var", parameters);
export const wbr = (...parameters) => standardTag("wbr", parameters);
export const area = (...parameters) => standardTag("area", parameters);
export const audio = (...parameters) => standardTag("audio", parameters);
export const img = (...parameters) => standardTag("img", parameters);
export const map = (...parameters) => standardTag("map", parameters);
export const track = (...parameters) => standardTag("track", parameters);
export const video = (...parameters) => standardTag("video", parameters);
export const embed = (...parameters) => standardTag("embed", parameters);
export const iframe = (...parameters) => standardTag("iframe", parameters);
export const object = (...parameters) => standardTag("object", parameters);
export const picture = (...parameters) => standardTag("picture", parameters);
export const portal = (...parameters) => standardTag("portal", parameters);
export const source = (...parameters) => standardTag("source", parameters);
export const svg = (...parameters) => standardTag("svg", parameters);
export const math = (...parameters) => standardTag("math", parameters);
export const canvas = (...parameters) => standardTag("canvas", parameters);
export const noscript = (...parameters) => standardTag("noscript", parameters);
export const script = (...parameters) => standardTag("script", parameters);
export const del = (...parameters) => standardTag("del", parameters);
export const ins = (...parameters) => standardTag("ins", parameters);
export const caption = (...parameters) => standardTag("caption", parameters);
export const col = (...parameters) => standardTag("col", parameters);
export const colgroup = (...parameters) => standardTag("colgroup", parameters);
export const table = (...parameters) => standardTag("table", parameters);
export const tbody = (...parameters) => standardTag("tbody", parameters);
export const td = (...parameters) => standardTag("td", parameters);
export const tfoot = (...parameters) => standardTag("tfoot", parameters);
export const th = (...parameters) => standardTag("th", parameters);
export const thead = (...parameters) => standardTag("thead", parameters);
export const tr = (...parameters) => standardTag("tr", parameters);
export function button(...parameters) {
  const properties = getFlowProperties(parameters);
  findImplicitChildrenAndOnClick(properties);
  extractAttributes(properties);
  return elementNode({tagName: "button", classNameOverride: "button", ...properties})
}
export const datalist = (...parameters) => standardTag("datalist", parameters);
export const fieldset = (...parameters) => standardTag("fieldset", parameters);
export const form = (...parameters) => standardTag("form", parameters);
export const input = (...parameters) => standardTag("input", parameters);
export const label = (...parameters) => standardTag("label", parameters);
export const legend = (...parameters) => standardTag("legend", parameters);
export const meter = (...parameters) => standardTag("meter", parameters);
export const optgroup = (...parameters) => standardTag("optgroup", parameters);
export const option = (...parameters) => standardTag("option", parameters);
export const output = (...parameters) => standardTag("output", parameters);
export const progress = (...parameters) => standardTag("progress", parameters);
export const select = (...parameters) => standardTag("select", parameters);
export const textarea = (...parameters) => standardTag("textarea", parameters);
export const details = (...parameters) => standardTag("details", parameters);
export const dialog = (...parameters) => standardTag("dialog", parameters);
export const summary = (...parameters) => standardTag("summary", parameters);
export const slot = (...parameters) => standardTag("slot", parameters);
export const template = (...parameters) => standardTag("template", parameters);



















