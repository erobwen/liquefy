// For more info: https://vitejs.dev/config/
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [],
  build: {
    minify: true,
    // Named exports - and the default (getWorld) as `.default` - for require() users too.
    rollupOptions: { output: { exports: "named" } },
    lib: {
      entry: resolve(__dirname, 'src/causality.js'),
      name: "@liquefy/causality"
    },
  }
})
