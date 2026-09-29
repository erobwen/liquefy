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
  retractRepeater,
  refreshIfNeeded,
  state,
} = world;
