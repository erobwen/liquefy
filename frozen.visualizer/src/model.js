/**
 * The visualizer's model: which recording is loaded, where in it we are, and what is selected.
 *
 * An observable (cascade.component), written only from event handlers and the play timer, so
 * every write lands at the baseline (cascade manual 9.3, 11.1). The recording itself is plain
 * data held by reference: replacing it is the change, nothing inside it is observed.
 */

import { observable, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { recordScenario } from "./recording/scenarios.js";
import { describe } from "./view/describe.js";

export const model = observable({
  scenarioKey: "delete-document",
  seed: 1,
  transactions: 40,
  recording: null, // { scenario, parameters, options, timeline, id }
  error: null,
  frame: 0,
  playing: false,
  speed: 4, // frames per second
  selected: null,
  showFlags: true,
  showWeak: true,
  fitRequest: 0,
});

/** Several writes that make one change: one rebuild (cascade manual 11.20). */
export function change(action) {
  postponeInvalidations();
  try {
    action();
  } finally {
    continueInvalidations();
  }
}

let recordings = 0;

/** Records the chosen scenario and shows its first frame. */
export function load(scenarioKey = model.scenarioKey) {
  let recording = null;
  let error = null;
  try {
    const parameters = scenarioKey === "random" ? { seed: Number(model.seed) || 1, transactions: Number(model.transactions) || 40 } : {};
    recording = { ...recordScenario(scenarioKey, parameters), id: ++recordings };
  } catch (caught) {
    error = String(caught?.stack ?? caught);
  }
  change(() => {
    model.scenarioKey = scenarioKey;
    model.recording = recording;
    model.error = error;
    model.frame = 0;
    model.playing = false;
    model.selected = null;
  });
}

export function lastFrame() {
  return model.recording ? model.recording.timeline.length - 1 : 0;
}

export function goTo(frame) {
  model.frame = Math.max(0, Math.min(lastFrame(), frame));
}

const isTransaction = (frame) => frame.kind === "transaction" || frame.kind === "start";

/** The next or previous user transaction. */
export function goToTransaction(direction) {
  const { timeline } = model.recording;
  goTo(direction > 0 ? timeline.next(model.frame, isTransaction) : timeline.previous(model.frame, isTransaction));
}

/** The view of a frame. The last few are cached: the play timer and selection ask again. */
const cache = new Map();
export function viewAt(recording, index) {
  const key = `${recording.id}:${index}`;
  if (!cache.has(key)) {
    const { timeline } = recording;
    cache.set(key, describe(timeline.stateAt(index), timeline.stateAt(index - 1), timeline.frame(index)));
    if (cache.size > 16) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}
