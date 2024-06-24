// For more info: https://vitejs.dev/config/
import { defineConfig } from 'vite'
import { resolve } from 'path'
import depsExternal from 'rollup-plugin-deps-external'

// Automatic externals
import { peerDependencies } from './package.json';
const external = []
Object.keys(peerDependencies).map(dependency => external.push(dependency));
// console.log("external dependencies:")
// console.log(external);

export default defineConfig({
  plugins: [],
  build: {
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: "flowDOMTarget"
    },
    rollupOptions: {
      external,
      plugins: [
        depsExternal()  // Note: not sure if this one is really needed.
      ]
    }
  }
})
