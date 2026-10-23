// The human guide to Ritmo, built from the workspace packages: every
// `ts twoslash` snippet compiles against their current source, and an
// unexpected type error fails the build (see README.md).
import mdx from "@astrojs/mdx"
import { defineConfig } from "astro/config"

import ritmo from "./src/shiki/ritmo.json" with { type: "json" }
import { annotations } from "./src/shiki/transformers.mjs"
import { twoslash } from "./twoslash.mjs"

export default defineConfig({
  site: "https://ritmo.typeonce.dev",
  trailingSlash: "always",
  integrations: [mdx()],
  markdown: {
    shikiConfig: {
      theme: ritmo,
      transformers: [twoslash(), ...annotations()]
    }
  },
  vite: {
    // The brand assets live at the repository root (brand/assets).
    server: { fs: { allow: [".."] } }
  }
})
