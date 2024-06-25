// For more info: https://vitejs.dev/config/
import { defineConfig } from 'vite'
import { resolve } from 'path'
import depsExternal from 'rollup-plugin-deps-external'

// Automatic externals
import { peerDependencies } from './package.json';
const external = []
Object.keys(peerDependencies).map(dependency => external.push(dependency));

export default defineConfig({
  plugins: [],
  build: {
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: "flow.core"
    },
    rollupOptions: {
      external,
      output: {
        globals: {
          '@liquefy/causaility' : 'getWorld',
        }
      }
      // ,
      // plugins: [
      //   depsExternal()  // Note: not sure if this one is really needed.
      // ]
    }
  }
})
