import { Component, callback, serviceProvider, CompoundServiceLocator } from "@liquefy/cascade.component";
import { div, text, a } from "@liquefy/cascade.dom";
import { card, colorField, fitContainerStyle, overlayFrame, overlay, modalAssembly, colorSchemeScope } from "@liquefy/cascade.ui";
import { paperBackdrop } from "../paper/TabulaPaperView.js";
import { nullDocument } from "./NullDocument.js";
import { creationDot } from "./CreationDot.js";
import { removeButton } from "./removeButton.js";
import { documentTypes, rootDocumentTypes, frameTypes, documentType, documentName, createDocument, hydrateRoot, dehydrateRoot } from "./documents.js";
import { openFile, saveFile } from "./files.js";
import { jsonEditor } from "./json/JsonEditor.js";
import { treeView } from "./TreeView.js";
import { printPages } from "../print/dom.js";
import { paperLayout, appLayout, documentCard, appBackdrop } from "./layouts.js";
import { ContextMenus } from "./contextMenus.js";
import { Settings, settingsLocator, appSettingsDefaults } from "./settings.js";
import { settingsDialog, settingGroup, settingOption, settingSwitch } from "./settingsDialog.js";

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

// What the whole app renders onto - its render target, as the user sees it
// - and the layout that goes with it (see layouts.js). Paper and web are the
// plugins' to render (an editor's `target`, see documents.js); JSON and
// the tree are Tabula's own, over the whole root.
const modes = [
  { name: "paper", icon: "description", label: "Paper", layout: "paper" },
  { name: "web", icon: "language", label: "Web", layout: "app" },
  { name: "json", icon: "data_object", label: "JSON", layout: "app" },
  { name: "tree", icon: "account_tree", label: "Tree", layout: "app" },
];

/**
 * TabulaApp - Tabula as an editor of documents of any kind: the kinds come
 * from plugins (see documents.js), and Tabula itself is only this - the
 * documents, what can be done with them (new, open, save, print), the
 * settings (a modal dialog, see settingsDialog.js) and the mode - each placed where the mode's layout puts it. All
 * else is the documents' own: whatever has the focus offers its context
 * menus (see contextMenus.js), and the layout shows them.
 *
 *   new TabulaApp({ plugins, services, settings })
 *
 * `plugins` are all there are; `services` the ObservableCompoundServiceLocator
 * of the ones in use - its `locators`, which the settings change. It's put
 * in front of the app's render context too (serviceProvider()), so a plugin
 * can offer more than document types: widgets of its own, say. In front of
 * them, `settings` (see settings.js - how Tabula is set up, kept between
 * visits by whoever made it; for this visit only, if none is given), each
 * part asking for its own section through the locator.
 *
 * What's open is the root (see documents.js): no document - the null
 * document, a dot in the middle of the window, for creating one (see
 * NullDocument.js) - or documents, one under the other, in one column on
 * the paper grey, each rendered by its own plugin's editor, as it likes. A
 * creation dot above the first, between each two and after the last
 * creates a document there: one document becomes a sequence of them. With
 * more than one, each has a remove button; removing all but one leaves
 * the one, on its own, at the root again. The documents are hydrated when
 * opened, dehydrated when saved: in between, each is whatever model its
 * plugin made of it.
 *
 * The mode is what the whole app renders onto - paper (the default), the
 * web, JSON (the root as it's saved, edited as JSON, see
 * json/JsonEditor.js) or a tree (see TreeView.js) - and it owns the layout
 * of all of it (see layouts.js): on paper, cards floating over the papers,
 * zoom among them; otherwise an application's frame - a drawer on the
 * left, a bar along the bottom - and on the web, each document a card as
 * wide as there's room for. The app hands the layout the same parts,
 * whatever the mode. Printing is always on paper: each document as its
 * plugin prints it.
 *
 * The classic Tabula app (../Tabula.js), the word processor this grew out
 * of, is kept as it was, at classic.html - a reference for this one.
 */
export class TabulaApp extends Component {
  setProperties({ plugins, services, settings }) {
    this.plugins = plugins;
    this.services = services;
    this.settings = settings || new Settings();
  }

  initialState() {
    // documents: hydrated - none, one, or a sequence of them. fileName:
    // what they were opened from, and are saved as.
    // settingsShown: the settings dialog's page, while it's open.
    return { documents: [], fileName: null, message: null, zoom: 1, mode: "paper", settingsShown: null };
  }

