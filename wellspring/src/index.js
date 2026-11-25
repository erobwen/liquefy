import getWorld from "@liquefy/cascade.reactive";
import { createDataModel } from "./dataModel.js";
import { createSpringHost } from "./spring.js";

export { createDataModel } from "./dataModel.js";
export { DataModelError, sameValue } from "./values.js";
export { Spring } from "./spring.js";

/**
 * Wellspring's default world, and its data model. The world is made with an event hook that
 * hands Cascade's change events to every open store, which is how a property write becomes a
 * write to the database (design section 4).
 *
 * The data model alone, without Aquifer, is `@liquefy/wellspring/dataModel`, for code that runs
 * on clients too.
 */
let host = null;
export const world = getWorld({ name: "wellspring", onEventGlobal: (event) => host && host.dispatch(event) });
export const model = createDataModel(world);
host = createSpringHost(model);

/**
 * Opens a store: `open({ store, classes })`, where `store` is Aquifer's MemoryStore or
 * LmdbStore, and `classes` the classes to register, by name. Returns a Spring, whose `root` is
 * the database's root object.
 */
export const open = host.open;

export const { transaction, repeat, ensure, meta, metaData } = world;

export const {
  Synchronized, synchronized, isSynchronized, weak,
  registerClass, registerClasses,
  encodeValue, decodeValue, encodeRecord, decodeRecord, makeFromRecord,
} = model;
