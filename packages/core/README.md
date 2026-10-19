# `@typeonce/ritmo`

The agent-first type safe ECS runtime

Closed schemas, declared system access, explicit schedule boundaries, typed
services, and no user-facing casts for normal usage.

```sh
pnpm add @typeonce/ritmo
```

```ts
import { Descriptor, Schema } from "@typeonce/ritmo"

const Position = Descriptor.Component<{ x: number; y: number }>()("Example/Position")
const Game = Schema.bind(Schema.fragment({ components: { Position } }))
```

Modules are also importable by path, for example `@typeonce/ritmo/Result`.

Agents: setup, where the docs are, and how to structure a game are in the skill at `skills/ritmo/SKILL.md`. Follow its Setup section in a new project.

Related packages, released together with the same version:

- [`@typeonce/ritmo-math`](https://github.com/typeonce-dev/ritmo/blob/main/packages/math/README.md): validated vectors, sizes, and bounding boxes
- [`@typeonce/ritmo-browser`](https://github.com/typeonce-dev/ritmo/blob/main/packages/browser/README.md): animation-frame ticks for the fixed-step loop, keyboard, pointer, and touch input
- [`@typeonce/ritmo-render`](https://github.com/typeonce-dev/ritmo/blob/main/packages/render/README.md): entity-to-node sync for any renderer
- [`@typeonce/ritmo-pixi`](https://github.com/typeonce-dev/ritmo/blob/main/packages/pixi/README.md): Pixi container adapter for the render-node registry
- [`@typeonce/ritmo-devtools`](https://github.com/typeonce-dev/ritmo/blob/main/packages/devtools/README.md): headless debug sessions and trace reports
- [`@typeonce/oxlint-plugin-ritmo`](https://github.com/typeonce-dev/ritmo/blob/main/packages/oxlint-plugin/README.md): oxlint rules that keep simulation code deterministic and headless

Source: https://github.com/typeonce-dev/ritmo
