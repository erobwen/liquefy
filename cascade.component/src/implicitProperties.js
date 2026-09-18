import { Component } from "./Component.js";
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
export function createTextNodesFromStringChildren(properties) {
  if (!properties.children) return;
  properties.children = properties.children.map((child) => {
    if (typeof(child) === "undefined" || child === null || child === false) {
      return child;
    } else if (typeof(child) === "string" || typeof(child) === "number") {
      return child;
    } else if (child instanceof Component || isObservable(child)) {
      return child;
    } else {
      throw new Error("Don't know what to do with this child: " + child);
    }
  });
}

export function toPropertiesWithChildren(arglist) {
  const properties = toProperties(arglist);
  findImplicitChildren(properties);
  return properties;
}

export function toProperties(arglist) {
  if (!(arglist instanceof Array)) throw new Error("toProperties expects an array");

  // Shortcut if the only argument is already a single properties object.
  const first = arglist[0];
  if (arglist.length === 1 && first !== null && typeof(first) === "object" && !(first instanceof Array) && !isObservable(first)) {
    return first;
  }

  return buildPropertiesObject(arglist);
}

function buildPropertiesObject(arglist) {
  let properties = null;
  let content = null;
  let firstContentLoose = false;

  while (arglist.length > 0) {
    const current = arglist.shift();

    if (typeof(current) === "undefined" || current === null) {
      continue;
    }

    if (typeof(current) === "boolean"
      || typeof(current) === "function"
      || typeof(current) === "string"
      || typeof(current) === "number"
      || isObservable(current)) { // a model or a component
      if (!content) {
        firstContentLoose = true;
        content = [];
      }
      content.push(current);
    }

    if (typeof(current) === "object" && !current.causality) {
      if (current instanceof Array) {
        if (!content) {
          content = current;
        } else {
          current.forEach((element) => content.push(element));
        }
      } else {
        if (properties) {
          throw new Error("Cannot have two properties objects in one argument list.");
        }
        properties = current;
      }
    }
  }

  let implicitKey = null;

  if (!properties) properties = {};

  if (content) {
    const firstContentItem = content[0];
    if (firstContentLoose && canBeKey(firstContentItem)) {
      implicitKey = content.shift() + "";
      if (content.length === 0) {
        content = null;
      }
    }
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

const canBeKey = (content) =>
  (typeof(content) === "string" && /[a-z]/.test(content[0])) || typeof(content) === "number";
