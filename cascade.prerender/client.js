// What runs in the app itself, in the browser - nothing of the build-time
// prerendering (Node, Playwright) comes along.
export { PrerenderedElementTarget, prerenderedAttribute, takeOverPrerendered } from "./src/PrerenderedElementTarget.js";
