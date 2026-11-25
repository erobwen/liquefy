/**
 * A recorded sequence of frames, and the store contents after any of them.
 *
 * The store after frame i is the writes of frames 0..i applied in order. Snapshots are kept
 * every CHECKPOINT frames, so that jumping anywhere replays at most CHECKPOINT frames.
 */

const CHECKPOINT = 32;

export class Timeline {
  constructor(frames) {
    this.frames = frames;
    this.checkpoints = new Map(); // frame index → Map of the store after that frame
  }

  get length() {
    return this.frames.length;
  }

  frame(index) {
    return this.frames[index];
  }

  /** The store contents after frame `index`, as a Map from key to value. Do not modify it. */
  stateAt(index) {
    if (index < 0) return new Map();
    if (this.checkpoints.has(index)) return this.checkpoints.get(index);
    const base = Math.floor(index / CHECKPOINT) * CHECKPOINT - 1;
    const state = new Map(base >= 0 ? this.checkpointAt(base) : []);
    for (let i = base + 1; i <= index; i++) apply(state, this.frames[i]);
    if (index % CHECKPOINT === CHECKPOINT - 1) this.checkpoints.set(index, state);
    return state;
  }

  checkpointAt(index) {
    if (!this.checkpoints.has(index)) {
      const previous = index - CHECKPOINT;
      const state = new Map(previous >= 0 ? this.checkpointAt(previous) : []);
      for (let i = previous + 1; i <= index; i++) apply(state, this.frames[i]);
      this.checkpoints.set(index, state);
    }
    return this.checkpoints.get(index);
  }

  /** The index of the next frame after `index` that `test` accepts, or the last frame. */
  next(index, test) {
    for (let i = index + 1; i < this.frames.length; i++) if (test(this.frames[i])) return i;
    return this.frames.length - 1;
  }

  /** The index of the previous frame before `index` that `test` accepts, or the first frame. */
  previous(index, test) {
    for (let i = index - 1; i >= 0; i--) if (test(this.frames[i])) return i;
    return 0;
  }
}

function apply(state, frame) {
  for (const [key, value] of frame.writes) {
    if (value === null) state.delete(key);
    else state.set(key, value);
  }
}
