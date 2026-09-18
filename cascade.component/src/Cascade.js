import getWorld from "@liquefy/cascade.reactive";

/**
 * World (from cascade.reactive)
 */
export const world = getWorld({
  name: "cascade.component",
});

/**
 * World functions
 */
export const {
  observable,
  deeplyObservable,
  isObservable,
  repeat,
  linkRepeater,
  finalize,
  withoutRecording,
  sameAsPreviousDeep,
  invalidateOnChange,
  postponeInvalidations,
  continueInvalidations,
  flush,
  accessInitialValues,
  state,
} = world;
