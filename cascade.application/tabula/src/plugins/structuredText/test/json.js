import assert from "assert";
import { ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { testDocument } from "../../../model/testDocument.js";
import { isSection, paragraphText } from "../../../model/flows.js";
import { documentToJSON, documentFromJSON } from "../json.js";
import { structuredTextPlugin } from "../index.js";
import { hydrateDocument, dehydrateDocument, documentTypes, hydrateRoot, dehydrateRoot } from "../../../shell/documents.js";

describe("Structured text, as JSON", function () {
  it("goes there and back: the same document, its JSON the same", function () {
    const json = JSON.parse(JSON.stringify(documentToJSON(testDocument())));
    const back = documentFromJSON(json);
    assert.deepStrictEqual(documentToJSON(back), json);
    assert.strictEqual(paragraphText(back.title), "Tabula");
    assert.ok(back.children.some(isSection));
  });

  it("writes spans compactly - a string unless bold or italic - and the paper by name", function () {
    const json = documentToJSON(testDocument());
    assert.strictEqual(json.paper, "A4");
    assert.deepStrictEqual(json.title, ["Tabula"]);
    const spans = json.children[0].spans;
    assert.strictEqual(typeof(spans[0]), "string");
    assert.deepStrictEqual(spans[1], { text: "tree of flows", bold: true });
  });

  it("is hydrated through the plugins in use - and kept as it was when none knows it", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin);
    const json = { type: "document", name: "structuredText", properties: documentToJSON(testDocument()) };
    const hydrated = hydrateDocument(json, services);
    assert.strictEqual(hydrated.documentType.name, "structuredText");
    assert.deepStrictEqual(dehydrateDocument(hydrated, services), json);
    assert.deepStrictEqual(documentTypes(services).map((type) => type.name), ["structuredText"]);

    services.locators = [];
    const unknown = hydrateDocument(json, services);
    assert.strictEqual(unknown.documentType, undefined);
    assert.strictEqual(dehydrateDocument(unknown, services), json);
    assert.strictEqual(hydrateDocument(null, services), null);
  });

  it("is the root of a file on its own, or in a list - a sequence - and a list of one is the one again", function () {
    const services = new ObservableCompoundServiceLocator(structuredTextPlugin);
    const json = { type: "document", name: "structuredText", properties: documentToJSON(testDocument()) };
    assert.deepStrictEqual(hydrateRoot(null, services), []);
    assert.strictEqual(dehydrateRoot([], services), null);
    assert.strictEqual(hydrateRoot(json, services).length, 1);
    assert.deepStrictEqual(dehydrateRoot(hydrateRoot([json, json], services), services), [json, json]);
    assert.deepStrictEqual(dehydrateRoot(hydrateRoot([json], services), services), json);
    assert.throws(() => hydrateRoot([json, [json]], services));
  });
});
