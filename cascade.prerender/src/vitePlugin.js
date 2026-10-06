import { resolve } from "node:path";
import { prerender } from "./prerender.js";

/**
 * Prerendering as part of `vite build`: once the app is built, its pages
 * are prerendered into the same folder (see prerender.js for the options -
 * dist and base come from Vite's own config, outDir and base).
 *
 *   // vite.config.js
 *   import { cascadePrerender } from "@liquefy/cascade.prerender";
 *   export default defineConfig({
 *     plugins: [cascadePrerender({ site: "https://shop.example", routes: async () => productRoutes() })],
 *   });
 *
 * `enabled: false` (or the CASCADE_PRERENDER=false environment variable)
 * builds without it.
 */
export function cascadePrerender(options = {}) {
  let config;
  return {
    name: "cascade-prerender",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      if (options.enabled === false || process.env.CASCADE_PRERENDER === "false") return;
      if (config.build.ssr || config.build.watch) return;
      const { enabled, ...rest } = options;
      await prerender({
        dist: resolve(config.root, config.build.outDir),
        base: config.base,
        log: (message) => config.logger.info(message),
        ...rest,
      });
    },
  };
}