  initialUnobservables() {
    // The context menus of whatever has the focus - taken by an editor, as
    // its caret is placed (see contextMenus.js).
    return {
      menus: new ContextMenus(),
      // The settings' sections first, then the plugins'.
      locator: new CompoundServiceLocator(settingsLocator(this.settings), this.services),
    };
  }

  // For the editors below: where to put their context menus - and the
  // settings dialog, opened on a page of it: a document type's name (see
  // documents.js), or "tabula", the app's own.
  provide() {
    return { contextMenus: this.unobservable.menus, openSettings: (page) => this.openSettings(page) };
  }

  openSettings(page = "tabula") {
    this.settingsShown = page;
  }

  show(documents, fileName = null) {
    this.documents = documents;
    this.fileName = fileName;
    this.message = null;
  }

  insert(index, type) {
    const documents = this.documents;
    this.documents = [...documents.slice(0, index), createDocument(type), ...documents.slice(index)];
  }

  remove(document) {
    this.documents = this.documents.filter((each) => each !== document);
  }

  async open() {
    try {
      const file = await openFile();
      if (!file) return;
      this.show(hydrateRoot(JSON.parse(file.text), this.services), file.name);
    } catch (error) {
      this.message = "Couldn't open it: " + error.message;
    }
  }

  save() {
    const json = dehydrateRoot(this.documents, this.services);
    saveFile(this.fileName || "document.json", JSON.stringify(json, null, 2));
  }

  // All of it, on paper - each document as its plugin prints it.
  print() {
    const pages = this.documents.flatMap((document) => {
      const type = document.documentType;
      return type && type.print ? type.print(document.model) : [];
    });
    printPages(pages, { title: this.fileName || "Tabula" }).catch((error) => { this.message = "Couldn't print it: " + error.message; });
  }

  // A change to the whole root, from the JSON mode: hydrated through the
  // plugins in use, and taken only if they can hold it - nothing in it a
  // plugin can't make into its model, and no document of a kind none of
  // them knows (but those there already). Says why not, if not.
  apply(json) {
    try {
      const documents = hydrateRoot(json, this.services);
      const unknown = (list) => list.filter((each) => !each.documentType).length;
      if (unknown(documents) > unknown(this.documents)) return "no plugin in use knows a document of that name";
      if (documents.length === 0) return "the root can't be emptied here - New does that";
      this.documents = documents;
      return null;
    } catch (error) {
      return error.message;
    }
  }

  zoomBy(steps) {
    const index = zoomSteps.indexOf(this.zoom) + steps;
    this.zoom = zoomSteps[Math.max(0, Math.min(zoomSteps.length - 1, index))];
  }

  build() {
    const mode = modes.find((each) => each.name === this.mode);
    const parts = {
      actions: this.actions(),
      creations: this.creations(),
      modes,
      mode: mode.name,
      onMode: callback("mode", (name) => { this.mode = name; }),
      content: this.content(mode),
      fileName: this.fileName,
      menus: this.unobservable.menus,
      message: this.message,
    };
    return overlayFrame(
      { style: { ...fitContainerStyle } },
      colorSchemeScope(
        { style: { ...fitContainerStyle } },
        // Around all of it - the documents, the menus they put in the
        // layout too, and the settings, whose pages read theirs.
        serviceProvider({
          serviceLocator: this.unobservable.locator,
          child: div(
            { style: { ...fitContainerStyle } },
            mode.layout === "paper"
              ? paperLayout({ ...parts, zoom: this.documents.length > 0 ? this.zoom : null, onZoom: callback("zoom", (steps) => this.zoomBy(steps)) })
              : appLayout(parts),
            this.settingsOverlay(),
          ),
        }),
      ),
    );
  }

  // What can be done with the documents - wherever the layout puts it.
  actions() {
    const none = this.documents.length === 0;
    return [
      { icon: "note_add", label: "New", title: "New - the null document", onClick: callback("new", () => this.show([])) },
      { icon: "folder_open", label: "Open…", title: "Open a document", onClick: callback("open", () => this.open()) },
      { icon: "download", label: "Save", title: "Save the document", disabled: none, onClick: callback("save", () => this.save()) },
      { icon: "print", label: "Print", title: "Print - on paper, whatever the mode", disabled: none, onClick: callback("print", () => this.print()) },
      { icon: "settings", label: "Settings…", title: "Settings", onClick: callback("settings", () => this.openSettings()) },
    ];
  }

