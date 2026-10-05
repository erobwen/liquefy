import { Component, getCreator, componentPath } from "./Component.js";
import { isObservable } from "./Cascade.js";

/**
 * Ported from flow.core/src/implicitProperties.js - the argument-list
 * convention every flow component's constructor is written against:
 * `div("someText", {style: ...}, childA, childB)`, sorting a mixed
 * arglist into a single properties object rather than requiring a
 * component author to declare a fixed parameter list. This is the actual
 * prerequisite for pulling a simple flow component over mostly unchanged
 * (see Component.js's own constructor) - build()/render() delegation
 * alone doesn't help if the component's own constructor call site can't
 * even be parsed.
 *
 * Left out of this port, deliberately, for now: `extractExpectedProperty`/
 * `extractProperties` (not needed by anything ported yet - add when a
 * ported component actually needs one) and the string/number ->
 * text-node-primitive wrapping `createTextNodesFromStringChildren`
 * originally did (see its own comment below) - that depends on flow's
 * `getRenderTarget()`/creators-stack/primitive-component machinery,
 * explicitly scoped out of this round.
 */

export function extractProperty(object, property) {
  if (!object) return undefined;
  const result = object[property];
  delete object[property];
  return result;
}

export function findImplicitChildren(properties) {
  if (!properties.componentContent) return properties;

  let children = null;
  for (const item of extractProperty(properties, "componentContent")) {
    if (!children) children = [];
    children.push(item);
  }
  if (children) {
    if (properties.children) {
      throw new Error("Children both implicitly defined as loose arguments, but also explicitly in properties.");
    }
    properties.children = children;
  }
  createTextNodesFromStringChildren(properties);
  return properties;
}

// flow.core's own version wraps a loose string/number child in a
// text-node primitive component here (getRenderTarget().primitive({type:
// "textNode", ...})) - cascade has no primitive/render-target system yet
// (see Component.js's own render()), so a loose string/number is left
// exactly as given; whichever build() actually consumes `children`
// decides what a plain string child means to it. Still validates the
// same way flow did otherwise - a genuine component (or anything else
// observable), or nothing recognizable at all.
//
// Arrays nested among the children are flattened, however deep: a helper
// taking `...children` and handing them on as one argument, or
// `div(header, rows.map(row))` inside such a helper, nests them without
// meaning anything by it.
export function createTextNodesFromStringChildren(properties) {
  if (!properties.children) return;
  properties.children = flattenChildren(properties.children, []).map((child) => {
    if (typeof(child) === "undefined" || child === null || child === false) {
      return child;
    } else if (typeof(child) === "string" || typeof(child) === "number") {
      return child;
    } else if (child instanceof Component || isObservable(child)) {
      return child;
    } else {
      throw new Error("Don't know what to do with a child that is " + describeValue(child) + inBuild()
        + ": a child is a component, a string or a number - or null, false or undefined for nothing.");
    }
  });
}

function flattenChildren(children, result) {
  for (const child of children) {
    if (child instanceof Array) flattenChildren(child, result);
    else result.push(child);
  }
  return result;
}

function describeValue(value) {
  if (typeof(value) === "function") return "a function" + (value.name ? " (" + value.name + ")" : "");
  if (typeof(value) !== "object") return typeof(value) + " " + String(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype === Object.prototype || prototype === null) {
    return "a plain object {" + Object.keys(value).slice(0, 5).join(", ") + "} - a properties object comes first, and only one";
  }
  return "a " + (value.constructor ? value.constructor.name : "object");
}

// " in X.build() (A › B › X)", for an error about something constructed
// in some component's build() - or nothing, outside any build.
export function inBuild() {
  const creator = getCreator();
  return creator ? " in " + creator.getComponentTypeName() + ".build() (" + componentPath(creator) + ")" : "";
}

export function toPropertiesWithChildren(arglist) {
  const properties = toProperties(arglist);
  findImplicitChildren(properties);
  return properties;
}

