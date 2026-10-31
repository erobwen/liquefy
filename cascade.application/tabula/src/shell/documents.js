import { CompoundServiceLocator } from "@liquefy/cascade.component";
import { hydrate, dehydrate, Unhydrated } from "./hydration.js";
import { pageLayoutKinds, pageLayoutFamilies, pageSettingKeys, rootPageLayout } from "../model/pageLayout.js";

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
 * whatever shape that kind's plugin likes, further queries in it for the
 * objects it's made of (see hydration.js): every object in a file is a
 * query. And `null` is the null document: nothing yet - the place where
 * something is to be created.
 *
 * A plugin is a service locator (anything with `locate(query)`, see
 * documentPlugin() below) answering:
 *
 *   { type: "documentType", name }  - the document type of that name, if it has it
 *   { type: "documentTypes" }       - all of them, for the creation menu
 *   { type: "document", name, properties }  - a document of that kind, hydrated
 *   { type: "family", name }        - a family of objects it makes: { baseClass }
 *   { type, name, properties }      - an object of a kind of its own, hydrated - a
 *                                     flow, say: the objects its documents are made of
 *
 * The plugins in use are composed into one locator - an
 * ObservableCompoundServiceLocator, so turning a plugin on or off rebuilds
 * whatever looked something up through it. Loading a document hydrates it
 * through that locator (hydrateDocument()) - Tabula's own in front, saying
 * what every document is (a HydratedDocument) - and saving it dehydrates it
 * (dehydrateDocument()).
 *
 * A document type:
 *
 *   {
 *     name, label, icon, description,   // icon: a Material Symbols name
 *     create(),                         // a new, empty model
 *     hydrate(properties),              // its properties, hydrated -> the model
 *     dehydrate(model),                 // the model -> its properties: plain values,
 *                                       //   and objects that dehydrate themselves
 *     editor({ key, model, zoom, onRemove, target, paperSequence }),  // the component editing it
 *     title(model),                     // optional: what it is called
 *     outline(model),                   // optional: what is in it, for the tree mode -
 *                                       //   [{ label, icon, children }]
 *     layout({ key, model }),           // optional: its layout - a cascade.print Box (see
 *                                       //   ../print/Box.js) laying it out onto paper:
 *                                       //   among pages of their own in another
 *                                       //   document (see ../layout/DocumentLayout.js's
 *                                       //   InsertLayout), on that one's papers
 *     print(model, { paperSequence }),  // optional: its pages, for printing (see
 *                                       //   ../print/dom.js printPages()) - or a
 *                                       //   promise of them; `paperSequence`, as
 *                                       //   for its editor: where it's laid out
 *     settingsPage(),                   // optional: its page of the settings dialog -
 *                                       //   its options (see settingsDialog.js), built there
 *     frame: {                          // optional: how it's shown in a frame, in
 *                                       //   another document (see ../model/frames.js)
 *       places,                         //   where it can be created: ["text", "page"] -
 *                                       //   in the text, on a page (../model/pageLayout.js)
 *       aspectRatio(model),             //   width / height
 *       view(model, page),              //   the component showing it, filling the frame -
 *                                       //   on a page, `page` is { page, pages }
 *       printNode(model, page),         //   optional: a DOM node of it, for printing
 *       controls(model),                //   optional: its own, in the frame's context menu
 *     },
 *   }
 *
 * A shortcut is a type of its own in the creation menus, but no kind of
 * document - { name, label, icon, description, createDocument() }: a
 * document of another kind, made ready (an Image: a page with a picture on
 * it, see ../plugins/page).
 *
 * A type with an editor is a document of its own - created at the root,
 * from the creation dots (rootDocumentTypes()); one with a frame is
 * created in another, from the creation menu, where the focus is - in the
 * text, at the caret; on a page, in a page layout - if it can be there
 * (frameTypes(services, place)). An image has only a frame, for now; a structured text
 * only an editor - in the end, either could be both.
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
 * `paperSequence`, when given, is where its kind's layout has already laid it
 * out - among pages of their own in another document, by that one's layout:
 * its papers, to show and edit, not laid out again.
 *
 * A document inside a document - a picture in a text's frame, in the end a
 * spreadsheet in a text, a text in a spreadsheet - is a query like any other
 * in its properties: hydrated by its own kind's plugin, each kind knowing
 * only its own.
 *
 * Hydrated, a document is a HydratedDocument - its `documentType` and its
 * `model` - or, if no plugin in use knows its kind (or something in it), an
 * Unhydrated one (see hydration.js) - its `name`, and its `json`: kept as
 * it was, to be saved as it was, until a plugin that knows it is turned on.
 *
 * What a file holds - the root - is one of three: `null` (the null
 * document), a document, or a list of documents (a sequence) - JSON allows
 * a list at the top level. Hydrated, it's always a list (hydrateRoot()):
 * empty, one document, or several. Dehydrated, a list of one is the
 * document itself, and an empty one null (dehydrateRoot()) - so a sequence
 * is there only while there's more than one document in it: removing all
 * but one leaves the one, on its own, at the root again.
 */

