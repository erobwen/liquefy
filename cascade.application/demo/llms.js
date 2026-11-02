import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * llms.txt and llms-full.txt, for an AI reading the site (see
 * https://llmstxt.org): what Cascade is, and where its documentation is -
 * and the whole reference manual (cascade/docs/manual) as one Markdown
 * file, without the app around it. Made from the manual's files as the
 * app is built, so they say what the manual says.
 *
 * `site`: the origin the site will be at, for absolute addresses - as
 * cascadePrerender's. Without one, they're relative to the origin.
 */

const manual = join(dirname(fileURLToPath(import.meta.url)), "../../cascade/docs/manual");
const github = "https://github.com/erobwen/liquefy/blob/main/cascade/docs/manual/";

// The guide's pages - written as components, not Markdown: linked to.
const guide = [
  ["", "Introduction", "What Cascade is, temporal signals, its features, and how it compares to React."],
  ["getting-started", "Getting Started", "From an empty folder to a running Cascade app."],
  ["convenient-usage", "Everyday Usage", "The patterns for building components and keeping state."],
  ["advanced-usage", "Advanced Usage", "render(), targets, contexts, services and the other hard parts."],
  ["examples", "All Examples", "Every example in the demo, each with its code."],
];

export function llmsTxt({ site = "" } = {}) {
  let base;
  return {
    name: "cascade-llms-txt",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    generateBundle() {
      const url = (route) => site + base + route;
      const files = readdirSync(manual).filter((name) => /^\d+-.*\.md$/.test(name)).sort();
      const read = (name) => readFileSync(join(manual, name), "utf8").replace(/\r\n/g, "\n");
      // A chapter's page in the app - as ManualPage.js names it.
      const route = (name) => name === "README.md" ? "manual" : "manual-" + name.replace(/^\d+-/, "").replace(/\.md$/, "");
      const title = (source) => /^#\s+(.*)$/m.exec(source)[1];

      // Links in the manual: to another chapter, its page; to another file
      // of the repository, on GitHub.
      const absolute = (source) => source.replace(/\]\(([^)\s]+)\)/g, (whole, href) => {
        if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return whole;
        const [file, anchor] = href.split("#");
        const target = file === "README.md" || files.includes(file) ? url(route(file)) : github + file;
        return "](" + target + (anchor ? "#" + anchor : "") + ")";
      });

      const summary = [
        "# Cascade",
        "",
        "> Cascade is a reactive front end framework for JavaScript, built on temporal signals: components are rendered",
        "> straight onto the real DOM in one pass, in tree order, with an integrated state management system based on",
        "> JS Proxies. Packages: @liquefy/cascade.reactive, @liquefy/cascade.component, @liquefy/cascade.dom and",
        "> @liquefy/cascade.ui, on npm.",
        "",
        "This site is Cascade's demo and documentation, built with Cascade. Every page is prerendered as plain HTML.",
        "The reference manual is the complete documentation; llms-full.txt is all of it in one Markdown file.",
        "",
        "## Reference manual",
        "",
        `- [Contents](${url("manual")}): ${title(read("README.md"))}`,
        ...files.map((name) => `- [${title(read(name))}](${url(route(name))})`),
        `- [The whole manual, as Markdown](${url("llms-full.txt")})`,
        "",
        "## Guide",
        "",
        ...guide.map(([path, name, about]) => `- [${name}](${url(path)}): ${about}`),
        "",
        "## Optional",
        "",
        "- [Source code](https://github.com/erobwen/liquefy): the repository, with a README for each package.",
        `- [The manual's Markdown files](${github})`,
        "",
      ].join("\n");

      const full = [read("README.md"), ...files.map(read)].map(absolute).join("\n\n---\n\n");

      this.emitFile({ type: "asset", fileName: "llms.txt", source: summary });
      this.emitFile({ type: "asset", fileName: "llms-full.txt", source: full });
    },
  };
}
