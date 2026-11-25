import assert from "assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LmdbStore } from "@liquefy/aquifer/src/store/LmdbStore.js";
import { open, transaction, Synchronized, synchronized } from "../index.js";

class Note extends Synchronized {
  text = "";
  created = new Date(0);
}

describe("objects over records, on LMDB", function () {
  let path;
  beforeEach(() => (path = mkdtempSync(join(tmpdir(), "wellspring-"))));
  afterEach(() => rmSync(path, { recursive: true, force: true }));

  it("keeps objects when the store is closed and opened again", async function () {
    let store = new LmdbStore(path, { noSync: true });
    let spring = open({ store, classes: { Note } });
    transaction(() => {
      spring.root.notes = synchronized([]);
      for (let i = 0; i < 3; i++) {
        const note = new Note();
        note.text = "note " + i;
        note.created = new Date(1000 * i);
        spring.root.notes.push(note);
      }
    });
    spring.close();
    await store.close();

    store = new LmdbStore(path, { noSync: true });
    spring = open({ store, classes: { Note } });
    const notes = spring.root.notes;
    assert.equal(notes.length, 3);
    assert.ok(notes[2] instanceof Note);
    assert.equal(notes[2].text, "note 2");
    assert.equal(notes[2].created.getTime(), 2000);
    spring.close();
    await store.close();
  });
});
