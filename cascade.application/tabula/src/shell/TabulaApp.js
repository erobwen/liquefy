import { Component, callback, serviceProvider } from "@liquefy/cascade.component";
import { div, span, text, a } from "@liquefy/cascade.dom";
import { card, checkbox, iconButton, fitContainerStyle, overlayFrame, colorSchemeScope } from "@liquefy/cascade.ui";
import { paperBackdrop } from "../paper/TabulaPaperView.js";
import { infoButton } from "../InfoButton.js";
import { nullDocument } from "./NullDocument.js";
import { creationDot } from "./CreationDot.js";
import { removeButton } from "./removeButton.js";
import { documentTypes, documentType, documentName, createDocument, hydrateRoot, dehydrateRoot } from "./documents.js";
import { openFile, saveFile } from "./files.js";

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * TabulaApp - Tabula as an editor of documents of any kind: the kinds come
 * from plugins (see documents.js), and Tabula itself is only this - the
 * documents, and a small card in the top left corner for starting anew,
 * opening, saving, and the settings.
 *
 *   new TabulaApp({ plugins, services })
 *
 * `plugins` are all there are; `services` the ObservableCompoundServiceLocator
 * of the ones in use - its `locators`, which the settings change. It's put
 * in front of the app's render context too (serviceProvider()), so a plugin
 * can offer more than document types: widgets of its own, say.
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
 * The classic Tabula app (../Tabula.js), the word processor this grew out
 * of, is kept as it was, at classic.html - a reference for this one.
 */
export class TabulaApp extends Component {
  setProperties({ plugins, services }) {
    this.plugins = plugins;
    this.services = services;
  }