  // What can be created where the focus is - put there by whatever has it,
  // as it likes (see contextMenus.js): in a structured text's text, at the
  // caret, an image, a table; on its pages, in its page layout, a shape, a
  // picture, a page number - there, or dragged to where it goes. Each kind
  // that can be in a frame there (see documents.js), a new one of it, as if
  // loaded.
  creations() {
    const menus = this.unobservable.menus;
    const place = menus.insertPlace();
    return frameTypes(this.services, place || "text").map((type) => ({
      icon: type.icon,
      label: type.label,
      title: !place ? type.label + " - put the caret where it goes first"
        : place === "page" ? type.label + " - drag it onto a page, or click to put it on the one selected"
        : type.label + " - where the caret is",
      disabled: !place,
      onClick: callback("create" + type.name, () => menus.insert(createDocument(type))),
      onDragStart: place === "page" ? callback("drag" + type.name, () => menus.drag(createDocument(type))) : null,
    }));
  }

  // The settings, a modal dialog (see settingsDialog.js): Tabula's own page,
  // then a page for every kind of document in use that has settings.
  settingsOverlay() {
    const close = callback("closeSettings", () => { this.settingsShown = null; });
    const pages = [
      { key: "tabula", title: "Tabula", icon: "tune", build: () => this.settingsPageContent() },
      ...documentTypes(this.services).filter((type) => type.settingsPage)
        .map((type) => ({ key: type.name, title: type.label, icon: type.icon, build: () => type.settingsPage() })),
    ];
    return overlay(
      { key: "settings", showing: this.settingsShown !== null },
      modalAssembly(
        { close, fullScreenBelow: 700, width: 820, height: "min(640px, 90%)" },
        settingsDialog({ pages, page: this.settingsShown, onPage: callback("settingsPage", (page) => { this.settingsShown = page; }), close }),
      ),
    );
  }

  // The null document's dot - or the documents, as the mode shows them.
  content(mode) {
    const { documents } = this;
    if (documents.length === 0) {
      return nullDocument({
        key: "null",
        documentTypes: rootDocumentTypes(this.services),
        onCreate: callback("createFirst", (type) => this.insert(0, type)),
        background: mode.layout === "paper" ? null : appBackdrop,
      });
    }
    if (mode.name === "json") {
      return div(
        { key: "json", style: { padding: "16px" } },
        jsonEditor({ json: dehydrateRoot(documents, this.services), apply: callback("apply", (json) => this.apply(json)) }),
      );
    }
    if (mode.name === "tree") {
      return div({ key: "tree", style: { padding: "16px" } }, treeView({ documents, services: this.services }));
    }
    if (mode.name === "web") return this.webDocuments();
    return this.paperDocuments();
  }

  // A creation dot, before the documents (`key` "first") or after one of
  // them. Keyed: each but the first belongs to the document before it - and
  // comes and goes with it. `row`: its room - its height, and where in it
  // the dot is (see CreationDot.js for the shapes).
  dot(key, index, title, shape, rowStyle) {
    return div(
      { key, style: { ...dotRowStyle, ...rowStyle } },
      creationDot({ documentTypes: rootDocumentTypes(this.services), shape, title, onCreate: callback(key, (type) => this.insert(index, type)) }),
    );
  }

  // The documents, each as `view` makes it, with a creation dot before,
  // between and after them - pointing up before the first, down after the
  // last, both ways between two; or, where they're lined up on the left
  // (`aligned` "left"), pointing right at their left edge.
  dots(documents, rowStyle, view, aligned = "center") {
    const shape = (index) => aligned === "left" ? "right"
      : index === 0 ? "up" : index === documents.length ? "down" : "diamond";
    return [
      this.dot("first", 0, documents.length === 1 ? "Create something before it" : "Create something first", shape(0), rowStyle),
      documents.flatMap((document, index) => [
        view(document),
        this.dot("after" + keyOf(document), index + 1, index === documents.length - 1 ? "Create something after it" : "Create something in between", shape(index + 1), rowStyle),
      ]),
    ];
  }

