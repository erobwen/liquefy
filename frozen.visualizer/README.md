# frozen.visualizer

Step-by-step visualization of [frozen](../frozen)'s garbage collector, built with Cascade and
[Cytoscape.js](https://js.cytoscape.org/).

```console
npm run frozen:visualizer        # from the repository root, then open http://localhost:5181
npm test -w @liquefy/frozen.visualizer
```

Pick a scenario, then step or play through it. "Region cap" and "Cluster cap" in the header
override the scenario's size limits: small values (a region cap of 10, a cluster cap of 3) build
several levels of meta-regions from a few dozen objects. A scenario's key in the address opens it directly
(`http://localhost:5181/#rescue`).

| Key | Action |
|---|---|
| Right / Left | next / previous frame |
| Shift + Right / Left | next / previous user transaction |
| Space | play or pause |
| Home / End | first / last frame |
| Escape | clear the selection |

## What it shows

Every **frame** is one committed store transaction: a user transaction, or one collector step
(a due deferral, a structure task, or an expand, mark, check or reclaim step of a cohort).

- **Objects** are nodes inside their **region** (the boxes). Their look shows their GC state:
  stable, deferred (dashed amber), held for a time (dashed purple), unstable (a ring), marked
  (filled), unstable with its region (pale fill), and reclaimed this step (faded). Shared
  objects are squares. A **suspended region** is a tinted box with a colored border: all its
  members are unstable as a unit, and keep their internal tree (the "Suspension" scenario shows
  suspend, resume, materialize and whole-region reclaim). **Meta-regions** are boxes around
  region boxes, labeled with their level, and deeper in color the higher the level; a whole
  meta-region can be suspended, marked, checked and reclaimed as one (the "Meta-regions"
  scenario). Each cohort has an
  outline around its members ("Cohort outlines"), drawn across region boxes with the
  [bubblesets](https://github.com/upsetjs/cytoscape.js-bubblesets) plugin. All cohorts share one
  color until "Cohort colors" is turned on, which gives each cohort its own.
- **Edges**: the spanning tree is bold, other strong references thin, weak references dotted,
  and entry flags between regions dashed orange.
- **This step's work**: the step's subject is yellow, records it read are blue, objects it wrote
  green. A region with a pending structure task has a dashed orange border.
- The **side panel** has three tabs. **Step** says what the step did and why, lists every
  change, and shows the selected object's record and referrers. **Cohorts** lists the cohorts
  with their expand, mark and check lists, the deferred cuts and the pending structure tasks.
  **Legend** has an entry for every look the graph can give an element. Click a node or any id
  to select it.

## How it works

```
scenario script ──► Recorder ──► Timeline (frames) ──► describe(state) ──► GraphView, panels
                    (real Database,            replay + checkpoints      pure function of
                     MemoryStore observer)                               the store's keys
```

- [Recorder](src/recording/Recorder.js) runs a real `Database` on a `MemoryStore` with an
  observer (`store.observe`), and records each commit's writes and the committed keys it read.
  The collector's `lastStep` says what kind of step it was.
- [Timeline](src/recording/Timeline.js) rebuilds the store at any frame by replaying writes,
  with a checkpoint every 32 frames.
- [describe](src/view/describe.js) turns store contents into what is drawn. It reads only the
  store's keys (`o/`, `g/`, `c/`, `r/`, `e/`, `s/`, ...), never the collector.
- [GraphView](src/components/GraphView.js) owns a Cytoscape instance and diffs each frame into
  it. The fcose layout reruns only when the structure changed, starting from current positions.
- [scenarios](src/recording/scenarios.js) are short scripts against the database API, with
  captions. The random scenario replays the fuzzer's transactions for any seed.

## Where it can go

**Live databases.** Frames are plain JSON: a store's writes, its reads, and a step
description. A database process could stream the same frames (store observer plus
`collector.lastStep`) over a WebSocket, and the visualizer would append them to its timeline
instead of recording locally. Since `describe` only reads store keys, nothing else changes. For
an LMDB-backed store, the first frame would be a snapshot of the part being looked at, not the
whole store.

**Showing a part of a large database.** Today the whole database is drawn, which stays readable
up to a few hundred objects. For more, the graph would show a *selection*: a set of object ids
chosen by a search (by id, by field value, by region), grown by neighborhood (tree parents up to
ROOT, referrers, n hops out), or following a cohort while it works. `describe` would take the
selection and draw what is outside it as collapsed region nodes with edge counts. Against a live
database, a selection is also a subscription: only frames that touch the selected keys need to
be sent.
