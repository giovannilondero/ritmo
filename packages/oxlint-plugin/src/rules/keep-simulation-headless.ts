import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

import { docsUrl, importsOnlyTypes, isGlobalReference, stringValue } from "../internal/ast.ts"

/** Globals that are the page: input and layout. */
const page = new Set([
  "window", "document", "navigator", "screen", "matchMedia", "getComputedStyle", "devicePixelRatio",
  "innerWidth", "innerHeight", "addEventListener", "removeEventListener", "alert", "confirm", "prompt"
])

/** Globals that do host I/O: storage, network, navigation. */
const io = new Set([
  "localStorage", "sessionStorage", "indexedDB", "caches", "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "location", "history"
])

/** Renderer and UI packages, by exact name. */
const renderers = new Set([
  "@typeonce/ritmo-render", "@typeonce/ritmo-pixi", "pixi.js", "three", "react", "react-dom", "preact",
  "vue", "svelte", "solid-js", "phaser", "konva", "p5", "babylonjs", "@babylonjs/core"
])

/** Renderer and UI packages, by scope or subpath. */
const rendererPrefixes = ["@typeonce/ritmo-render/", "@typeonce/ritmo-pixi/", "@pixi/", "@preact/", "@react-three/", "three/", "react-dom/", "preact/", "@babylonjs/", "solid-js/"]

interface Options {
  readonly packages?: ReadonlyArray<string>
}

/**
 * Simulation code runs headless (tests, bots, replays, servers): it never
 * touches the page, does host I/O, or imports a renderer, not even a type,
 * so another renderer can replace the current one. The host feeds it input
 * and data, and render code draws it.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Keep simulation code headless: no page globals, host I/O, or renderer imports.",
      url: docsUrl("keep-simulation-headless")
    },
    messages: {
      page:
        "`{{name}}` is the page, which tests, bots, and replays do not have. Capture input in the host with `Keyboard`, `Pointer`, or `Touch` from `@typeonce/ritmo-browser` and `InputCapture` into a resource, and read that resource in systems. Pass other page state (size, settings) in from host code with `runtime.send(...)` or a resource.",
      io:
        "`{{name}}` is host I/O, which tests, bots, and replays do not have and cannot reproduce. Do the I/O in host code and pass the result in with `runtime.send(...)` or a resource; save and load the world in host code with `runtime.snapshot()` and `runtime.restore(...)`.",
      renderer:
        "The simulation imports `{{source}}`, a renderer or UI package, so it no longer runs headless. Draw from a render schedule in render code: mirror entities into nodes with `RenderSync` and a `NodeRegistry` from `@typeonce/ritmo-render`, and declare its services (a node registry) there. Renderer nodes stay in the registry, never in components.",
      rendererType:
        "The simulation names a type from `{{source}}`, a renderer or UI package, so it is tied to that renderer and another one cannot replace it. Declare renderer services (a node registry) and their types in render code; services are not registered in the schema. Renderer nodes stay in the registry, never in components."
    },
    schema: [
      {
        type: "object",
        properties: {
          packages: {
            type: "array",
            items: { type: "string" },
            description: "More renderer or UI packages the simulation must not import (a name, or a prefix ending in `/`)."
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options
    const extra = options.packages ?? []
    const isRenderer = (source: string): boolean =>
      renderers.has(source) ||
      rendererPrefixes.some((prefix) => source.startsWith(prefix)) ||
      extra.some((entry) => (entry.endsWith("/") ? source.startsWith(entry) : source === entry || source.startsWith(`${entry}/`)))
    const checkSource = (node: ESTree.Node, source: string | undefined, onlyTypes = false): void => {
      if (source !== undefined && isRenderer(source)) context.report({ node, messageId: onlyTypes ? "rendererType" : "renderer", data: { source } })
    }
    return {
      ImportDeclaration(node) {
        checkSource(node, node.source.value, importsOnlyTypes(node))
      },
      ExportNamedDeclaration(node) {
        if (node.source !== null) checkSource(node, node.source.value, node.exportKind === "type")
      },
      ExportAllDeclaration(node) {
        checkSource(node, node.source.value, node.exportKind === "type")
      },
      ImportExpression(node) {
        checkSource(node, stringValue(node.source))
      },
      Identifier(node) {
        const kind = page.has(node.name) ? "page" : io.has(node.name) ? "io" : undefined
        if (kind === undefined) return
        // `typeof window` in a type runs nothing.
        if (node.parent.type === "TSTypeQuery" || node.parent.type === "TSQualifiedName") return
        if (!isGlobalReference(context, node)) return
        context.report({ node, messageId: kind, data: { name: node.name } })
      }
    }
  }
})