  // On paper: the documents, one under the other, on the paper grey - each
  // as its plugin draws it, on its own surface.
  paperDocuments() {
    const { documents } = this;
    return div(
      { key: "paper", style: { ...fitContainerStyle, overflow: "auto", background: paperBackdrop } },
      div(
        // As wide as the widest document - or the window: centred in it, and
        // scrolled sideways, not cut off, when wider.
        { style: { display: "flex", flexDirection: "column", alignItems: "center", width: "fit-content", minWidth: "100%" } },
        this.dots(documents, { height: "40px" }, (document) => this.documentView(document, documents.length > 1, "paper")),
      ),
    );
  }

  // On the web: each document a card as wide as there's room for (see
  // layouts.js's documentCard()), its plugin's view in it.
  webDocuments() {
    const { documents } = this;
    return div(
      { key: "web", style: { display: "flex", flexDirection: "column", padding: "0 16px" } },
      this.dots(documents, { height: "32px", justifyContent: "flex-start", paddingLeft: "24px", boxSizing: "border-box" }, (document) => {
        const key = keyOf(document) + "-web";
        const type = document.documentType && documentType(this.services, document.documentType.name);
        return documentCard({
          key,
          icon: type ? type.icon : "help",
          label: type ? type.label : documentName(document),
          title: type && type.title ? type.title(document.model) : "",
          onRemove: documents.length > 1 ? callback("remove" + key, () => this.remove(document)) : null,
          body: type ? type.editor({ model: document.model, target: "web" }) : noPluginNote(documentName(document)),
        });
      }, "left"),
    );
  }

  // A document on paper: its plugin's editor - looked up anew, not the one
  // it was hydrated with: a plugin turned off takes its editor with it, and
  // turned on again, brings it back.
  documentView(document, removable, target) {
    // Another target, another editor.
    const key = keyOf(document) + "-" + target;
    const onRemove = removable ? callback("remove" + key, () => this.remove(document)) : null;
    const type = document.documentType && documentType(this.services, document.documentType.name);
    if (!type) return this.noPlugin(key, documentName(document), onRemove);
    return type.editor({ key, model: document.model, zoom: this.zoom, onRemove, target });
  }

  noPlugin(key, name, onRemove) {
    return div(
      { key, style: { padding: "8mm" } },
      card(
        { style: { position: "relative", width: "340px", display: "flex", flexDirection: "column", gap: "6px" } },
        onRemove ? removeButton(onRemove) : null,
        div({ style: { fontWeight: "bold" } }, text("No plugin for it")),
        noPluginNote(name),
      ),
    );
  }

  // Tabula's own page of the settings: the plugins in use - Tabula's service
  // locator, set up by the user - and the app's own settings (see
  // settings.js).
  settingsPageContent() {
    const { plugins, services } = this;
    const app = this.settings.section("tabula", appSettingsDefaults);
    return [
      settingGroup("Appearance"),
      settingOption({
        title: "Creation dots",
        description: "The dots and triangles that create something where they are.",
        control: colorField({ key: "creationColor", label: "", value: app.creationColor, onInput: (color) => { app.creationColor = color; } }),
      }),
      settingGroup("Plugins", "Each one adds kinds of documents to Tabula's service locator."),
      plugins.map((plugin) => settingSwitch({
        key: plugin.name,
        title: plugin.label,
        description: plugin.description,
        checked: services.locators.includes(plugin),
        onChange: (checked) => {
          services.locators = plugins.filter((each) => each === plugin ? checked : services.locators.includes(each));
        },
      })),
      settingGroup("Elsewhere"),
      a({ href: "./classic.html", style: { fontSize: "13px" } }, text("Classic Tabula - the word processor it grew out of")),
    ];
  }
}

// A document's key, in the column showing it - a hydrated document is a
// plain object, with nothing but its type and model in it.
const documentKeys = new WeakMap();
let lastDocumentKey = 0;
function keyOf(document) {
  if (!documentKeys.has(document)) documentKeys.set(document, "document" + (++lastDocumentKey));
  return documentKeys.get(document);
}

// The room a creation dot has, above, between and after the documents.
const dotRowStyle = { position: "relative", width: "100%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" };

const note = (words) => div({ style: { opacity: 0.7, fontSize: "12px" } }, text(words));
const noPluginNote = (name) => note("This is a document of the kind “" + name + "”, and none of the plugins in use opens that kind. "
  + "Turn one on in the settings - it's kept as it is, and saved as it was, until then.");
