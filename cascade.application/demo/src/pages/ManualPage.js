import { Component, callback } from "@liquefy/cascade.component";
import { a, div, h1, mark, p, text } from "@liquefy/cascade.dom";
import { textField, themeColor } from "@liquefy/cascade.ui";
import { article } from "../components/layout.js";
import { markdown, plain, slug } from "../components/markdown.js";

/**
 * The reference manual - cascade/docs/manual, one Markdown file per
 * chapter, shown here as they are: a page per chapter, under the manual's
 * own header in the menu, and the contents first, with a search through
 * all of it. The files are the manual; these pages only show them (see
 * components/markdown.js), so it reads the same here as on GitHub.
 */

const files = import.meta.glob("../../../../cascade/docs/manual/*.md", { query: "?raw", import: "default", eager: true });
const fileName = (path) => path.slice(path.lastIndexOf("/") + 1);
const source = (name) => Object.entries(files).find(([path]) => fileName(path) === name)[1];

// Shorter titles, for the menu.
const menuTitles = {
  "concepts": "Concepts", "project-setup": "Project Setup", "components": "Components",
  "identity": "Identity and Keys", "callbacks-and-frozen": "Callbacks and frozen()", "context": "Context",
  "services-and-hydration": "Services and Hydration", "reactivity": "Reactivity", "dom-and-ui": "DOM and UI",
  "pitfalls-and-rules": "Pitfalls and Rules", "api-reference": "API Reference",
};

// Every chapter: its file, its page's key, its title and its sections.
export const chapters = Object.keys(files).map(fileName).filter((name) => /^\d+-/.test(name)).sort().map((name) => {
  const id = name.replace(/^\d+-/, "").replace(/\.md$/, "");
  const markdownSource = source(name);
  const title = plain(/^#\s+(.*)$/m.exec(markdownSource)[1]);
  return { file: name, key: "manual-" + id, title, menuTitle: menuTitles[id] || title, source: markdownSource, sections: sectionsOf(markdownSource) };
});

// A chapter's sections, for searching: each heading, its anchor, and the
// text under it, without its Markdown.
function sectionsOf(markdownSource) {
  const sections = [];
  let inCode = false;
  for (const line of markdownSource.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    const heading = !inCode && /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) sections.push({ title: plain(heading[1]), anchor: slug(plain(heading[1])), body: "" });
    else if (sections.length > 0) sections[sections.length - 1].body += plain(line) + "\n";
  }
  return sections;
}

const github = "https://github.com/erobwen/liquefy/blob/main/cascade/docs/manual/";

// Where a link in the manual goes: another chapter (or a heading in one) is
// a page of the app - a real link, and a plain click goes there, at the
// heading, without loading the app anew; another file of the repository is
// on GitHub; anything else is the web's.
function linker(location) {
  // A callback of its own for each link - the same place may be linked
  // to more than once.
  const linked = new Map();
  return (href) => {
    const occurrence = (linked.get(href) || 0) + 1;
    linked.set(href, occurrence);
    if (/^[a-z]+:/i.test(href)) return { href, target: "_blank", rel: "noopener" };
    const [file, anchor] = href.split("#");
    const chapter = file === "" ? null : chapters.find((each) => each.file === file);
    const key = file === "" ? undefined : file === "README.md" ? "manual" : chapter && chapter.key;
    if (file !== "" && !key) return { href: github + href, target: "_blank", rel: "noopener" };
    const path = key ? [key] : location.path;
    return {
      href: location.href(path) + (anchor ? "#" + anchor : ""),
      onclick: callback("link " + href + " " + occurrence, (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (key) location.navigate(path);
        if (anchor) requestAnimationFrame(() => {
          const heading = document.getElementById(anchor);
          if (heading) heading.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      }),
    };
  };
}

// A chapter: its file, as it is.
export class ManualChapterPage extends Component {
  setProperties({ chapter }) {
    this.chapter = chapter;
  }

  build() {
    const chapter = this.chapter;
    const next = chapters[chapters.indexOf(chapter) + 1];
    const link = linker(this.inherit("location"));
    return article(
      ...markdown(chapter.source, { link }),
      div(
        { style: { display: "flex", justifyContent: "space-between", gap: "16px", marginTop: "32px", fontWeight: "bold" } },
        a(link("README.md"), text("← Contents")),
        next ? a(link(next.file), text(next.title + " →")) : null,
      ),
    );
  }
}

// The contents - and a search through every chapter.
export class ManualContentsPage extends Component {
  initialState() {
    return { query: "" };
  }

  build() {
    const link = linker(this.inherit("location"));
    const contents = source("README.md");
    return article(
      h1({ style: { fontSize: "30px", margin: "24px 0 12px 0" } }, text("Reference Manual")),
      p(text("Everything there is to know before building with Cascade - in more detail than the guide's examples. Search it all, or read it chapter by chapter.")),
      textField({
        placeholder: "Search the manual - keep(), frozen, render context...",
        value: this.query,
        onInput: callback("search", (value) => { this.query = value; }),
        style: { width: "100%", margin: "8px 0 16px 0" },
      }),
      this.query.trim() !== ""
        ? new SearchResults({ query: this.query, link })
        // The contents, as written - without the title it shares with the page.
        : markdown(contents.replace(/^#\s+.*\n/, ""), { link }),
    );
  }
}

// What a search finds: every section with every word of the query in it,
// those with them in the heading first - each with where it first says so.
class SearchResults extends Component {
  setProperties({ query, link }) {
    this.query = query;
    this.link = link;
  }

  build() {
    const words = this.query.toLowerCase().split(/\s+/).filter((word) => word !== "");
    const found = [];
    for (const chapter of chapters) {
      for (const section of chapter.sections) {
        const all = (section.title + "\n" + section.body).toLowerCase();
        if (!words.every((word) => all.includes(word))) continue;
        const inTitle = words.every((word) => section.title.toLowerCase().includes(word));
        found.push({ chapter, section, inTitle });
      }
    }
    found.sort((x, y) => (y.inTitle ? 1 : 0) - (x.inTitle ? 1 : 0));
    if (found.length === 0) return p({ style: { color: themeColor.textSoft } }, text("Nothing in the manual says that."));
    return div(
      p({ style: { color: themeColor.textSoft } }, text(found.length + (found.length === 1 ? " section" : " sections"))),
      ...found.slice(0, 100).map(({ chapter, section }) => div(
        { key: chapter.key + "#" + section.anchor, style: { margin: "0 0 16px 0" } },
        a(
          { ...this.link(chapter.file + "#" + section.anchor), style: { fontWeight: "bold", color: themeColor.accentDark } },
          text(section.title),
        ),
        section.title !== chapter.title ? div({ style: { fontSize: "13px", color: themeColor.textSoft } }, text(chapter.title)) : null,
        div({ style: { fontSize: "14px" } }, ...snippet(section.body, words)),
      )),
    );
  }
}

// Around where the text first says one of `words` - with what it says
// marked.
function snippet(body, words) {
  const flat = body.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  const at = Math.min(...words.map((word) => lower.indexOf(word)).filter((index) => index >= 0), flat.length);
  const start = Math.max(0, at - 80);
  const shown = (start > 0 ? "…" : "") + flat.slice(start, start + 220) + (start + 220 < flat.length ? "…" : "");
  const pattern = new RegExp("(" + words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  return shown.split(pattern).map((part, index) => index % 2 === 1 ? mark(text(part)) : text(part));
}
