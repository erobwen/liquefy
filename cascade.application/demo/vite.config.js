// For more info: https://vitejs.dev/config/
import { defineConfig } from 'vite'
import { cascadePrerender } from '@liquefy/cascade.prerender'
import { llmsTxt } from './llms.js'

export default defineConfig({
  server: {
    historyApiFallback: true
  },
  // JSX, in .jsx files only (see src/pages/JsxPage.jsx): tags compile to
  // calls into cascade.dom's JSX runtime, which makes service queries of
  // them - a document for hydrate() (see cascade.DOM/src/jsx-runtime.js).
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@liquefy/cascade.dom'
  },
  // Every page prerendered, found from the first one by following the
  // menu's links (see cascade.prerender) - so the demo's pages can be read
  // without running it. SITE_ORIGIN, where it will be (see
  // scripts/build-site.mjs), makes their addresses absolute and adds a
  // sitemap. CASCADE_PRERENDER=false builds without. The manual is a route
  // to start from too: its group in the menu is closed, with no links in
  // it - but its contents link to every chapter.
  // llms.txt and llms-full.txt: the documentation, for an AI (see llms.js).
  plugins: [
    cascadePrerender({ site: process.env.SITE_ORIGIN || undefined, routes: ["", "manual"] }),
    llmsTxt({ site: process.env.SITE_ORIGIN || "" })
  ]
})
