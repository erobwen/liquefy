/**
 * Scripted scenarios to step through. Each runs the real database and collector in a
 * Recorder, with captions that say what to look for.
 *
 * A scenario is { key, title, description, options, deferCuts, parameters?, run(session, parameters) }.
 * `deferCuts` is whether deferred cuts and holds are on by default: only in the scenarios that
 * are about them. Captions follow the setting in use (session.deferCuts).
 */

import { ROOT, ref } from "@liquefy/frozen";
import { random, randomTransaction } from "@liquefy/frozen/src/fuzz/fuzz.js";
import { Recorder } from "./Recorder.js";

/** Creates sections × paragraphs under a new document object, and returns its id. */
function createDocument(tx, title, sections, paragraphs, font = null) {
  const list = [];
  for (let s = 1; s <= sections; s++) {
    const items = [];
    for (let p = 1; p <= paragraphs; p++) {
      const fields = { text: `${title} ${s}.${p}` };
      if (font) fields.font = ref(font);
      items.push(ref(tx.create(fields)));
    }
    list.push(ref(tx.create({ title: `${title} §${s}`, paragraphs: items })));
  }
  return tx.create({ title, sections: list });
}

export const scenarios = [
  {
    key: "delete-document",
    title: "Deleting a document",
    description: "A document is cut from ROOT and becomes a cohort. Marking walks down the spanning tree, one batched check finds no outside referrers, and the cohort is reclaimed in that same step.",
    options: { deferral: 0 },
    run(session) {
      let font;
      session.explain("A font that every paragraph will reference. It hangs from ROOT, so it stays alive.");
      session.transaction("Create a shared font", (tx) => {
        font = tx.create({ name: "Serif" });
        tx.set(ROOT, "font", ref(font));
      });
      session.explain("The new objects get tree parents: the first referrer that made them reachable. Bold edges are the spanning tree.");
      session.transaction("Create a document", (tx) => {
        tx.set(ROOT, "doc", ref(createDocument(tx, "Doc", 3, 3, font)));
      });
      session.collect();
      session.explain(session.deferCuts
        ? "The tree edge ROOT → document is cut. Quick swap finds no other referrer, so the document is deferred."
        : "The tree edge ROOT → document is cut. Quick swap finds no other referrer, so the document starts a cohort at once.");
      session.transaction("Delete the document", (tx) => tx.delete(ROOT, "doc"));
      session.collect();
    },
  },

  {
    key: "moving",
    title: "Moving objects",
    description: "Three ways an object can lose its tree parent: moved within one transaction (quick swap), cut and pasted in a later transaction (the deferral is cancelled), and cut for good (the deferral resolves into a cohort).",
    options: { deferral: 2 },
    deferCuts: true,
    run(session) {
      let a, b, para;
      session.transaction("Create two chapters", (tx) => {
        para = tx.create({ text: "A paragraph on the move" });
        a = tx.create({ title: "Chapter A", para: ref(para), other: ref(tx.create({ text: "stays" })) });
        b = tx.create({ title: "Chapter B" });
        tx.set(ROOT, "a", ref(a));
        tx.set(ROOT, "b", ref(b));
      });
      session.explain("Moved in one transaction: the barrier finds Chapter B as a new referrer and swaps the tree parent at once. No GC work at all.");
      session.transaction("Move the paragraph to chapter B", (tx) => {
        tx.delete(a, "para");
        tx.set(b, "para", ref(para));
      });
      session.explain(session.deferCuts
        ? "Cut: no other referrer, so the paragraph is deferred for two transactions (the dashed outline)."
        : "Cut: no other referrer. Deferred cuts are off, so the paragraph starts a cohort at once.");
      session.transaction("Cut the paragraph", (tx) => tx.delete(b, "para"));
      session.explain(session.deferCuts
        ? "Pasted while still deferred: the verified walk from the new referrer reaches ROOT, so the deferral is cancelled."
        : "Pasted: the paragraph is unstable but has no tree children, so the barrier rescues it at once. Its cohort is left with nothing in it.");
      session.transaction("Paste it into chapter A", (tx) => tx.set(a, "para", ref(para)));
      session.explain("Cut again, and this time never pasted.");
      session.transaction("Cut it for good", (tx) => tx.delete(a, "para"));
      session.collect();
    },
  },

  {
    key: "dequeue",
    title: "Dequeue: a replacement parent",
    description: "Removing the first item of a linked queue cuts the tree edge to the rest of the queue. Marking finds a replacement parent for the shared second item, so only the dequeued item is collected.",
    options: { deferral: 0 },
    run(session) {
      let queue;
      session.transaction("Create a queue of five items", (tx) => {
        const items = [];
        for (let i = 5; i >= 1; i--) items.unshift(tx.create({ value: i, ...(items[0] ? { next: ref(items[0]) } : {}) }));
        queue = tx.create({ first: ref(items[0]), last: ref(items[4]) });
        tx.set(ROOT, "queue", ref(queue));
      });
      session.collect();
      const first = session.db.get(queue).first.$ref;
      session.explain(`The queue now points at item 2, which keeps its tree parent (item 1). Item 1 lost its only referrer: ${session.deferCuts ? "it is deferred" : "it starts a cohort"}.`);
      session.transaction("Dequeue the first item", (tx) => tx.set(queue, "first", tx.get(first).next));
      session.explain("Marking item 1 would make item 2 unstable. Item 2 is shared, so marking first looks for another verified referrer, finds the queue, and re-parents item 2 there.");
      session.stepUntil((step) => step.kind === "mark" && step.ids[0] === first);
      session.collect();
    },
  },

  {
    key: "cycle",
    title: "A garbage cycle",
    description: "A cycle that references live objects is cut from ROOT. Every member has a referrer, but all of them are in the same cohort, so the whole cycle is reclaimed.",
    options: { deferral: 0 },
    run(session) {
      let library;
      session.transaction("Create a library and a cycle", (tx) => {
        library = tx.create({ name: "Library" });
        tx.set(ROOT, "library", ref(library));
        const ids = Array.from({ length: 5 }, (_, i) => tx.create({ name: `ring ${i + 1}` }));
        ids.forEach((id, i) => tx.set(id, "next", ref(ids[(i + 1) % ids.length])));
        tx.set(ids[2], "uses", ref(library));
        tx.set(ids[3], "skip", ref(ids[0]));
        tx.set(ROOT, "ring", ref(ids[0]));
      });
      session.explain("Only the edge from ROOT is cut. The cycle still references itself and the library.");
      session.transaction("Cut the cycle from ROOT", (tx) => tx.delete(ROOT, "ring"));
      session.collect();
    },
  },

  {
    key: "rescue",
    title: "Rescue during collection",
    description: "A document is cut, and while its cohort is being marked, a section of it is linked from ROOT again. The section is rescued, and expanding it rescues its paragraphs. The rest is reclaimed.",
    options: { deferral: 0 },
    run(session) {
      let doc;
      session.transaction("Create a document", (tx) => {
        doc = createDocument(tx, "Doc", 2, 3);
        tx.set(ROOT, "doc", ref(doc));
      });
      session.collect();
      const section = session.db.get(doc).sections[0].$ref;
      session.transaction("Delete the document", (tx) => tx.delete(ROOT, "doc"));
      session.explain("Section 1 is marked: its paragraphs become unstable too. Watch it be linked again.");
      session.stepUntil((step) => step.kind === "mark" && step.ids[0] === section);
      session.explain("Section 1 is linked from ROOT. It is unstable and marked, so the barrier rescues it at once and queues it for expansion.");
      session.transaction("Link section 1 from ROOT again", (tx) => tx.set(ROOT, "kept", ref(section)));
      session.collect();
    },
  },

  {
    key: "holds",
    title: "Holds",
    description: "Cutting a large structure with a hold keeps it deferred for a chosen number of transactions, so pasting it back later costs no marking. A release ends a hold early.",
    options: { deferral: 0 },
    deferCuts: true,
    run(session) {
      let doc, other;
      session.transaction("Create two documents", (tx) => {
        doc = createDocument(tx, "Kept", 2, 2);
        other = createDocument(tx, "Dropped", 2, 2);
        tx.set(ROOT, "kept", ref(doc));
        tx.set(ROOT, "dropped", ref(other));
      });
      if (!session.deferCuts) {
        session.explain("Deferred cuts and holds are off: the hold is ignored, and the cut starts a cohort at once. 'Kept' is collected, and there is nothing left to paste back.");
        session.transaction("Cut 'Kept' with a hold", (tx) => {
          tx.delete(ROOT, "kept");
          tx.hold(doc, { transactions: 5 });
        });
        session.collect();
        return;
      }
      session.explain("Cut with a hold for 5 transactions: it stays deferred, and the collector leaves it alone.");
      session.transaction("Cut 'Kept' with a hold", (tx) => {
        tx.delete(ROOT, "kept");
        tx.hold(doc, { transactions: 5 });
      });
      session.collect({ flush: false });
      session.transaction("Some other work", (tx) => tx.set(ROOT, "note", ref(tx.create({ text: "meanwhile" }))));
      session.collect({ flush: false });
      session.explain("Pasted back while held: the walk from ROOT succeeds and the hold simply ends.");
      session.transaction("Paste 'Kept' back", (tx) => tx.set(ROOT, "back", ref(doc)));
      session.collect({ flush: false });
      session.transaction("Cut 'Dropped' with a hold", (tx) => {
        tx.delete(ROOT, "dropped");
        tx.hold(other, { transactions: 50 });
      });
      session.collect({ flush: false });
      session.explain("Released: the hold expires now, and the next step turns it into a cohort.");
      session.transaction("Release 'Dropped'", (tx) => tx.release(other));
      session.collect({ flush: false });
    },
  },

  {
    key: "regions",
    title: "Regions: split, flags and merge",
    description: "With a region cap of 10, a growing document splits into regions of subtrees. Cross-region edges get entry flags (orange). Emptied sections make light regions merge back, and deleting the document deletes its regions.",
    options: { deferral: 0, regionCap: 10 },
    run(session) {
      let font, doc;
      session.transaction("Create a shared font", (tx) => {
        font = tx.create({ name: "Serif" });
        tx.set(ROOT, "font", ref(font));
      });
      session.explain("Everything lands in its tree parent's region, r0. The structure task (dashed region) will split it.");
      session.transaction("Create a document", (tx) => {
        doc = createDocument(tx, "Doc", 4, 3, font);
        tx.set(ROOT, "doc", ref(doc));
      });
      session.collect();
      session.explain("Three sections lose their paragraphs, and their regions become light.");
      session.transaction("Empty three sections", (tx) => {
        for (const section of tx.get(doc).sections.slice(1)) tx.set(section.$ref, "paragraphs", []);
      });
      session.collect();
      session.transaction("Delete the document", (tx) => tx.delete(ROOT, "doc"));
      session.collect();
    },
  },

  {
    key: "suspension",
    title: "Suspension: deleting a library",
    description: "A library of documents spans several regions. When it is deleted, each region whose content is entirely condemned is suspended and marked as a unit, and reclaimed whole. Keeping one document resumes its region with its internal tree intact; quoting a paragraph from another region materializes that region.",
    options: { deferral: 0, regionCap: 12 },
    run(session) {
      session.transaction("Create a library of three documents", (tx) => {
        const documents = [];
        for (let d = 1; d <= 3; d++) {
          const sections = [];
          for (let s = 1; s <= 2; s++) {
            const paragraphs = [];
            for (let p = 1; p <= 4; p++) paragraphs.push(ref(tx.create({ text: `${d}.${s}.${p}` })));
            sections.push(ref(tx.create({ title: `§${d}.${s}`, paragraphs })));
          }
          documents.push(ref(tx.create({ title: `Doc ${d}`, sections })));
        }
        tx.set(ROOT, "library", ref(tx.create({ name: "Library", documents })));
      });
      session.explain("Structure tasks split the library into regions: a document or a section each, with its paragraphs.");
      session.collect();
      session.explain("The library is cut from ROOT. It starts a cohort, and marking begins at the library object.");
      session.transaction("Delete the library", (tx) => tx.delete(ROOT, "library"));
      session.explain("Marking reaches an object whose whole region hangs from it, and nothing else holds on to that region: the region is suspended. All its members are unstable at once, and they keep their internal tree.");
      session.stepUntil((step) => step.kind === "mark" && step.suspended);

      // Keep the first region whose exits are cut and that has a single anchor: it resumes.
      const store = session.store;
      const membersOf = (region) => store.keys(`m/${region}/`).map((key) => key.split("/")[2]);
      const explicitWithChildren = (region) => membersOf(region).filter((id) => store.get(`g/${id}`).cohort !== null && store.keys(`t/${id}/`).length > 0);
      session.explain("Marking the region item cuts only the tree edges that leave the region. Child regions hanging from it are reached this way.");
      session.stepUntil((step) => step.kind === "mark" && step.region && explicitWithChildren(step.region).length === 1);
      const kept = explicitWithChildren(session.db.collector.lastStep.region)[0];
      session.explain("The region's only anchor is linked from ROOT again. Its internal tree is still valid, so the whole region resumes in this transaction, and is queued for expansion.");
      session.transaction(`Keep ${store.get(`o/${kept}`).title ?? kept}`, (tx) => tx.set(ROOT, "kept", ref(kept)));

      // Quote a paragraph from another suspended region: it materializes.
      session.stepUntil((step) => step.kind === "mark" && step.region && membersOf(step.region).some((id) => store.get(`g/${id}`).cohort === null));
      const region = session.db.collector.lastStep.region;
      const quoted = membersOf(region).find((id) => store.get(`g/${id}`).cohort === null && store.get(`o/${id}`).text);
      session.explain("A paragraph inside a suspended region gets a stable referrer. Only part of the region survives, so the region is materialized: its anchors go back to object-by-object marking, and the paragraph will find ROOT as a replacement parent.");
      session.transaction(`Quote paragraph ${store.get(`o/${quoted}`).text}`, (tx) => tx.set(ROOT, "quote", ref(quoted)));
      session.explain("The check finds no stable referrer of what is left. The cohort is reclaimed, and the regions still suspended in it are deleted whole.");
      session.collect();
    },
  },

  {
    key: "random",
    title: "Random (a fuzz seed)",
    description: "Random transactions from the fuzzer, with a few collector steps after each. The collector options vary with the seed, as in the fuzz tests.",
    parameters: { seed: 1, transactions: 40 },
    deferCuts: true,
    run(session, { seed = 1, transactions = 40 } = {}) {
      const rng = random(seed);
      const clipboard = [];
      for (let i = 0; i < transactions; i++) {
        session.time += rng.int(1000);
        const before = session.frames.length;
        session.beginFrame();
        randomTransaction(session.db, rng, clipboard);
        session.endFrame({ kind: "transaction", label: `Random transaction ${i + 1}` });
        if (session.frames.length === before) continue;
        session.collect({ limit: rng.int(4), flush: false });
      }
      session.collect();
    },
  },
];

