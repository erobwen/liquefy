/**
 * Hydration and dehydration - what a file holds, and the objects it holds
 * them as. As in cascade.component (see its ServiceLocator.js), what's saved
 * is service queries: every object in it is
 *
 *   { "type": "flow", "name": "paragraph", "properties": { ... } }
 *
 * - `type` its family, `name` its kind in it - its properties, plain values
 * (text, numbers, a paper's name) and further queries, anywhere in them: in
 * a list, in a plain object. Anything else - an object without a string
 * `type` - is a plain value.
 *
 * hydrate(json, locator) hands each query to the service locator - its
 * properties hydrated first, so each object is made with the objects in it
 * already made - as `{ type, name, properties, baseClass }`, and takes what
 * it gives. Which class that is, is the locator's - the plugins' - business,
 * not the file's: loosely coupled, but not entirely - a family says what
 * everything in it is, its base class:
 *
 *   locator.locate({ type: "family", name: "flow" })  ->  { baseClass: Flow, keepUnknown }
 *
 * Every object of the family is checked to be one - so what reads a flow
 * from a file can count on its being a Flow, whoever made it - and handed to
 * the locator as `baseClass`, for it to choose by. With `keepUnknown`, a
 * query no plugin in use provides - or one with something in it none
 * provides - is kept as it is (Unhydrated), to be saved as it was: a
 * document of a kind no plugin knows, until one that knows it is turned on.
 * A family nobody describes is checked for nothing.
 *
 * dehydrate(value) is each object's own: its `dehydrate()` gives its query
 * - the objects in its properties as they are, dehydrated in turn.
 */

// A query: a plain object with a string `type`.
export const isQuery = (value) => value !== null && typeof(value) === "object" && !(value instanceof Array) && typeof(value.type) === "string";

// Not provided by any plugin in use - what a family keeping the unknown
// keeps (see above).
export class NotProvided extends Error {}

// A query kept as it is: its `json` - and its `name`, what kind of thing it
// is, and why it wasn't hydrated.
export class Unhydrated {
  constructor(json, reason = "") {
    this.json = json;
    this.name = json.name;
    this.reason = reason;
  }

  dehydrate() {
    return this.json;
  }
}

export function hydrate(json, locator) {
  if (json instanceof Array) return json.map((each) => hydrate(each, locator));
  if (json === null || typeof(json) !== "object") return json;
  if (!isQuery(json)) return mapValues(json, (value) => hydrate(value, locator));
  const family = locator.locate({ type: "family", name: json.type }) || {};
  try {
    const properties = hydrate(json.properties || {}, locator);
    const result = locator.locate({ type: json.type, name: json.name, properties, baseClass: family.baseClass });
    if (result === undefined) throw new NotProvided("No plugin in use provides " + describe(json));
    if (family.baseClass && !(result instanceof family.baseClass)) {
      throw new Error(describe(json) + " isn't a " + family.baseClass.name + ", as every " + json.type + " is");
    }
    return result;
  } catch (error) {
    if (family.keepUnknown && error instanceof NotProvided) return new Unhydrated(json, error.message);
    throw error;
  }
}

export function dehydrate(value) {
  if (value instanceof Array) return value.map(dehydrate);
  if (value === null || typeof(value) !== "object") return value;
  if (value instanceof Unhydrated) return value.json;
  if (typeof(value.dehydrate) === "function") {
    const { type, name, properties } = value.dehydrate();
    return { type, name, properties: dehydrate(properties || {}) };
  }
  return mapValues(value, dehydrate);
}

const describe = (json) => json.type + " “" + json.name + "”";

function mapValues(object, map) {
  const result = {};
  for (const key of Object.keys(object)) {
    if (typeof(object[key]) !== "undefined") result[key] = map(object[key]);
  }
  return result;
}
