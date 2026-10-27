/**
 * Documents and the plugins that know them - Tabula's core, the way
 * OpenDoc had it: Tabula itself edits nothing. Every kind of document -
 * structured text, plain text, a spreadsheet, ... - comes from a plugin, and
 * the user decides which plugins there are (in the settings).
 *
 * A document, saved, is plain JSON - a service query, as cascade.component
 * hydrates them (see its ServiceLocator.js):
 *
 *   { "type": "document", "name": "structuredText", "properties": { ... } }
 *
 * `name` says what kind of document it is, `properties` what's in it - in
 * whatever shape that kind's plugin likes. And `null` is the null document:
 * nothing yet - the place where something is to be created.
 *
 * A plugin is a service locator (anything with `locate(query)`, see
 * documentPlugin() below) answering two queries:
 *
 *   { type: "documentType", name }  - the document type of that name, if it has it
 *   { type: "documentTypes" }       - all of them, for the creation menu
 *
 * The plugins in use are composed into one locator - an
 * ObservableCompoundServiceLocator, so turning a plugin on or off rebuilds
 * whatever looked something up through it. Loading a document hydrates it
 * through that locator (hydrateDocument()); saving it dehydrates it
 * (dehydrateDocument()).
 *
 * A document type:
 *
 *   {
 *     name, label, icon, description,   // icon: a Material Symbols name
 *     create(),                         // a new, empty model
 *     hydrate(properties, documents),   // JSON properties -> the model
 *     dehydrate(model, documents),      // the model -> JSON properties
 *     editor({ key, model, zoom, onRemove, target }),  // the component editing it
 *     title(model),                     // optional: what it is called
 *     outline(model),                   // optional: what is in it, for the tree mode -
 *                                       //   [{ label, icon, children }]
 *     print(model),                     // optional: its pages, for printing (see
 *                                       //   ../print/dom.js printPages())
 *     settingsPage(),                   // optional: its page of the settings dialog -
 *                                       //   its options (see settingsDialog.js), built there
 *   }
 *
 * `target` is what the app renders onto (its mode, see TabulaApp.js):
 * "paper" or "web" - an editor shows its document as it can on that,
 * paper being the default. JSON and the tree are the app's own.
 *
 * An editor renders at its own height - documents are stacked, one under
 * the other, in one scrolling column on the paper grey (see TabulaApp.js) -
 * on whatever surface it likes: papers, a sheet, a grid. `zoom` is the
 * app's (1 for 100%). `onRemove`, when given, takes the document out of
 * the sequence it's in: the editor shows a remove button for it - where it
 * likes, at the top left of its first surface, say (removeButton()).
 *
 * `documents`, given to hydrate() and dehydrate(), does the same for a
 * document inside the document - `documents.hydrate(json)`,
 * `documents.dehydrate(hydrated)` - so that a spreadsheet can live in a text
 * and a text in a spreadsheet, each kind knowing only its own.
 *
 * Hydrated, a document is `{ documentType, model }` - or, if no plugin in
 * use knows its kind, `{ name, json }`: kept as it was, to be saved as it
 * was, until a plugin that knows it is turned on.
 *
 * What a file holds - the root - is one of three: `null` (the null
 * document), a document, or a list of documents (a sequence) - JSON allows
 * a list at the top level. Hydrated, it's always a list (hydrateRoot()):
 * empty, one document, or several. Dehydrated, a list of one is the
 * document itself, and an empty one null (dehydrateRoot()) - so a sequence
 * is there only while there's more than one document in it: removing all
 * but one leaves the one, on its own, at the root again.
 */

export function documentPlugin({ name, label, description, documentTypes }) {
  return {
    name,
    label,
    description,
    documentTypes,
    locate(query) {
      if (query.type === "documentType") return documentTypes.find((type) => type.name === query.name);
      if (query.type === "documentTypes") return documentTypes;
      return undefined;
    },
  };
}

// The document types every plugin in `services` has - in the order the
// plugins are in. Not a lookup - the first one answering - but all of
// them, so it asks each plugin in turn.
export function documentTypes(services) {
  return services.locators.flatMap((locator) => locator.locate({ type: "documentTypes" }) || []);
}

export const documentType = (services, name) => services.locate({ type: "documentType", name });

// A new document of `type` - hydrated, as if loaded.
export function createDocument(type) {
  return { documentType: type, model: type.create() };
}

export function hydrateDocument(json, services) {
  if (json === null || typeof(json) === "undefined") return null;
  if (typeof(json) !== "object" || json.type !== "document" || typeof(json.name) !== "string") {
    throw new Error("Not a document: " + JSON.stringify(json).slice(0, 80));
  }
  const type = documentType(services, json.name);
  if (!type) return { name: json.name, json };
  return { documentType: type, model: type.hydrate(json.properties || {}, documentsWith(services)) };
}

export function dehydrateDocument(hydrated, services) {
  if (!hydrated) return null;
  if (!hydrated.documentType) return hydrated.json;
  const { documentType: type, model } = hydrated;
  return { type: "document", name: type.name, properties: type.dehydrate(model, documentsWith(services)) };
}

export function hydrateRoot(json, services) {
  if (json === null || typeof(json) === "undefined") return [];
  if (json instanceof Array) {
    return json.map((each) => {
      if (each === null || each instanceof Array) throw new Error("A sequence holds documents - not null, nor another sequence.");
      return hydrateDocument(each, services);
    });
  }
  return [hydrateDocument(json, services)];
}

export function dehydrateRoot(documents, services) {
  if (documents.length === 0) return null;
  if (documents.length === 1) return dehydrateDocument(documents[0], services);
  return documents.map((each) => dehydrateDocument(each, services));
}

// What a document type is given, for the documents inside its own.
const documentsWith = (services) => ({
  hydrate: (json) => hydrateDocument(json, services),
  dehydrate: (hydrated) => dehydrateDocument(hydrated, services),
});

// What kind of document it is, whether or not a plugin knows it.
export const documentName = (hydrated) => hydrated.documentType ? hydrated.documentType.name : hydrated.name;
