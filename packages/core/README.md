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

Agents: set up a project with `SETUP.md`, then follow the skill at `skills/ritmo/SKILL.md` on every change.

Related packages, released together with the same version:

- [`@typeonce/ritmo-math`](https://github.com/typeonce-dev/ritmo/blob/main/packages/math/README.md): validated vectors, sizes, and bounding boxes
- [`@typeonce/ritmo-browser`](https://github.com/typeonce-dev/ritmo/blob/main/packages/browser/README.md): animation-frame ticks for the fixed-step loop; keyboard, gamepad, pointer, and touch actions, merged into one input or split across local players
- [`@typeonce/ritmo-render`](https://github.com/typeonce-dev/ritmo/blob/main/packages/render/README.md): entity-to-node sync for any renderer
- [`@typeonce/ritmo-pixi`](https://github.com/typeonce-dev/ritmo/blob/main/packages/pixi/README.md): Pixi container adapter for the render-node registry
- [`@typeonce/ritmo-netcode`](https://github.com/typeonce-dev/ritmo/blob/main/packages/netcode/README.md): online multiplayer: rollback and lockstep sessions over any transport
- [`@typeonce/ritmo-devtools`](https://github.com/typeonce-dev/ritmo/blob/main/packages/devtools/README.md): headless debug sessions and trace reports
- [`@typeonce/oxlint-plugin-ritmo`](https://github.com/typeonce-dev/ritmo/blob/main/packages/oxlint-plugin/README.md): oxlint rules that keep simulation code deterministic and headless

Source: https://github.com/typeonce-dev/ritmo
