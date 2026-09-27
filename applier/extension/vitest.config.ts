import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      // The same turn build.mjs gives the board adapters' form reader: a module around it.
      name: "shared-reader",
      enforce: "pre",
      load(id) {
        if (/[\\/]js[\\/]fields\.js$/.test(id)) {
          return `export default ${readFileSync(id, "utf8").trim().replace(/;$/, "")};`;
        }
      },
    },
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["test/setup.ts"],
  },
});
