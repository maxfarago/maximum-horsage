import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        annotate: "tools/annotate/index.html",
      },
    },
  },
});
