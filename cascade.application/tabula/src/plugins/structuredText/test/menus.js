import assert from "assert";
import { testDocument } from "../../../model/testDocument.js";
import { sequence as sequenceOf, textPosition, isSection, paragraphText } from "../../../model/flows.js";
import { tabulaEditing } from "../../../paper/editing.js";
import { contextPath } from "../menus.js";
import { observable } from "@liquefy/cascade.component";
import { structuredTextDefaults } from "../settings.js";
import { ContextMenus } from "../../../shell/contextMenus.js";

// What a StructuredTextEditor is to its menus: its document, where its
// caret is, its editing and settings.
function editorAt(document, caret) {
  const root = sequenceOf(document);
  return {
    model: document,
    caret,
    settings: observable({ ...structuredTextDefaults }),
    pageCount: () => 1,
    unobservable: { root, editing: tabulaEditing(root) },
    contextPath() { return contextPath(this); },
  };
}

describe("A structured text's context menus", function () {
  it("are a path from the document down to the flow the caret is in - the sections on the way between", function () {
    const document = testDocument();
    const flows = document.children.find(isSection);
    const inner = flows.children.find(isSection);
    const paragraph = inner.children[0];
    const path = contextPath(editorAt(document, textPosition(paragraph, 0)));
    // The sections on the way by their titles - each one's key its own, collapsed until opened.
    assert.deepStrictEqual(path.map((entry) => entry.title), ["Tabula", "Flows", "Paragraphs", "Paragraph"]);
    assert.deepStrictEqual(path.map((entry) => entry.key), ["document", "around1", "around2", "flow"]);
    assert.strictEqual(paragraphText(document.title), "Tabula");
    assert.ok(path.every((entry) => typeof(entry.build) === "function"));
  });

  it("are the document's alone without a caret", function () {
    const path = contextPath(editorAt(testDocument(), null));
    assert.deepStrictEqual(path.map((entry) => entry.key), ["document"]);
  });

  it("are shown for whatever has the focus - the root first, the leaf last - until it's let go", function () {
    const menus = new ContextMenus();
    const document = testDocument();
    const first = editorAt(document, textPosition(document.children[0], 0));
    const second = editorAt(testDocument(), null);
    assert.deepStrictEqual(menus.path(), []);
    menus.focus(first);
    assert.deepStrictEqual(menus.path().map((entry) => entry.title), ["Tabula", "Paragraph"]);
    menus.focus(second);
    menus.release(first);
    assert.strictEqual(menus.path().length, 1, "the other one's let go of nothing it doesn't have");
    menus.release(second);
    assert.deepStrictEqual(menus.path(), []);
  });
});
