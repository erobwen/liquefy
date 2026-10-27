import assert from "assert";
import { ObservableCompoundServiceLocator } from "@liquefy/cascade.component";
import { plugins } from "../../plugins/index.js";
import { pdf, pdfPlugin } from "../../plugins/pdf/index.js";
import { createDocument, hydrateRoot, dehydrateRoot, rootDocumentTypes, HydratedDocument, Unhydrated } from "../documents.js";

describe("A PDF document", function () {
  it("is one of the kinds a document of its own can be - created from the dots", function () {
    const services = new ObservableCompoundServiceLocator(...plugins);
    assert.ok(rootDocumentTypes(services).includes(pdf));
    const created = createDocument(pdf);
    assert.deepEqual([created.model.name, created.model.data], [null, null]);
  });

  it("is saved with its bytes in it, as base64 - and loaded back as it was, beside the others", function () {
    const services = new ObservableCompoundServiceLocator(...plugins);
    const json = [
      { type: "document", name: "pdf", properties: { name: "report.pdf", data: "JVBERi0xLjQK" } },
      { type: "document", name: "plainText", properties: { text: "After it" } },
    ];
    const documents = hydrateRoot(json, services);
    assert.ok(documents[0] instanceof HydratedDocument);
    assert.equal(documents[0].documentType, pdf);
    assert.deepEqual([documents[0].model.name, documents[0].model.data], ["report.pdf", "JVBERi0xLjQK"]);
    assert.deepEqual(JSON.parse(JSON.stringify(dehydrateRoot(documents))), json);
  });

  it("is kept as it was, saved as it was, with its plugin turned off", function () {
    const services = new ObservableCompoundServiceLocator(...plugins.filter((plugin) => plugin !== pdfPlugin));
    const json = { type: "document", name: "pdf", properties: { name: "report.pdf", data: "JVBERi0xLjQK" } };
    const [kept] = hydrateRoot(json, services);
    assert.ok(kept instanceof Unhydrated);
    assert.equal(dehydrateRoot([kept]), json);
  });
});
