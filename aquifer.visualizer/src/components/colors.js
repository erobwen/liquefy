/** The visualizer's colors, shared by the graph and the panels. */

export const colors = {
  text: "#1f2933",
  muted: "#61707f",
  surface: "#ffffff",
  background: "#f3f5f8",
  line: "#d9dee5",
  root: "#1f2933",
  stable: "#c9d5e3",
  stableBorder: "#8fa3b8",
  deferred: "#d98b00",
  held: "#7b4bc4",
  reclaimed: "#c0392b",
  unstable: "#d6336c", // every cohort, unless cohort colors are on
  region: "#f7f9fc",
  regionBorder: "#b8c4d2",
  metaBorder: "#7d8ea3",
  /** Meta-region fills by level (1, 2, 3, 4+): deeper the higher. */
  metaLevels: ["#e3eaf3", "#d5e0ed", "#c7d5e6", "#b9cadf"],
  structure: "#e07a1f",
  edge: "#9aa7b4",
  tree: "#2f3d4c",
  weak: "#b9c2cc",
  flag: "#e07a1f",
  subject: "#ffd60a",
  written: "#9be59b",
  read: "#9ccfff",
  selected: "#0b57d0",
};

/** One color per cohort, by the number in its id. */
const cohortPalette = ["#e4572e", "#17a398", "#2e86ab", "#a259ff", "#d6336c", "#76b041", "#f18f01", "#5c6bc0"];

export function cohortColor(cohortId) {
  // Ids are a letter followed by a base-36 number.
  const number = parseInt(String(cohortId).slice(1), 36) || 0;
  return cohortPalette[number % cohortPalette.length];
}

/** What each step kind is called, and its badge color. */
export const stepKinds = {
  start: { title: "Start", color: "#61707f" },
  transaction: { title: "Transaction", color: "#0b57d0" },
  deferral: { title: "Deferral due", color: colors.deferred },
  structure: { title: "Structure task", color: colors.structure },
  expand: { title: "Expand", color: "#17a398" },
  mark: { title: "Mark", color: "#d6336c" },
  check: { title: "Check", color: "#2e86ab" },
  checkReclaim: { title: "Check and reclaim", color: colors.reclaimed },
  reclaim: { title: "Reclaim", color: colors.reclaimed },
};
