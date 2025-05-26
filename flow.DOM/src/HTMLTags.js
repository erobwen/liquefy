import { getFlowPropertiesIncludingChildren, getFlowProperties } from "@liquefy/flow.core";
import { getButtonProperties, getInputProperties } from "./implicitProperties";
import { elementNode } from "./DOMElementNode";

/**
 * Tag creation helper
 */
function taggedElement(tagName, properties) {
  return elementNode({tagName: tagName, componentTypeName: tagName, ...properties});
}

/**
 * HTML tags
 */
export const address = (...parameters) => taggedElement("address", getFlowPropertiesIncludingChildren(parameters));
export const article = (...parameters) => taggedElement("article", getFlowPropertiesIncludingChildren(parameters));
export const aside = (...parameters) => taggedElement("aside", getFlowPropertiesIncludingChildren(parameters));
export const footer = (...parameters) => taggedElement("footer", getFlowPropertiesIncludingChildren(parameters));
export const header = (...parameters) => taggedElement("header", getFlowPropertiesIncludingChildren(parameters));
export const h1 = (...parameters) => taggedElement("h1", getFlowPropertiesIncludingChildren(parameters));
export const h2 = (...parameters) => taggedElement("h2", getFlowPropertiesIncludingChildren(parameters));
export const h3 = (...parameters) => taggedElement("h3", getFlowPropertiesIncludingChildren(parameters));
export const h4 = (...parameters) => taggedElement("h4", getFlowPropertiesIncludingChildren(parameters));
export const h5 = (...parameters) => taggedElement("h5", getFlowPropertiesIncludingChildren(parameters));
export const h6 = (...parameters) => taggedElement("h6", getFlowPropertiesIncludingChildren(parameters));
export const group = (...parameters) => taggedElement("group", getFlowPropertiesIncludingChildren(parameters));
export const main = (...parameters) => taggedElement("main", getFlowPropertiesIncludingChildren(parameters));
export const nav = (...parameters) => taggedElement("nav", getFlowPropertiesIncludingChildren(parameters));
export const section = (...parameters) => taggedElement("section", getFlowPropertiesIncludingChildren(parameters));
export const search = (...parameters) => taggedElement("search", getFlowPropertiesIncludingChildren(parameters));
export const blockquote = (...parameters) => taggedElement("blockquote", getFlowPropertiesIncludingChildren(parameters));
export const dd = (...parameters) => taggedElement("dd", getFlowPropertiesIncludingChildren(parameters));
export const div = (...parameters) => taggedElement("div", getFlowPropertiesIncludingChildren(parameters));
export const dl = (...parameters) => taggedElement("dl", getFlowPropertiesIncludingChildren(parameters));
export const dt = (...parameters) => taggedElement("dt", getFlowPropertiesIncludingChildren(parameters));
export const figcaption = (...parameters) => taggedElement("figcaption", getFlowPropertiesIncludingChildren(parameters));
export const figure = (...parameters) => taggedElement("figure", getFlowPropertiesIncludingChildren(parameters));
export const hr = (...parameters) => taggedElement("hr", getFlowPropertiesIncludingChildren(parameters));
export const li = (...parameters) => taggedElement("li", getFlowPropertiesIncludingChildren(parameters));
export const menu = (...parameters) => taggedElement("menu", getFlowPropertiesIncludingChildren(parameters));
export const ol = (...parameters) => taggedElement("ol", getFlowPropertiesIncludingChildren(parameters));
export const p = (...parameters) => taggedElement("p", getFlowPropertiesIncludingChildren(parameters));
export const pre = (...parameters) => taggedElement("pre", getFlowPropertiesIncludingChildren(parameters));
export const ul = (...parameters) => taggedElement("ul", getFlowPropertiesIncludingChildren(parameters));
export const a = (...parameters) => taggedElement("a", getFlowPropertiesIncludingChildren(parameters));
export const abbr = (...parameters) => taggedElement("abbr", getFlowPropertiesIncludingChildren(parameters));
export const b = (...parameters) => taggedElement("b", getFlowPropertiesIncludingChildren(parameters));
export const bdi = (...parameters) => taggedElement("bdi", getFlowPropertiesIncludingChildren(parameters));
export const bdo = (...parameters) => taggedElement("bdo", getFlowPropertiesIncludingChildren(parameters));
export const br = (...parameters) => taggedElement("br", getflowproperties(parameters));
export const cite = (...parameters) => taggedElement("cite", getFlowPropertiesIncludingChildren(parameters));
export const code = (...parameters) => taggedElement("code", getFlowPropertiesIncludingChildren(parameters));
export const data = (...parameters) => taggedElement("data", getFlowPropertiesIncludingChildren(parameters));
export const dfn = (...parameters) => taggedElement("dfn", getFlowPropertiesIncludingChildren(parameters));
export const em = (...parameters) => taggedElement("em", getFlowPropertiesIncludingChildren(parameters));
export const i = (...parameters) => taggedElement("i", getFlowPropertiesIncludingChildren(parameters));
export const kbd = (...parameters) => taggedElement("kbd", getFlowPropertiesIncludingChildren(parameters));
export const mark = (...parameters) => taggedElement("mark", getFlowPropertiesIncludingChildren(parameters));
export const q = (...parameters) => taggedElement("q", getFlowPropertiesIncludingChildren(parameters));
export const rp = (...parameters) => taggedElement("rp", getFlowPropertiesIncludingChildren(parameters));
export const rt = (...parameters) => taggedElement("rt", getFlowPropertiesIncludingChildren(parameters));
export const ruby = (...parameters) => taggedElement("ruby", getFlowPropertiesIncludingChildren(parameters));
export const s = (...parameters) => taggedElement("s", getFlowPropertiesIncludingChildren(parameters));
export const samp = (...parameters) => taggedElement("samp", getFlowPropertiesIncludingChildren(parameters));
export const small = (...parameters) => taggedElement("small", getFlowPropertiesIncludingChildren(parameters));
export const span = (...parameters) => taggedElement("span", getFlowPropertiesIncludingChildren(parameters));
export const strong = (...parameters) => taggedElement("strong", getFlowPropertiesIncludingChildren(parameters));
export const sub = (...parameters) => taggedElement("sub", getFlowPropertiesIncludingChildren(parameters));
export const sup = (...parameters) => taggedElement("sup", getFlowPropertiesIncludingChildren(parameters));
export const time = (...parameters) => taggedElement("time", getFlowPropertiesIncludingChildren(parameters));
export const u = (...parameters) => taggedElement("u", getFlowPropertiesIncludingChildren(parameters));
export const htmlVar = (...parameters) => taggedElement("var", getFlowPropertiesIncludingChildren(parameters));
export const wbr = (...parameters) => taggedElement("wbr", getFlowPropertiesIncludingChildren(parameters));
export const area = (...parameters) => taggedElement("area", getFlowPropertiesIncludingChildren(parameters));
export const audio = (...parameters) => taggedElement("audio", getFlowPropertiesIncludingChildren(parameters));
export const img = (...parameters) => taggedElement("img", getFlowPropertiesIncludingChildren(parameters));
export const map = (...parameters) => taggedElement("map", getFlowPropertiesIncludingChildren(parameters));
export const track = (...parameters) => taggedElement("track", getFlowPropertiesIncludingChildren(parameters));
export const video = (...parameters) => taggedElement("video", getFlowPropertiesIncludingChildren(parameters));
export const embed = (...parameters) => taggedElement("embed", getFlowPropertiesIncludingChildren(parameters));
export const iframe = (...parameters) => taggedElement("iframe", getFlowPropertiesIncludingChildren(parameters));
export const object = (...parameters) => taggedElement("object", getFlowPropertiesIncludingChildren(parameters));
export const picture = (...parameters) => taggedElement("picture", getFlowPropertiesIncludingChildren(parameters));
export const portal = (...parameters) => taggedElement("portal", getFlowPropertiesIncludingChildren(parameters));
export const source = (...parameters) => taggedElement("source", getFlowPropertiesIncludingChildren(parameters));
export const svg = (...parameters) => taggedElement("svg", getFlowPropertiesIncludingChildren(parameters));
export const math = (...parameters) => taggedElement("math", getFlowPropertiesIncludingChildren(parameters));
export const canvas = (...parameters) => taggedElement("canvas", getFlowPropertiesIncludingChildren(parameters));
export const noscript = (...parameters) => taggedElement("noscript", getFlowPropertiesIncludingChildren(parameters));
export const script = (...parameters) => taggedElement("script", getFlowPropertiesIncludingChildren(parameters));
export const del = (...parameters) => taggedElement("del", getFlowPropertiesIncludingChildren(parameters));
export const ins = (...parameters) => taggedElement("ins", getFlowPropertiesIncludingChildren(parameters));
export const caption = (...parameters) => taggedElement("caption", getFlowPropertiesIncludingChildren(parameters));
export const col = (...parameters) => taggedElement("col", getFlowPropertiesIncludingChildren(parameters));
export const colgroup = (...parameters) => taggedElement("colgroup", getFlowPropertiesIncludingChildren(parameters));
export const table = (...parameters) => taggedElement("table", getFlowPropertiesIncludingChildren(parameters));
export const tbody = (...parameters) => taggedElement("tbody", getFlowPropertiesIncludingChildren(parameters));
export const td = (...parameters) => taggedElement("td", getFlowPropertiesIncludingChildren(parameters));
export const tfoot = (...parameters) => taggedElement("tfoot", getFlowPropertiesIncludingChildren(parameters));
export const th = (...parameters) => taggedElement("th", getFlowPropertiesIncludingChildren(parameters));
export const thead = (...parameters) => taggedElement("thead", getFlowPropertiesIncludingChildren(parameters));
export const tr = (...parameters) => taggedElement("tr", getFlowPropertiesIncludingChildren(parameters));
export const button = (...parameters) => taggedElement("button", getButtonProperties(parameters));
export const datalist = (...parameters) => taggedElement("datalist", getFlowPropertiesIncludingChildren(parameters));
export const fieldset = (...parameters) => taggedElement("fieldset", getFlowPropertiesIncludingChildren(parameters));
export const form = (...parameters) => taggedElement("form", getFlowPropertiesIncludingChildren(parameters));
export const input = (...parameters) => taggedElement("input", getInputProperties(parameters));
export const label = (...parameters) => taggedElement("label", getFlowPropertiesIncludingChildren(parameters));
export const legend = (...parameters) => taggedElement("legend", getFlowPropertiesIncludingChildren(parameters));
export const meter = (...parameters) => taggedElement("meter", getFlowPropertiesIncludingChildren(parameters));
export const optgroup = (...parameters) => taggedElement("optgroup", getFlowPropertiesIncludingChildren(parameters));
export const option = (...parameters) => taggedElement("option", getFlowPropertiesIncludingChildren(parameters));
export const output = (...parameters) => taggedElement("output", getFlowPropertiesIncludingChildren(parameters));
export const progress = (...parameters) => taggedElement("progress", getFlowPropertiesIncludingChildren(parameters));
export const select = (...parameters) => taggedElement("select", getFlowPropertiesIncludingChildren(parameters));
export const textarea = (...parameters) => taggedElement("textarea", getFlowPropertiesIncludingChildren(parameters));
export const details = (...parameters) => taggedElement("details", getFlowPropertiesIncludingChildren(parameters));
export const dialog = (...parameters) => taggedElement("dialog", getFlowPropertiesIncludingChildren(parameters));
export const summary = (...parameters) => taggedElement("summary", getFlowPropertiesIncludingChildren(parameters));
export const slot = (...parameters) => taggedElement("slot", getFlowPropertiesIncludingChildren(parameters));
export const template = (...parameters) => taggedElement("template", getFlowPropertiesIncludingChildren(parameters));



