/** Options for the random scenario, varied by seed like the fuzzer's runSeed. */
function randomOptions(seed, clock) {
  const rng = random(seed * 7919 + 1);
  return {
    now: () => clock.time,
    deferral: rng.int(4),
    walkBudget: rng.pick([2, 4, 64]),
    candidates: rng.pick([1, 2, 8]),
    regionCap: rng.pick([5, 8, 16, 100]),
  };
}

/**
 * Records a scenario. Returns { scenario, parameters, options, timeline }.
 * `deferCuts` overrides the scenario's default for deferred cuts and holds.
 */
export function recordScenario(key, parameters = {}, { deferCuts } = {}) {
  const scenario = scenarios.find((s) => s.key === key);
  if (!scenario) throw new Error(`No scenario ${key}`);
  const merged = { ...scenario.parameters, ...parameters };
  const clock = { time: 0 };
  const options = scenario.key === "random" ? randomOptions(merged.seed, clock) : { ...scenario.options };
  options.deferCuts = deferCuts ?? scenario.deferCuts ?? false;
  const session = new Recorder({ options, title: `${scenario.title}: the empty database` });
  Object.defineProperty(session, "time", { get: () => clock.time, set: (value) => { clock.time = value; } });
  scenario.run(session, merged);
  const { now, ...shown } = options;
  return { scenario, parameters: merged, options: shown, timeline: session.timeline() };
}

