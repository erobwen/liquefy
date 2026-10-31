import assert from "assert";
import { ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { testDocument } from "../../../model/testDocument.js";
import { Flow, isSection, paragraphText } from "../../../model/flows.js";
import { structuredTextPlugin, structuredText } from "../index.js";
import { framesPlugin } from "../../frames/index.js";
import {
  hydrateDocument, dehydrateDocument, documentTypes, hydrateRoot, dehydrateRoot, HydratedDocument, Unhydrated,
} from "../../../shell/documents.js";

const saved = (document) => JSON.parse(JSON.stringify(dehydrateDocument(new HydratedDocument(structuredText, document))));

describe("Structured text, saved and loaded", function () {
  it("goes there and back: the same document, saved the same", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin, framesPlugin);
    const json = saved(testDocument());
    const back = hydrateDocument(json, services);
    assert.ok(back instanceof HydratedDocument);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dehydrateDocument(back))), json);
    assert.strictEqual(paragraphText(back.model.title), "Tabula");
    assert.ok(back.model.children.some(isSection));
  });

  it("is a query, every object in it a query too - a family and a kind - plain values between", function () {
    const json = saved(testDocument());
    assert.deepStrictEqual([json.type, json.name], ["document", "structuredText"]);
    const { properties } = json;
    assert.strictEqual(properties.pageLayout.properties.paper, "A4");
    assert.deepStrictEqual(properties.title, { type: "flow", name: "paragraph", properties: { spans: ["Tabula"] } });
    assert.deepStrictEqual([properties.pageLayout.type, properties.pageLayout.name], ["pageLayout", "pages"]);
    const [first] = properties.children;
    assert.deepStrictEqual([first.type, first.name], ["flow", "paragraph"]);
    // A span: a string unless bold or italic.
    assert.strictEqual(typeof(first.properties.spans[0]), "string");
    assert.deepStrictEqual(first.properties.spans[1], { text: "tree of flows", bold: true });
    const section = properties.children.find((child) => child.name === "section");
    assert.deepStrictEqual(Object.keys(section.properties).sort(), ["children", "title"]);
  });

  it("is made by whichever plugin provides flows - checked to be one, whoever made it", function () {
    const json = saved(testDocument());
    // A plugin making something else for a paragraph.
    const impostor = {
      locate: (query) => query.type === "flow" && query.name === "paragraph" ? { notAFlow: true } : undefined,
    };
    const services = new ObservableCompoundServiceLocator(impostor, structuredTextPlugin);
    assert.throws(() => hydrateDocument(json, services), /isn't a Flow/);
    // The base class asked for, for a plugin to choose by.
    let asked = null;
    const watcher = { locate: (query) => { if (query.type === "flow" && !asked) asked = query.baseClass; } };
    hydrateDocument(json, new ObservableCompoundServiceLocator(watcher, structuredTextPlugin));
    assert.strictEqual(asked, Flow);
  });

  it("is kept as it was, when no plugin in use knows it - or something in it - and saved as it was", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin);
    const json = saved(testDocument());
    const hydrated = hydrateDocument(json, services);
    assert.strictEqual(hydrated.documentType.name, "structuredText");
    assert.deepStrictEqual(documentTypes(services).map((type) => type.name), ["structuredText"]);

    services.locators = [];
    const unknown = hydrateDocument(json, services);
    assert.ok(unknown instanceof Unhydrated);
    assert.strictEqual(unknown.name, "structuredText");
    assert.strictEqual(dehydrateDocument(unknown), json);
    assert.strictEqual(hydrateDocument(null, services), null);
    // What it's made of wrong - a paper there's no size of - isn't unknown:
    // it fails.
    services.locators = [structuredTextPlugin];
    const layout = json.properties.pageLayout;
    assert.throws(() => hydrateDocument({ ...json, properties: { ...json.properties, pageLayout: { ...layout, properties: { ...layout.properties, paper: "B9" } } } }, services), /Unknown paper/);
  });

  it("is the root of a file on its own, or in a list - a sequence - and a list of one is the one again", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin);
    const json = saved(testDocument());
    assert.deepStrictEqual(hydrateRoot(null, services), []);
    assert.strictEqual(dehydrateRoot([]), null);
    assert.strictEqual(hydrateRoot(json, services).length, 1);
    const twice = JSON.parse(JSON.stringify(dehydrateRoot(hydrateRoot([json, json], services))));
    assert.deepStrictEqual(twice, [json, json]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dehydrateRoot(hydrateRoot([json], services)))), json);
    assert.throws(() => hydrateRoot([json, [json]], services));
  });
});
