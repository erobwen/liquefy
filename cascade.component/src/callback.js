import { getCreator } from "./Component.js";

/**
 * callback(key, fn) - a named callback, for a property: the same function,
 * rebuild after rebuild, so passing it doesn't count as a change - ported
 * from flow.core's callback(key, callback).
 *
 *   button({ key: "clear", onClick: callback("clear", () => { this.chosen = []; }) })
 *   tile({ key: id, onclick: callback(id + "Toggle", () => this.toggle(id)) })
 *
 * A plain closure is a new function every build - and so, as a property, a
 * change every time: fine for a quick prototype, and exactly right for a
 * function a child calls while it builds (a frame building its content
 * into whatever size is left), where a new function really is new. A
 * named one is for the rest: keyed like a component - unique among the
 * callbacks of the build that makes it - it's one stable function for as
 * long as that component lives, and always calls the closure from its
 * latest build, so nothing it captures is ever stale.
 *
 * Kept by the component whose build() is running (see getCreator()). Called
 * outside any build, it simply returns `fn`.
 */
export function callback(key, fn) {
  const creator = getCreator();
  if (!creator) return fn;
  const u = creator.unobservable;
  if (!u.callbacks) u.callbacks = new Map();
  let stable = u.callbacks.get(key);
  if (!stable) {
    stable = function (...parameters) {
      return stable.current.apply(this, parameters);
    };
    u.callbacks.set(key, stable);
  }
  stable.current = fn;
  return stable;
}
