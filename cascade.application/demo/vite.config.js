// For more info: https://vitejs.dev/config/
import { defineConfig } from 'vite'

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
  }
})
