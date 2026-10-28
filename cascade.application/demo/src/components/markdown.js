import { a, blockquote, code, div, em, h1, h2, h3, h4, hr, li, ol, p, strong, table, tbody, td, text, th, thead, tr, ul } from "@liquefy/cascade.dom";
import { themeColor } from "@liquefy/cascade.ui";
import { HighlightedCode } from "./code.js";

/**
 * markdown(source, { link }) - Markdown, as components: what the reference
 * manual (cascade/docs/manual) is written in, shown as pages of the demo.
 * The Markdown those files use, no more: headings (each with the id GitHub
 * gives it, for links to it), paragraphs, lists (nested, and with code in
 * them), tables, block quotes, rules, fenced code - highlighted, as
 * everywhere in the demo - and, in running text, code, bold, emphasis and
 * links.
 *
 * `link(href)`: the properties of a link to `href` (its href, a click
 * handler...) - so the app decides where a link in the text goes.
 */
export function markdown(source, { link }) {
  return blocks(source.replace(/\r\n/g, "\n").split("\n"), link);
}

// The id GitHub gives a heading: what its anchors link to.
export function slug(heading) {
  return heading.trim().toLowerCase().replace(/[^\w\- ]/g, "").replace(/ /g, "-");
}

// A heading's text without its Markdown: what it says.
export function plain(inlineText) {
  return inlineText.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*]/g, "");
}

const codeStyle = { margin: "8px 0 16px 0", border: "1px solid " + themeColor.border, borderRadius: "8px", overflow: "auto", lineHeight: "1.4" };
const languages = { js: "javascript", javascript: "javascript", jsx: "javascript", html: "html", xml: "html", bash: "bash", sh: "bash", console: "bash" };

const isFence = (line) => /^\s*```/.test(line);
const isListItem = (line) => /^\s*([-*]|\d+\.)\s+/.test(line);
const isTableRow = (line) => /^\s*\|/.test(line);
const startsBlock = (line) => isFence(line) || /^#{1,6}\s/.test(line) || isListItem(line) || isTableRow(line) || /^\s*>/.test(line) || /^\s*(---|\*\*\*)\s*$/.test(line);

function blocks(lines, link) {
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
    } else if (isFence(line)) {
      const language = line.trim().slice(3).trim();
      const body = [];
      for (i++; i < lines.length && !isFence(lines[i]); i++) body.push(lines[i]);
      i++;
      result.push(new HighlightedCode({ source: body.join("\n"), language: languages[language] || "plaintext", style: codeStyle }));
    } else if (/^#{1,6}\s/.test(line)) {
      const [, hashes, title] = /^(#{1,6})\s+(.*)$/.exec(line);
      const heading = [h1, h2, h3, h4, h4, h4][hashes.length - 1];
      result.push(heading({ id: slug(plain(title)), style: headingStyle[hashes.length] || headingStyle[4] }, ...inline(title, link)));
      i++;
    } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      result.push(hr({ style: { border: "none", borderTop: "1px solid " + themeColor.border, margin: "24px 0" } }));
      i++;
    } else if (/^\s*>/.test(line)) {
      const quoted = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) quoted.push(lines[i].replace(/^\s*>\s?/, ""));
      result.push(blockquote(
        { style: { margin: "12px 0", padding: "4px 16px", borderLeft: "4px solid " + themeColor.accent, background: themeColor.accentLight, borderRadius: "4px" } },
        ...blocks(quoted, link),
      ));
    } else if (isTableRow(line)) {
      const rows = [];
      for (; i < lines.length && isTableRow(lines[i]); i++) rows.push(cells(lines[i]));
      result.push(markdownTable(rows, link));
    } else if (isListItem(line)) {
      const [list, next] = listAt(lines, i, link);
      result.push(list);
      i = next;
    } else {
      const paragraph = [];
      for (; i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i]); i++) paragraph.push(lines[i].trim());
      result.push(p(...inline(paragraph.join(" "), link)));
    }
  }
  return result;
}

const headingStyle = {
  1: { fontSize: "30px", margin: "24px 0 12px 0" },
  2: { fontSize: "22px", margin: "32px 0 8px 0", paddingTop: "8px", borderTop: "1px solid " + themeColor.border },
  3: { fontSize: "18px", margin: "24px 0 6px 0" },
  4: { fontSize: "16px", margin: "20px 0 4px 0" },
};

// A list, from line `start`: every item at its indentation, each with what
// belongs to it - the lines indented further, dedented, as blocks of their
// own (a nested list, code). Returns the list and the line after it.
function listAt(lines, start, link) {
  const indent = lines[start].match(/^\s*/)[0].length;
  const ordered = /^\s*\d+\./.test(lines[start]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const lineIndent = line.match(/^\s*/)[0].length;
    if (!isListItem(line) || lineIndent !== indent) break;
    const marker = line.match(/^\s*([-*]|\d+\.)\s+/)[0];
    const body = [line.slice(marker.length)];
    for (i++; i < lines.length; i++) {
      const next = lines[i];
      const nextIndent = next.match(/^\s*/)[0].length;
      if (next.trim() === "") {
        // A blank line ends the item - unless what follows is still in it.
        const after = lines.slice(i + 1).find((each) => each.trim() !== "");
        if (!after || after.match(/^\s*/)[0].length <= indent) break;
        body.push("");
      } else if (nextIndent > indent) {
        body.push(next.slice(Math.min(nextIndent, marker.length)));
      } else if (!startsBlock(next) && body[body.length - 1] !== "") {
        body.push(next.trim()); // a lazy continuation of its text
      } else {
        break;
      }
    }
    // Just text: no paragraph around it.
    const single = body.every((each) => !startsBlock(each) && each.trim() !== "");
    items.push(li({ style: { margin: "4px 0" } }, ...(single ? inline(body.map((each) => each.trim()).join(" "), link) : blocks(body, link))));
    // Blank lines between items don't end the list.
    let next = i;
    while (next < lines.length && lines[next].trim() === "") next++;
    if (next > i && next < lines.length && isListItem(lines[next]) && indentOf(lines[next]) === indent) i = next;
  }
  return [(ordered ? ol : ul)({ style: { paddingLeft: "24px", margin: "8px 0" } }, ...items), i];
}

const indentOf = (line) => line.match(/^\s*/)[0].length;

// A table row's cells - split at the bars that aren't in code, or escaped.
function cells(line) {
  const result = [];
  let cell = "";
  let inCode = false;
  const content = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === "\\" && content[i + 1] === "|") { cell += "|"; i++; continue; }
    if (char === "`") inCode = !inCode;
    if (char === "|" && !inCode) { result.push(cell.trim()); cell = ""; continue; }
    cell += char;
  }
  result.push(cell.trim());
  return result;
}

