import { toPropertiesWithChildren, toProperties } from "@liquefy/flow.core";
import { toButtonProperties, toInputProperties } from "./implicitProperties";
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
export const address = (...parameters) => taggedElement("address", toPropertiesWithChildren(parameters));
export const article = (...parameters) => taggedElement("article", toPropertiesWithChildren(parameters));
export const aside = (...parameters) => taggedElement("aside", toPropertiesWithChildren(parameters));
export const footer = (...parameters) => taggedElement("footer", toPropertiesWithChildren(parameters));
export const header = (...parameters) => taggedElement("header", toPropertiesWithChildren(parameters));
export const h1 = (...parameters) => taggedElement("h1", toPropertiesWithChildren(parameters));
export const h2 = (...parameters) => taggedElement("h2", toPropertiesWithChildren(parameters));
export const h3 = (...parameters) => taggedElement("h3", toPropertiesWithChildren(parameters));
export const h4 = (...parameters) => taggedElement("h4", toPropertiesWithChildren(parameters));
export const h5 = (...parameters) => taggedElement("h5", toPropertiesWithChildren(parameters));
export const h6 = (...parameters) => taggedElement("h6", toPropertiesWithChildren(parameters));
export const group = (...parameters) => taggedElement("group", toPropertiesWithChildren(parameters));
export const main = (...parameters) => taggedElement("main", toPropertiesWithChildren(parameters));
export const nav = (...parameters) => taggedElement("nav", toPropertiesWithChildren(parameters));
export const section = (...parameters) => taggedElement("section", toPropertiesWithChildren(parameters));
export const search = (...parameters) => taggedElement("search", toPropertiesWithChildren(parameters));
export const blockquote = (...parameters) => taggedElement("blockquote", toPropertiesWithChildren(parameters));
export const dd = (...parameters) => taggedElement("dd", toPropertiesWithChildren(parameters));
export const div = (...parameters) => taggedElement("div", toPropertiesWithChildren(parameters));
export const dl = (...parameters) => taggedElement("dl", toPropertiesWithChildren(parameters));
export const dt = (...parameters) => taggedElement("dt", toPropertiesWithChildren(parameters));
export const figcaption = (...parameters) => taggedElement("figcaption", toPropertiesWithChildren(parameters));
export const figure = (...parameters) => taggedElement("figure", toPropertiesWithChildren(parameters));
export const hr = (...parameters) => taggedElement("hr", toPropertiesWithChildren(parameters));
export const li = (...parameters) => taggedElement("li", toPropertiesWithChildren(parameters));
export const menu = (...parameters) => taggedElement("menu", toPropertiesWithChildren(parameters));
export const ol = (...parameters) => taggedElement("ol", toPropertiesWithChildren(parameters));
export const p = (...parameters) => taggedElement("p", toPropertiesWithChildren(parameters));
export const pre = (...parameters) => taggedElement("pre", toPropertiesWithChildren(parameters));
export const ul = (...parameters) => taggedElement("ul", toPropertiesWithChildren(parameters));
export const a = (...parameters) => taggedElement("a", toPropertiesWithChildren(parameters));
export const abbr = (...parameters) => taggedElement("abbr", toPropertiesWithChildren(parameters));
export const b = (...parameters) => taggedElement("b", toPropertiesWithChildren(parameters));
export const bdi = (...parameters) => taggedElement("bdi", toPropertiesWithChildren(parameters));
export const bdo = (...parameters) => taggedElement("bdo", toPropertiesWithChildren(parameters));
export const br = (...parameters) => taggedElement("br", getflowproperties(parameters));
export const cite = (...parameters) => taggedElement("cite", toPropertiesWithChildren(parameters));
export const code = (...parameters) => taggedElement("code", toPropertiesWithChildren(parameters));
export const data = (...parameters) => taggedElement("data", toPropertiesWithChildren(parameters));
export const dfn = (...parameters) => taggedElement("dfn", toPropertiesWithChildren(parameters));
export const em = (...parameters) => taggedElement("em", toPropertiesWithChildren(parameters));
export const i = (...parameters) => taggedElement("i", toPropertiesWithChildren(parameters));
export const kbd = (...parameters) => taggedElement("kbd", toPropertiesWithChildren(parameters));
export const mark = (...parameters) => taggedElement("mark", toPropertiesWithChildren(parameters));
export const q = (...parameters) => taggedElement("q", toPropertiesWithChildren(parameters));
export const rp = (...parameters) => taggedElement("rp", toPropertiesWithChildren(parameters));
export const rt = (...parameters) => taggedElement("rt", toPropertiesWithChildren(parameters));
export const ruby = (...parameters) => taggedElement("ruby", toPropertiesWithChildren(parameters));
export const s = (...parameters) => taggedElement("s", toPropertiesWithChildren(parameters));
export const samp = (...parameters) => taggedElement("samp", toPropertiesWithChildren(parameters));
export const small = (...parameters) => taggedElement("small", toPropertiesWithChildren(parameters));
export const span = (...parameters) => taggedElement("span", toPropertiesWithChildren(parameters));
export const strong = (...parameters) => taggedElement("strong", toPropertiesWithChildren(parameters));
export const sub = (...parameters) => taggedElement("sub", toPropertiesWithChildren(parameters));
export const sup = (...parameters) => taggedElement("sup", toPropertiesWithChildren(parameters));
export const time = (...parameters) => taggedElement("time", toPropertiesWithChildren(parameters));
export const u = (...parameters) => taggedElement("u", toPropertiesWithChildren(parameters));
export const htmlVar = (...parameters) => taggedElement("var", toPropertiesWithChildren(parameters));
export const wbr = (...parameters) => taggedElement("wbr", toPropertiesWithChildren(parameters));
export const area = (...parameters) => taggedElement("area", toPropertiesWithChildren(parameters));
export const audio = (...parameters) => taggedElement("audio", toPropertiesWithChildren(parameters));
export const img = (...parameters) => taggedElement("img", toPropertiesWithChildren(parameters));
export const map = (...parameters) => taggedElement("map", toPropertiesWithChildren(parameters));
export const track = (...parameters) => taggedElement("track", toPropertiesWithChildren(parameters));
export const video = (...parameters) => taggedElement("video", toPropertiesWithChildren(parameters));
export const embed = (...parameters) => taggedElement("embed", toPropertiesWithChildren(parameters));
export const iframe = (...parameters) => taggedElement("iframe", toPropertiesWithChildren(parameters));
export const object = (...parameters) => taggedElement("object", toPropertiesWithChildren(parameters));
export const picture = (...parameters) => taggedElement("picture", toPropertiesWithChildren(parameters));
export const portal = (...parameters) => taggedElement("portal", toPropertiesWithChildren(parameters));
export const source = (...parameters) => taggedElement("source", toPropertiesWithChildren(parameters));
export const svg = (...parameters) => taggedElement("svg", toPropertiesWithChildren(parameters));
export const math = (...parameters) => taggedElement("math", toPropertiesWithChildren(parameters));
export const canvas = (...parameters) => taggedElement("canvas", toPropertiesWithChildren(parameters));
export const noscript = (...parameters) => taggedElement("noscript", toPropertiesWithChildren(parameters));
export const script = (...parameters) => taggedElement("script", toPropertiesWithChildren(parameters));
export const del = (...parameters) => taggedElement("del", toPropertiesWithChildren(parameters));
export const ins = (...parameters) => taggedElement("ins", toPropertiesWithChildren(parameters));
export const caption = (...parameters) => taggedElement("caption", toPropertiesWithChildren(parameters));
export const col = (...parameters) => taggedElement("col", toPropertiesWithChildren(parameters));
export const colgroup = (...parameters) => taggedElement("colgroup", toPropertiesWithChildren(parameters));
export const table = (...parameters) => taggedElement("table", toPropertiesWithChildren(parameters));
export const tbody = (...parameters) => taggedElement("tbody", toPropertiesWithChildren(parameters));
export const td = (...parameters) => taggedElement("td", toPropertiesWithChildren(parameters));
export const tfoot = (...parameters) => taggedElement("tfoot", toPropertiesWithChildren(parameters));
export const th = (...parameters) => taggedElement("th", toPropertiesWithChildren(parameters));
export const thead = (...parameters) => taggedElement("thead", toPropertiesWithChildren(parameters));
export const tr = (...parameters) => taggedElement("tr", toPropertiesWithChildren(parameters));
export const button = (...parameters) => taggedElement("button", toButtonProperties(parameters));
export const datalist = (...parameters) => taggedElement("datalist", toPropertiesWithChildren(parameters));
export const fieldset = (...parameters) => taggedElement("fieldset", toPropertiesWithChildren(parameters));
export const form = (...parameters) => taggedElement("form", toPropertiesWithChildren(parameters));
export const input = (...parameters) => taggedElement("input", toInputProperties(parameters));
export const label = (...parameters) => taggedElement("label", toPropertiesWithChildren(parameters));
export const legend = (...parameters) => taggedElement("legend", toPropertiesWithChildren(parameters));
export const meter = (...parameters) => taggedElement("meter", toPropertiesWithChildren(parameters));
export const optgroup = (...parameters) => taggedElement("optgroup", toPropertiesWithChildren(parameters));
export const option = (...parameters) => taggedElement("option", toPropertiesWithChildren(parameters));
export const output = (...parameters) => taggedElement("output", toPropertiesWithChildren(parameters));
export const progress = (...parameters) => taggedElement("progress", toPropertiesWithChildren(parameters));
export const select = (...parameters) => taggedElement("select", toPropertiesWithChildren(parameters));
export const textarea = (...parameters) => taggedElement("textarea", toPropertiesWithChildren(parameters));
export const details = (...parameters) => taggedElement("details", toPropertiesWithChildren(parameters));
export const dialog = (...parameters) => taggedElement("dialog", toPropertiesWithChildren(parameters));
export const summary = (...parameters) => taggedElement("summary", toPropertiesWithChildren(parameters));
export const slot = (...parameters) => taggedElement("slot", toPropertiesWithChildren(parameters));
export const template = (...parameters) => taggedElement("template", toPropertiesWithChildren(parameters));



















