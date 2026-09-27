// Builds the unpacked extension into dist/: load that folder in chrome://extensions.
//
// Three scripts, each bundled on its own (a content script cannot be an ES module), plus the
// static page and the manifest copied as they are. `fields.js` — the board adapters' form
// reader, shared rather than copied — is a bare function expression; the plugin below turns
// it into a module's default export.

import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");

const sharedReader = {
  name: "shared-reader",
  setup(builder) {
    builder.onLoad({ filter: /[\\/]js[\\/]fields\.js$/ }, async ({ path }) => ({
      contents: `export default ${(await readFile(path, "utf8")).trim().replace(/;$/, "")};`,
      loader: "js",
    }));
  },
};

const options = {
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    panel: "src/panel/panel.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome116",
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
  plugins: [sharedReader],
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("static", "dist", { recursive: true });

if (watch) {
  await (await context(options)).watch();
} else {
  await build(options);
}