function markdownTable(rows, link) {
  const isDivider = (row) => row.every((cell) => /^:?-+:?$/.test(cell));
  const [head, ...rest] = rows;
  const body = rest.filter((row) => !isDivider(row));
  const cellStyle = { padding: "6px 10px", borderBottom: "1px solid " + themeColor.border, textAlign: "left", verticalAlign: "top" };
  return div(
    { style: { overflowX: "auto", margin: "12px 0" } },
    table(
      { style: { borderCollapse: "collapse", fontSize: "14px", width: "100%" } },
      thead(tr(...head.map((cell) => th({ style: { ...cellStyle, borderBottom: "2px solid " + themeColor.borderStrong } }, ...inline(cell, link))))),
      tbody(...body.map((row) => tr(...row.map((cell) => td({ style: cellStyle }, ...inline(cell, link)))))),
    ),
  );
}

// Running text: code, bold, emphasis and links - the rest as it is.
const inlinePattern = /(`+)([\s\S]*?[^`])\1(?!`)|\*\*([\s\S]+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*?)\*/g;
const inlineCodeStyle = { fontSize: "0.92em", padding: "1px 4px", borderRadius: "4px", background: themeColor.page };

function inline(source, link) {
  const result = [];
  let last = 0;
  for (const match of source.matchAll(inlinePattern)) {
    if (match.index > last) result.push(text(source.slice(last, match.index)));
    const [, ticks, codeText, bold, label, href, emphasized] = match;
    if (ticks) result.push(code({ style: inlineCodeStyle }, text(codeText.trim())));
    else if (bold !== undefined) result.push(strong(...inline(bold, link)));
    else if (label !== undefined) result.push(a({ ...link(href), style: { color: themeColor.accentDark } }, ...inline(label, link)));
    else result.push(em(...inline(emphasized, link)));
    last = match.index + match[0].length;
  }
  if (last < source.length) result.push(text(source.slice(last)));
  return result;
}