// A document, hydrated: what kind it is, and its model.
export class HydratedDocument {
  constructor(documentType, model) {
    this.documentType = documentType;
    this.model = model;
  }

  dehydrate() {
    return { type: "document", name: this.documentType.name, properties: this.documentType.dehydrate(this.model) };
  }
}

// A plugin: its document types - and the kinds of object their documents
// are made of, `kinds`, { [family]: { [name]: (properties) => object } },
// and what each family is, `families`, { [family]: { baseClass } } (see
// hydration.js).
export function documentPlugin({ name, label, description, documentTypes, kinds = {}, families = {} }) {
  return {
    name,
    label,
    description,
    documentTypes,
    locate(query) {
      if (query.type === "documentType") return documentTypes.find((type) => type.name === query.name);
      if (query.type === "documentTypes") return documentTypes;
      if (query.type === "document") {
        const type = documentTypes.find((each) => each.name === query.name);
        return type ? new HydratedDocument(type, type.hydrate(query.properties || {})) : undefined;
      }
      if (query.type === "family") return families[query.name];
      const make = kinds[query.type] && kinds[query.type][query.name];
      return make ? make(query.properties || {}) : undefined;
    },
  };
}

// Tabula's own, in front of the plugins: what every document is - kept, if
// no plugin in use knows it - and page layouts, the file's, anything's (see
// ../model/pageLayout.js).
const tabulaLocator = {
  locate: (query) => {
    if (query.type === "family" && query.name === "document") return { baseClass: HydratedDocument, keepUnknown: true };
    if (query.type === "family" && pageLayoutFamilies[query.name]) return pageLayoutFamilies[query.name];
    const make = pageLayoutKinds[query.type] && pageLayoutKinds[query.type][query.name];
    if (make) return make(query.properties || {});
    return undefined;
  },
};
const withTabula = (services) => new CompoundServiceLocator(tabulaLocator, services);

// The document types every plugin in `services` has - in the order the
// plugins are in. Not a lookup - the first one answering - but all of
// them, so it asks each plugin in turn.
export function documentTypes(services) {
  return services.locators.flatMap((locator) => locator.locate({ type: "documentTypes" }) || []);
}

// The kinds a document of its own can be - what the creation dots create,
// at the top level and among pages of their own: a kind with an editor, or
// a shortcut making one (`createDocument()`, see createDocument()) - and
// the kinds a frame in one can hold (see above): what's created in a
// document, from the creation menu - pictures, shapes, page numbers.
export const rootDocumentTypes = (services) => documentTypes(services).filter((type) => !!type.editor || !!type.createDocument);
export const frameTypes = (services, place = null) => documentTypes(services)
  .filter((type) => !!type.frame && (!place || (type.frame.places || ["text"]).includes(place)));

export const documentType = (services, name) => services.locate({ type: "documentType", name });

// A new document of `type` - hydrated, as if loaded. A shortcut - a type
// with `createDocument()` - makes a document of another kind, as it likes:
// a page with a picture on it, say (see ../plugins/page).
export function createDocument(type) {
  return type.createDocument ? type.createDocument() : new HydratedDocument(type, type.create());
}

export function hydrateDocument(json, services) {
  if (json === null || typeof(json) === "undefined") return null;
  if (typeof(json) !== "object" || json.type !== "document" || typeof(json.name) !== "string") {
    throw new Error("Not a document: " + JSON.stringify(json).slice(0, 80));
  }
  return hydrate(json, withTabula(services));
}

