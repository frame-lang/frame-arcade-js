import { defineConfig } from "vite";

// base: "./" keeps asset paths relative so a built game can be embedded
// anywhere (e.g. dropped into the docs site) without a fixed base path.
export default defineConfig({
  base: "./",
});
