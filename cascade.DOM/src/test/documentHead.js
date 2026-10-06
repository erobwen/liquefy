import { JSDOM } from "jsdom";
import assert from "assert";
import { observable } from "@liquefy/cascade.component";
import { documentHead } from "../DocumentHead.js";

// documentHead(): the head built from the app's data, following it.
describe("documentHead", function () {
  let dom;
  let head;

  beforeEach(function () {
    dom = new JSDOM("<!DOCTYPE html><head><title>App</title><meta name=\"viewport\" content=\"x\"></head><body></body>", { url: "https://shop.example/store/" });
    global.document = dom.window.document;
  });

  afterEach(function () {
    if (head) head.dispose();
    head = null;
  });

  const metaContent = (selector) => {
    const element = document.head.querySelector(selector);
    return element && (element.getAttribute("content") || element.getAttribute("href"));
  };

  it("writes the title, description, canonical address and Open Graph tags", function () {
    head = documentHead(() => ({ title: "Red shoe", description: "A red shoe.", canonical: "/store/shoe", image: "/img/shoe.jpg", type: "product" }));
    assert.equal(document.title, "Red shoe");
    assert.equal(metaContent("meta[name=description]"), "A red shoe.");
    assert.equal(metaContent("link[rel=canonical]"), "https://shop.example/store/shoe", "made absolute");
    assert.equal(metaContent("meta[property='og:url']"), "https://shop.example/store/shoe");
    assert.equal(metaContent("meta[property='og:image']"), "https://shop.example/img/shoe.jpg");
    assert.equal(metaContent("meta[property='og:type']"), "product");
    assert.equal(metaContent("meta[name=viewport]"), "x", "what isn't its own is left alone");
  });

  it("follows the data it was built from", function () {
    const state = observable({ product: "Red shoe" });
    head = documentHead(() => ({ title: state.product, description: "About " + state.product }));
    state.product = "Blue shoe";
    assert.equal(document.title, "Blue shoe");
    assert.equal(metaContent("meta[name=description]"), "About Blue shoe");
    assert.equal(document.head.querySelectorAll("meta[name=description]").length, 1, "replaced, not added to");
  });

  it("writes structured data, with \"</\" escaped", function () {
    head = documentHead(() => ({ structuredData: { "@type": "Product", name: "</script> shoe" } }));
    const script = document.head.querySelector("script[type='application/ld+json']");
    assert.ok(!script.textContent.includes("</"));
    assert.equal(JSON.parse(script.textContent).name, "</script> shoe");
  });

  it("replaces the tags a page came with (a prerendered one's), and removes its own on dispose", function () {
    document.head.insertAdjacentHTML("beforeend", "<meta data-cascade-head name=\"description\" content=\"old\">");
    head = documentHead(() => ({ description: "new" }));
    assert.equal(document.head.querySelectorAll("meta[name=description]").length, 1);
    assert.equal(metaContent("meta[name=description]"), "new");
    head.dispose();
    head = null;
    assert.equal(document.head.querySelectorAll("[data-cascade-head]").length, 0);
  });
});