  initialState() {
    // documents: hydrated - none, one, or a sequence of them. fileName:
    // what they were opened from, and are saved as.
    return { documents: [], fileName: null, message: null, zoom: 1 };
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

  zoomBy(steps) {
    const index = zoomSteps.indexOf(this.zoom) + steps;
    this.zoom = zoomSteps[Math.max(0, Math.min(zoomSteps.length - 1, index))];
  }

  build() {
    return overlayFrame(
      { style: { ...fitContainerStyle } },
      colorSchemeScope(
        { style: { ...fitContainerStyle } },
        div(
          { style: { ...fitContainerStyle, position: "relative" } },
          serviceProvider({ serviceLocator: this.services, child: this.root() }),
          this.fileCard(),
          this.documents.length > 0 ? this.zoomCard() : null,
        ),
      ),
    );
  }

  // The null document's dot - or the documents, one under the other, with
  // a creation dot before, between and after them.
  root() {
    const { documents } = this;
    const types = documentTypes(this.services);
    if (documents.length === 0) {
      return nullDocument({
        key: "null",
        documentTypes: types,
        onCreate: callback("createFirst", (type) => this.insert(0, type)),
      });
    }
    // Keyed: each dot but the first belongs to the document before it -
    // and comes and goes with it.
    const dot = (key, index, title) => div(
      { key, style: dotRowStyle },
      creationDot({ documentTypes: types, size: "small", title, onCreate: callback(key, (type) => this.insert(index, type)) }),
    );
    return div(
      { key: "documents", style: { ...fitContainerStyle, overflow: "auto", background: paperBackdrop } },
      div(
        // As wide as the widest document - or the window: centred in it, and
        // scrolled sideways, not cut off, when wider.
        { style: { display: "flex", flexDirection: "column", alignItems: "center", width: "fit-content", minWidth: "100%" } },
        dot("first", 0, documents.length === 1 ? "Create something before it" : "Create something first"),
        documents.flatMap((document, index) => [
          this.documentView(document, documents.length > 1),
          dot("after" + keyOf(document), index + 1, index === documents.length - 1 ? "Create something after it" : "Create something in between"),
        ]),
      ),
    );
  }

  // A document: its plugin's editor - looked up anew, not the one it was
  // hydrated with: a plugin turned off takes its editor with it, and turned
  // on again, brings it back.
  documentView(document, removable) {
    const key = keyOf(document);
    const onRemove = removable ? callback("remove" + key, () => this.remove(document)) : null;
    const type = document.documentType && documentType(this.services, document.documentType.name);
    if (!type) return this.noPlugin(key, documentName(document), onRemove);
    return type.editor({ key, model: document.model, zoom: this.zoom, onRemove });
  }

  noPlugin(key, name, onRemove) {
    return div(
      { key, style: { padding: "8mm" } },
      card(
        { style: { position: "relative", width: "340px", display: "flex", flexDirection: "column", gap: "6px" } },
        onRemove ? removeButton(onRemove) : null,
        div({ style: { fontWeight: "bold" } }, text("No plugin for it")),
        note("This is a document of the kind “" + name + "”, and none of the plugins in use opens that kind. "
          + "Turn one on in the settings - it's kept as it is, and saved as it was, until then."),
      ),
    );
  }

  // Top left: new, open, save - and the settings behind the cogwheel.
  fileCard() {
    return card(
      { style: fileCardStyle },
      div(
        { style: { display: "flex", alignItems: "center", gap: "2px" } },
        span({ style: { fontFamily: "Georgia, serif", fontSize: "18px", color: "#704343", padding: "0 8px 0 4px" } }, text("❦ Tabula")),
        iconButton({ icon: "note_add", title: "New - the null document", onClick: callback("new", () => this.show([])) }),
        iconButton({ icon: "folder_open", title: "Open a document", onClick: callback("open", () => this.open()) }),
        iconButton({ icon: "download", title: "Save the document", disabled: this.documents.length === 0, onClick: callback("save", () => this.save()) }),
        infoButton({ key: "settings", icon: "settings", title: "Settings", details: this.settings() }),
      ),
      this.fileName ? note(this.fileName) : null,
      this.message ? div({ style: { fontSize: "12px", color: "#b3261e", maxWidth: "260px" } }, text(this.message)) : null,
    );
  }

  // Zoom, for all the documents, in the lower right corner - clear of the
  // scroll bars.
  zoomCard() {
    return card(
      { style: zoomCardStyle },
      iconButton({ icon: "zoom_out", title: "Zoom out", onClick: callback("zoomOut", () => this.zoomBy(-1)) }),
      div({ style: { minWidth: "48px", textAlign: "center" } }, text(Math.round(this.zoom * 100) + "%")),
      iconButton({ icon: "zoom_in", title: "Zoom in", onClick: callback("zoomIn", () => this.zoomBy(1)) }),
    );
  }

  // The plugins in use - Tabula's service locator, set up by the user.
  settings() {
    const { plugins, services } = this;
    return [
      heading("Plugins"),
      note("Each one adds kinds of documents to Tabula's service locator."),
      plugins.map((plugin) => [
        checkbox({
          key: plugin.name,
          label: plugin.label,
          checked: services.locators.includes(plugin),
          onChange: (checked) => {
            services.locators = plugins.filter((each) => each === plugin ? checked : services.locators.includes(each));
          },
        }),
        note(plugin.description),
      ]),
      heading("Elsewhere"),
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
const dotRowStyle = { position: "relative", height: "40px", width: "100%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" };
const fileCardStyle = {
  position: "absolute", top: "12px", left: "12px", display: "flex", flexDirection: "column", gap: "2px",
  padding: "6px 8px", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
};
const zoomCardStyle = {
  position: "absolute", right: "28px", bottom: "28px", display: "flex", flexDirection: "row", alignItems: "center",
  padding: "6px 10px", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
};

const heading = (label) => div({ style: { fontWeight: "bold", fontSize: "13px", margin: "4px 0 0" } }, text(label));
const note = (words) => div({ style: { opacity: 0.7, fontSize: "12px" } }, text(words));
