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
  temporal,
  deeplyObservable,
  isObservable,
  isTemporal,
  repeat,
  linkRepeater,
  finalize,
  establish,
  dispose,
  withoutRecording,
  sameAsPreviousDeep,
  invalidateOnChange,
  postponeInvalidations,
  continueInvalidations,
  flush,
  accessInitialValues,
  declareState,
  declareGiven,
  retractRepeater,
  refreshIfNeeded,
  state,
} = world;
