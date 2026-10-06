/**
 * A page's HTML, prerendered: the app's own index.html - the template - with
 * a snapshot of one address put into it. What's in the snapshot (see
 * capture.js):
 *
 *  - html: what the app rendered into its root element.
 *  - title: the document's title.
 *  - head: the head tags documentHead() wrote (data-cascade-head).
 *  - styles: the style sheets the app added to the head as it rendered -
 *    what the snapshot needs to look right before the app has loaded.
 *
 * The root element is marked data-prerendered: when the app starts, that's
 * how its PrerenderedElementTarget knows to replace the snapshot (see
 * PrerenderedElementTarget.js), and the snapshot's style sheets with it. Everything
 * else in the template - its scripts, its links - stays as it is.
 */
export function fillTemplate(template, { root, html, title, head = [], styles = [] }) {
  const rootPattern = new RegExp(`(<([a-zA-Z][\\w-]*)\\b[^>]*\\bid\\s*=\\s*["']${escapeRegExp(root)}["'][^>]*)>([\\s\\S]*?)(</\\2\\s*>)`);
  const match = template.match(rootPattern);
  if (!match) throw new Error(`cascade.prerender: no element with id "${root}" in the template - where should the app's snapshot go? (the "root" option)`);
  if (match[3].trim() !== "") throw new Error(`cascade.prerender: the template's #${root} isn't empty - the app's snapshot goes there, in place of nothing.`);
  let page = template.replace(rootPattern, () => `${match[1]} data-prerendered>${html}${match[4]}`);

  if (typeof(title) === "string" && title !== "") {
    const titleTag = `<title>${escapeText(title)}</title>`;
    page = /<title\b[^>]*>[\s\S]*?<\/title\s*>/i.test(page)
      ? page.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/i, () => titleTag)
      : insertIntoHead(page, titleTag);
  }

  const additions = [
    ...head,
    ...styles.map((css) => `<style data-prerendered>${css.replace(/<\/style/gi, "<\\/style")}</style>`),
  ];
  if (additions.length > 0) page = insertIntoHead(page, additions.join("\n    "));
  return page;
}

function insertIntoHead(page, html) {
  if (!/<\/head\s*>/i.test(page)) throw new Error("cascade.prerender: the template has no </head>.");
  return page.replace(/<\/head\s*>/i, (end) => `  ${html}\n  ${end}`);
}

export function escapeText(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
