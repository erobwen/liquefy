import { repeat, retractRepeater } from "@liquefy/cascade.component";

/**
 * The document's head - its title, and what search engines, link previews
 * and other machines read about a page - as something built from the app's
 * own data:
 *
 *   documentHead(() => {
 *     const product = store.productAt(location.path);
 *     return { title: product.name, description: product.summary, image: product.photo, canonical: location.href(location.path) };
 *   });
 *
 * `describe` is run again whenever anything it read changes (it's a
 * repeater, see cascade.component's repeat()): navigate to another product,
 * and the head follows. It returns a plain description - it reads, but
 * never writes:
 *
 *  - title: the document's title (and og:title).
 *  - description: <meta name="description"> (and og:description).
 *  - canonical: the page's own address - <link rel="canonical"> (and
 *    og:url). A path is made absolute against the document's origin.
 *  - image: og:image and a large twitter:card - made absolute too.
 *  - type: og:type ("website" unless given - "product", "article", ...).
 *  - meta: further tags, { name: content } - og:* and the like as
 *    <meta property>, everything else as <meta name>.
 *  - structuredData: an object (or several) for search engines' rich
 *    results - schema.org's Product, Offer, BreadcrumbList, ... - as
 *    <script type="application/ld+json">.
 *
 * The tags it adds are its own (data-cascade-head): those of a description
 * before are replaced, and so are any the page came with, written before
 * it ran (a prerendered page's) - nothing else in the head is touched.
 *
 * Returns a handle; dispose() stops following and removes its tags.
 */
export function documentHead(describe, options = {}) {
  return new DocumentHead(describe, options);
}

const marker = "data-cascade-head";

export class DocumentHead {
  constructor(describe, { document: doc = globalThis.document } = {}) {
    this.document = doc;
    this.written = null;
    this.repeater = repeat(() => this.write(describe() || {}), { independent: true });
  }

  write(description) {
    const tags = headTags(description, this.document.location ? this.document.location.href : undefined);
    const html = JSON.stringify([description.title, tags]);
    if (html === this.written) return;
    this.written = html;
    if (typeof(description.title) === "string") this.document.title = description.title;
    this.removeTags();
    const head = this.document.head;
    for (const { tag, attributes, text } of tags) {
      const element = this.document.createElement(tag);
      element.setAttribute(marker, "");
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      if (text !== undefined) element.textContent = text;
      head.appendChild(element);
    }
  }

  removeTags() {
    for (const element of [...this.document.head.querySelectorAll(`[${marker}]`)]) element.remove();
  }

  dispose() {
    retractRepeater(this.repeater);
    this.removeTags();
    this.written = null;
  }
}

// The tags a description stands for - in a fixed order, so the same
// description always gives the same head.
function headTags({ title, description, canonical, image, type = "website", meta = {}, structuredData }, base) {
  const absolute = (url) => {
    try { return base ? new URL(url, base).href : url; } catch { return url; }
  };
  const tags = [];
  const named = (name, content) => tags.push({ tag: "meta", attributes: { name, content: String(content) } });
  const property = (name, content) => tags.push({ tag: "meta", attributes: { property: name, content: String(content) } });
  if (description) named("description", description);
  if (canonical) tags.push({ tag: "link", attributes: { rel: "canonical", href: absolute(canonical) } });
  if (title) property("og:title", title);
  if (description) property("og:description", description);
  if (canonical) property("og:url", absolute(canonical));
  if (type) property("og:type", type);
  if (image) {
    property("og:image", absolute(image));
    named("twitter:card", "summary_large_image");
  }
  for (const [name, content] of Object.entries(meta)) {
    if (content === undefined || content === null) continue;
    if (/^(og|article|product|music|video|book|profile|fb):/.test(name)) property(name, content);
    else named(name, content);
  }
  for (const data of [].concat(structuredData || [])) {
    // "</" can't end the script early: JSON allows it escaped.
    tags.push({ tag: "script", attributes: { type: "application/ld+json" }, text: JSON.stringify(data).replace(/<\//g, "<\\/") });
  }
  return tags;
}
