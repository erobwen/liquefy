// For more info: https://vitejs.dev/config/
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [],
  build: {
    minify: true,
    lib: {
      entry: resolve(__dirname, 'src/causality.js'),
      name: "@liquefy/causality"
    },
  }
})
