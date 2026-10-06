import assert from "assert";
import { fillTemplate } from "../template.js";
import { normalizeRoute, routeOf } from "../prerender.js";

const template = `<!doctype html>
<html>
  <head>
    <title>Shop</title>
    <script type="module" src="/shop/assets/index.js"></script>
  </head>
  <body>
    <div id="application" style="height:100%"></div>
  </body>
</html>`;

describe("fillTemplate", function () {
  it("puts the snapshot into the root, marked prerendered - the scripts stay", function () {
    const page = fillTemplate(template, { root: "application", html: "<h1>Red shoe</h1>" });
    assert.ok(page.includes(`<div id="application" style="height:100%" data-prerendered><h1>Red shoe</h1></div>`));
    assert.ok(page.includes(`<script type="module" src="/shop/assets/index.js"></script>`));
  });

  it("replaces the title, and adds head tags and style sheets", function () {
    const page = fillTemplate(template, {
      root: "application",
      html: "",
      title: "Shoes & <boots>",
      head: [`<meta data-cascade-head="" name="description" content="Shoes">`],
      styles: [".a{color:red}"],
    });
    assert.ok(page.includes("<title>Shoes &amp; &lt;boots&gt;</title>"));
    assert.ok(!page.includes("<title>Shop</title>"));
    assert.ok(page.includes(`<meta data-cascade-head="" name="description" content="Shoes">`));
    assert.ok(page.includes(`<style data-prerendered>.a{color:red}</style>`));
    assert.ok(page.indexOf("data-prerendered>.a") < page.indexOf("</head>"));
  });

  it("is an html replacement, not a pattern: $ in the snapshot stays as it is", function () {
    const page = fillTemplate(template, { root: "application", html: "<p>$& $1 99$</p>", title: "$1" });
    assert.ok(page.includes("<p>$& $1 99$</p>"));
    assert.ok(page.includes("<title>$1</title>"));
  });

  it("says so when there's no root, or it isn't empty", function () {
    assert.throws(() => fillTemplate(template, { root: "app", html: "" }), /no element with id "app"/);
    assert.throws(() => fillTemplate(template.replace("></div>", ">Loading</div>"), { root: "application", html: "" }), /isn't empty/);
  });
});

describe("routes", function () {
  it("are kept without slashes; assets aren't routes", function () {
    assert.equal(normalizeRoute("/product/12/"), "product/12");
    assert.equal(normalizeRoute(""), "");
    assert.equal(normalizeRoute("/product/12?color=red#top"), "product/12");
    assert.equal(normalizeRoute("assets/logo.svg"), null);
  });

  it("a link is followed only within the app", function () {
    const origin = "http://127.0.0.1:5000";
    assert.equal(routeOf(origin + "/shop/product/12", origin, "/shop/"), "product/12");
    assert.equal(routeOf(origin + "/shop", origin, "/shop/"), "");
    assert.equal(routeOf(origin + "/elsewhere", origin, "/shop/"), null);
    assert.equal(routeOf("https://other.example/shop/x", origin, "/shop/"), null);
    assert.equal(routeOf("mailto:someone@example.com", origin, "/shop/"), null);
  });
});