export function dehydrateDocument(hydrated) {
  return hydrated ? dehydrate(hydrated) : null;
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

/**
 * A whole file: its root - what it's designed for, and what's in it:
 *
 *   { "type": "root", "name": "tabula", "properties": {
 *     "pageLayout": { "type": "pageLayout", "name": "pages", "properties": { "paper": "A4", ... } },
 *     "print": { "duplex": true },     // the printer's: both sides of the paper, or one
 *     "items": [ ...documents ]
 *   } }
 *
 * `pageLayout`: what all of it is designed for - the base page layout (see
 * ../model/pageLayout.js): every setting, no content - each document's
 * derived from it. `print`: how it's printed - the printer's
 * settings, not the design: a printer that can't print as it's designed
 * does its best by it.
 *
 * Hydrated: { documents, print, pageLayout }. A file from before there was a
 * root - a document, a list of them (see hydrateRoot()), a sequence saying
 * how it's printed - read as it was: the page settings of the first
 * document with any the file's (see liftPageSettings()), and the pages a
 * document had before its title - a cover - before it in the file.
 */
export function hydrateFile(json, services) {
  const isObject = json && typeof(json) === "object" && !(json instanceof Array);
  const printOf = (properties) => Object.freeze({ duplex: !!(properties.print && properties.print.duplex) });
  if (isObject && json.type === "root") {
    const properties = json.properties || {};
    const base = properties.pageLayout ? hydrate(properties.pageLayout, withTabula(services)) : null;
    return {
      documents: hydrateRoot(properties.items || [], services),
      print: printOf(properties),
      pageLayout: rootPageLayout(base ? definedSettings(base) : {}),
    };
  }
  const old = isObject && json.type === "sequence" && json.name === "root";
  const documents = coversBefore(hydrateRoot(old ? (json.properties || {}).items || [] : json, services));
  return { documents, print: old ? printOf(json.properties || {}) : Object.freeze({ duplex: false }), pageLayout: liftPageSettings(documents) };
}

export function dehydrateFile(documents, print = {}, pageLayout = rootPageLayout()) {
  return {
    type: "root",
    name: "tabula",
    properties: {
      pageLayout: dehydrate(pageLayout),
      print: { duplex: !!print.duplex },
      items: documents.map((each) => dehydrateDocument(each)),
    },
  };
}

// The settings a page setup has - those it sets.
function definedSettings(setup) {
  return Object.fromEntries(pageSettingKeys.filter((key) => typeof(setup[key]) !== "undefined").map((key) => [key, setup[key]]));
}

// The file's page settings, for a file from before it had any: the first
// document's own (its `model.pageLayout`'s), the rest as nothing says otherwise -
// and every document's own settings that are the same as those taken out:
// only what's its own, apart from the file's, left.
function liftPageSettings(documents) {
  const layoutOf = (each) => each.model && each.model.pageLayout && typeof(each.model.pageLayout.hasSettings) === "function" ? each.model.pageLayout : null;
  const first = documents.find((each) => layoutOf(each) && layoutOf(each).hasSettings());
  const root = rootPageLayout(first ? definedSettings(layoutOf(first)) : {});
  for (const each of documents) {
    const own = layoutOf(each);
    if (!own) continue;
    for (const key of pageSettingKeys) {
      if (typeof(own[key]) !== "undefined" && sameSetting(own[key], root[key])) own[key] = undefined;
    }
  }
  return root;
}

const sameSetting = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A document's pages before its title - a cover, from before there was a
// root to put one before it on - before it, in the file.
function coversBefore(documents) {
  return documents.flatMap((each) => {
    const before = each.model && each.model.before;
    if (!before || !before.items) return [each];
    each.model.before = null;
    return [...before.items.filter((item) => item !== null), each];
  });
}


export function dehydrateRoot(documents) {
  if (documents.length === 0) return null;
  if (documents.length === 1) return dehydrateDocument(documents[0]);
  return documents.map((each) => dehydrateDocument(each));
}

// What kind of document it is, whether or not a plugin knows it.
export const documentName = (hydrated) => hydrated.documentType ? hydrated.documentType.name : hydrated.name;

export { Unhydrated };
