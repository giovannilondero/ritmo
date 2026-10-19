---
"@typeonce/ritmo": patch
"@typeonce/ritmo-math": patch
"@typeonce/oxlint-plugin-ritmo": minor
---

**The Ritmo skill routes each change to a playbook, and simulation code names no renderer type.**

- **Breaking: `ritmo/keep-simulation-headless` reports type-only renderer imports** (`import type { Container } from "pixi.js"`, `export type ... from "three"`) and subpath imports of `@typeonce/ritmo-render` and `@typeonce/ritmo-pixi`. A schema that names a renderer type ties the simulation to that renderer. Move the renderer service (a `Descriptor.Service<NodeRegistry.NodeRegistry<Sprite>>()(...)`) and the systems that use it into render code; services are not registered in the schema, so nothing else changes:

  ```diff
  -// src/game/schema.ts
  -import type { Sprite } from "pixi.js"
  -export const Sprites = Descriptor.Service<NodeRegistry.NodeRegistry<Sprite>>()("Game/Sprites")
  +// src/render/sprites.ts
  +import type { Sprite } from "pixi.js"
  +export const Sprites = Descriptor.Service<NodeRegistry.NodeRegistry<Sprite>>()("Game/Sprites")
  ```

- **The skill in `skills/ritmo` now has playbooks**: one per kind of change (a mechanic, content, UI and rendering, a bug fix, a refactor, state and upgrades), each a short list of steps that ends with the check that proves it. `SKILL.md` routes to them and keeps the principles. A game that already links the skill folder gets them on upgrade.
