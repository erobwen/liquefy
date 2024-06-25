// For more info: https://vitejs.dev/config/
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [],
  build: {
    minify: false,
    lib: {
      entry: resolve(__dirname, 'index.js'),
      name: "flow"
    }
  }
})
