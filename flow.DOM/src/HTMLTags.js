import { getFlowPropertiesIncludingChildren, getFlowProperties } from "@liquefy/flow.core";
import { getButtonProperties } from "./implicitProperties";
import { elementNode } from "./DOMElementNode";

/**
 * Tag creation helper
 */
function taggedElement(tagName, parameters) {
  return elementNode({tagName: tagName, componentTypeName: tagName, ...getFlowPropertiesIncludingChildren(parameters)});
}

/**
 * HTML tags
 */
export const address = (...parameters) => taggedElement("address", parameters);
export const article = (...parameters) => taggedElement("article", parameters);
export const aside = (...parameters) => taggedElement("aside", parameters);
export const footer = (...parameters) => taggedElement("footer", parameters);
export const header = (...parameters) => taggedElement("header", parameters);
export const h1 = (...parameters) => taggedElement("h1", parameters);
export const h2 = (...parameters) => taggedElement("h2", parameters);
export const h3 = (...parameters) => taggedElement("h3", parameters);
export const h4 = (...parameters) => taggedElement("h4", parameters);
export const h5 = (...parameters) => taggedElement("h5", parameters);
export const h6 = (...parameters) => taggedElement("h6", parameters);
export const group = (...parameters) => taggedElement("group", parameters);
export const main = (...parameters) => taggedElement("main", parameters);
export const nav = (...parameters) => taggedElement("nav", parameters);
export const section = (...parameters) => taggedElement("section", parameters);
export const search = (...parameters) => taggedElement("search", parameters);
export const blockquote = (...parameters) => taggedElement("blockquote", parameters);
export const dd = (...parameters) => taggedElement("dd", parameters);
export const div = (...parameters) => taggedElement("div", parameters);
export const dl = (...parameters) => taggedElement("dl", parameters);
export const dt = (...parameters) => taggedElement("dt", parameters);
export const figcaption = (...parameters) => taggedElement("figcaption", parameters);
export const figure = (...parameters) => taggedElement("figure", parameters);
export const hr = (...parameters) => taggedElement("hr", parameters);
export const li = (...parameters) => taggedElement("li", parameters);
export const menu = (...parameters) => taggedElement("menu", parameters);
export const ol = (...parameters) => taggedElement("ol", parameters);
export const p = (...parameters) => taggedElement("p", parameters);
export const pre = (...parameters) => taggedElement("pre", parameters);
export const ul = (...parameters) => taggedElement("ul", parameters);
export const a = (...parameters) => taggedElement("a", parameters);
export const abbr = (...parameters) => taggedElement("abbr", parameters);
export const b = (...parameters) => taggedElement("b", parameters);
export const bdi = (...parameters) => taggedElement("bdi", parameters);
export const bdo = (...parameters) => taggedElement("bdo", parameters);
export const br = (...parameters) => taggedElement("br", parameters);
export const cite = (...parameters) => taggedElement("cite", parameters);
export const code = (...parameters) => taggedElement("code", parameters);
export const data = (...parameters) => taggedElement("data", parameters);
export const dfn = (...parameters) => taggedElement("dfn", parameters);
export const em = (...parameters) => taggedElement("em", parameters);
export const i = (...parameters) => taggedElement("i", parameters);
export const kbd = (...parameters) => taggedElement("kbd", parameters);
export const mark = (...parameters) => taggedElement("mark", parameters);
export const q = (...parameters) => taggedElement("q", parameters);
export const rp = (...parameters) => taggedElement("rp", parameters);
export const rt = (...parameters) => taggedElement("rt", parameters);
export const ruby = (...parameters) => taggedElement("ruby", parameters);
export const s = (...parameters) => taggedElement("s", parameters);
export const samp = (...parameters) => taggedElement("samp", parameters);
export const small = (...parameters) => taggedElement("small", parameters);
export const span = (...parameters) => taggedElement("span", parameters);
export const strong = (...parameters) => taggedElement("strong", parameters);
export const sub = (...parameters) => taggedElement("sub", parameters);
export const sup = (...parameters) => taggedElement("sup", parameters);
export const time = (...parameters) => taggedElement("time", parameters);
export const u = (...parameters) => taggedElement("u", parameters);
export const htmlVar = (...parameters) => taggedElement("var", parameters);
export const wbr = (...parameters) => taggedElement("wbr", parameters);
export const area = (...parameters) => taggedElement("area", parameters);
export const audio = (...parameters) => taggedElement("audio", parameters);
export const img = (...parameters) => taggedElement("img", parameters);
export const map = (...parameters) => taggedElement("map", parameters);
export const track = (...parameters) => taggedElement("track", parameters);
export const video = (...parameters) => taggedElement("video", parameters);
export const embed = (...parameters) => taggedElement("embed", parameters);
export const iframe = (...parameters) => taggedElement("iframe", parameters);
export const object = (...parameters) => taggedElement("object", parameters);
export const picture = (...parameters) => taggedElement("picture", parameters);
export const portal = (...parameters) => taggedElement("portal", parameters);
export const source = (...parameters) => taggedElement("source", parameters);
export const svg = (...parameters) => taggedElement("svg", parameters);
export const math = (...parameters) => taggedElement("math", parameters);
export const canvas = (...parameters) => taggedElement("canvas", parameters);
export const noscript = (...parameters) => taggedElement("noscript", parameters);
export const script = (...parameters) => taggedElement("script", parameters);
export const del = (...parameters) => taggedElement("del", parameters);
export const ins = (...parameters) => taggedElement("ins", parameters);
export const caption = (...parameters) => taggedElement("caption", parameters);
export const col = (...parameters) => taggedElement("col", parameters);
export const colgroup = (...parameters) => taggedElement("colgroup", parameters);
export const table = (...parameters) => taggedElement("table", parameters);
export const tbody = (...parameters) => taggedElement("tbody", parameters);
export const td = (...parameters) => taggedElement("td", parameters);
export const tfoot = (...parameters) => taggedElement("tfoot", parameters);
export const th = (...parameters) => taggedElement("th", parameters);
export const thead = (...parameters) => taggedElement("thead", parameters);
export const tr = (...parameters) => taggedElement("tr", parameters);
export const button = (...parameters) => elementNode({
  tagName: "button", 
  componentTypeName: "button", 
  ...getButtonProperties(parameters)
})
export const datalist = (...parameters) => taggedElement("datalist", parameters);
export const fieldset = (...parameters) => taggedElement("fieldset", parameters);
export const form = (...parameters) => taggedElement("form", parameters);
export const input = (...parameters) => taggedElement("input", parameters); // TODO: use getInputProperties()
export const label = (...parameters) => taggedElement("label", parameters);
export const legend = (...parameters) => taggedElement("legend", parameters);
export const meter = (...parameters) => taggedElement("meter", parameters);
export const optgroup = (...parameters) => taggedElement("optgroup", parameters);
export const option = (...parameters) => taggedElement("option", parameters);
export const output = (...parameters) => taggedElement("output", parameters);
export const progress = (...parameters) => taggedElement("progress", parameters);
export const select = (...parameters) => taggedElement("select", parameters);
export const textarea = (...parameters) => taggedElement("textarea", parameters);
export const details = (...parameters) => taggedElement("details", parameters);
export const dialog = (...parameters) => taggedElement("dialog", parameters);
export const summary = (...parameters) => taggedElement("summary", parameters);
export const slot = (...parameters) => taggedElement("slot", parameters);
export const template = (...parameters) => taggedElement("template", parameters);



















