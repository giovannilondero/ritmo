import plugin from "@typeonce/oxlint-plugin-ritmo"
import { tester } from "./tester.ts"

const rule = plugin.rules["keep-simulation-headless"]!

tester.run("keep-simulation-headless", rule, {
  valid: [
    "type Window = typeof window",
    // Input arrives through ritmo-browser and resources.
    "import { Keyboard } from \"@typeonce/ritmo-browser\"; const pressed = resources.input.get().jump.pressed",
    "import { Vec2 } from \"@typeonce/ritmo-math\"",
    // Fields and locals named like page globals (inkline-town sim/term.ts).
    "const term = { window: 12 }; const left = term.window - 1",
    "function open(location: { x: number }) { return location.x }",
    "class Shop { fetch = 0 }",
    "import { history } from \"./ledger.ts\"; history.push(entry)"
  ],
  invalid: [
    { code: "const muted = localStorage.getItem(\"muted\") === \"1\"", errors: [{ messageId: "io", data: { name: "localStorage" } }] },
    { code: "const data = await fetch(url)", errors: [{ messageId: "io", data: { name: "fetch" } }] },
    { code: "const wide = window.innerWidth > 800", errors: [{ messageId: "page", data: { name: "window" } }] },
    { code: "document.title = score.toString()", errors: [{ messageId: "page", data: { name: "document" } }] },
    { code: "if (matchMedia(\"(prefers-reduced-motion)\").matches) skip()", errors: [{ messageId: "page", data: { name: "matchMedia" } }] },
    { code: "import { Container } from \"pixi.js\"", errors: [{ messageId: "renderer", data: { source: "pixi.js" } }] },
    { code: "import * as THREE from \"three\"", errors: [{ messageId: "renderer", data: { source: "three" } }] },
    { code: "import { RenderSync } from \"@typeonce/ritmo-render\"", errors: [{ messageId: "renderer", data: { source: "@typeonce/ritmo-render" } }] },
    { code: "import * as NodeRegistry from \"@typeonce/ritmo-render/NodeRegistry\"", errors: [{ messageId: "renderer", data: { source: "@typeonce/ritmo-render/NodeRegistry" } }] },
    { code: "import { useState } from \"preact/hooks\"", errors: [{ messageId: "renderer", data: { source: "preact/hooks" } }] },
    { code: "export { Sprite } from \"@pixi/sprite\"", errors: [{ messageId: "renderer", data: { source: "@pixi/sprite" } }] },
    { code: "const ui = await import(\"react-dom/client\")", errors: [{ messageId: "renderer", data: { source: "react-dom/client" } }] },
    {
      // inkline-town moved these out of its schema so the renderer can be swapped.
      code: "import type { Container } from \"pixi.js\"",
      errors: [{ messageId: "rendererType", data: { source: "pixi.js" } }]
    },
    { code: "import { type Container } from \"pixi.js\"", errors: [{ messageId: "rendererType", data: { source: "pixi.js" } }] },
    { code: "import type { NodeRegistry } from \"@typeonce/ritmo-render\"", errors: [{ messageId: "rendererType", data: { source: "@typeonce/ritmo-render" } }] },
    { code: "export type { Sprite } from \"pixi.js\"", errors: [{ messageId: "rendererType", data: { source: "pixi.js" } }] },
    {
      // A game's own renderer package, from the options.
      code: "import { draw } from \"@town/canvas/draw\"",
      options: [{ packages: ["@town/canvas"] }],
      errors: [{ messageId: "renderer", data: { source: "@town/canvas/draw" } }]
    }
  ]
})
