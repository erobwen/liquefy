import getWorld from "@liquefy/cascade.reactive";
import { createDataModel } from "./dataModel.js";

export { createDataModel } from "./dataModel.js";
export { DataModelError, sameValue } from "./values.js";

/**
 * The data model of Wellspring's default world. An application that shares a
 * world with something else, such as Cascade's components on a client, makes
 * its own with createDataModel(world) instead (whitepaper section 2.6: one
 * Cascade world per machine).
 */
export const world = getWorld({ name: "wellspring" });
export const model = createDataModel(world);

export const {
  Synchronized, synchronized, isSynchronized, weak,
  registerClass, registerClasses,
  encodeValue, decodeValue, encodeRecord, decodeRecord, makeFromRecord,
} = model;