export function toProperties(arglist) {
  if (!(arglist instanceof Array)) throw new Error("toProperties expects an array");

  // Shortcut if the only argument is already a single properties object.
  // A copy of it - never the caller's own object: the constructor takes
  // things out of it (key, componentContent), and the caller may reuse it
  // in the next build, or have frozen it.
  const first = arglist[0];
  if (arglist.length === 1 && first !== null && typeof(first) === "object" && !(first instanceof Array) && !isObservable(first)) {
    return { ...first };
  }

  return buildPropertiesObject(arglist);
}

function buildPropertiesObject(arglist) {
  let properties = null;
  let content = null;
  // Where the first real piece of content is, if it came as a loose
  // argument (the implicit key, if it can be one) - -1 if it came in an
  // array, or there is none yet.
  let firstContentIndex = null;

  while (arglist.length > 0) {
    const current = arglist.shift();

    // Nothing - `cond ? child : null`, or showIf(false). Kept, as null,
    // to hold its place among the children: pattern matching pairs
    // unkeyed children by position (see cascade.reactive's "Rebuild shape
    // analysis"), so a child left out mustn't shift the ones after it.
    if (typeof(current) === "undefined" || current === null) {
      if (!content) content = [];
      content.push(null);
      continue;
    }

    if (typeof(current) === "boolean"
      || typeof(current) === "function"
      || typeof(current) === "string"
      || typeof(current) === "number"
      || isObservable(current)) { // a model or a component
      if (!content) content = [];
      if (firstContentIndex === null) firstContentIndex = content.length;
      content.push(current);
    }

    if (typeof(current) === "object" && !current.causality) {
      if (current instanceof Array) {
        // A copy: what follows is pushed onto it, and the array is the
        // caller's (often a component's own children, or frozen).
        if (!content) content = [];
        if (firstContentIndex === null) firstContentIndex = -1;
        current.forEach((element) => content.push(element));
      } else {
        if (properties) {
          throw new Error("Cannot have two properties objects in one argument list" + inBuild() + ".");
        }
        properties = { ...current };
      }
    }
  }

  let implicitKey = null;

  if (!properties) properties = {};

  if (content) {
    if (firstContentIndex !== null && firstContentIndex >= 0 && canBeKey(content[firstContentIndex])) {
      implicitKey = content.splice(firstContentIndex, 1)[0] + "";
      warnIfMeantAsText(implicitKey);
    }
    // Places held after the last child hold nothing for anyone.
    while (content.length > 0 && content[content.length - 1] === null) content.pop();
    if (content.length === 0) content = null;
    properties.componentContent = content;
  }

  if (implicitKey) {
    if (properties.key) {
      throw new Error("Cannot define key both explicitly and implicitly in one argument list.");
    }
    properties.key = implicitKey;
  }

  return properties;
}

// A real gotcha, faithfully ported from flow rather than fixed: the
// *first* loose argument, if it's a number or a string starting with a
// lowercase letter, is always read as the implicit key - whatever else
// follows it. That's the convention: `div("header", title, body)` is a div
// keyed "header" with two children. But it also means `li("first")` is a
// childless li keyed "first", and `button("save", onClick)` a button keyed
// "save" with no label - and whether a string counts depends on its first
// letter, so text that comes from data (a title, a number) can turn into a
// key. Wrap a loose string meant as text in cascade.DOM's `text(...)` (a
// component, never mistaken for a key), or give the key explicitly - see
// cascade.DOM/src/test/domElementComponent.js for a case this bit.
//
// A key with whitespace in it was almost certainly meant as text - warned
// about, once per key.
const warnedKeys = new Set();
function warnIfMeantAsText(key) {
  if (!/\s/.test(key) || warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn("\"" + key + "\" became a key" + inBuild() + ", not text: a leading lowercase string is a key. Wrap text in text(...).");
}

const canBeKey = (content) =>
  (typeof(content) === "string" && /[a-z]/.test(content[0])) || typeof(content) === "number";
