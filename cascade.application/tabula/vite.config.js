// For more info: https://vitejs.dev/config/
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    historyApiFallback: true,
  },
  build: {
    rollupOptions: {
      // Tabula, and the classic Tabula app it grew out of (classic.html).
      input: { main: "index.html", classic: "classic.html" },
    },
  },
});
