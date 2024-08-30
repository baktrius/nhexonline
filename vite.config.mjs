import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve('./static/src'),
  base: "/static/",
  build: {
    manifest: "manifest.json",
    outDir: resolve("./assets"),
    rollupOptions: {
      input: {
        main: resolve('./static/src/js/main.js'),
        play: resolve('./static/src/js/play.js')
      }
    }
  },
  server: {
    port: 5173,
    origin: "http://localhost:5173",
  }
})
