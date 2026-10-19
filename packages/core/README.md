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

The API reference is the JSDoc in `src/`: each module's header says what it is for and which neighbouring API to use instead. Upgrade notes are in `CHANGELOG.md`; breaking entries name the fix. The agent skill for building games ships in `skills/ritmo/SKILL.md`; link it into the folder the game's agent reads skills from, for example `ln -s ../../node_modules/@typeonce/ritmo/skills/ritmo .agents/skills/ritmo`.

Related packages, released together with the same version:

- [`@typeonce/ritmo-math`](https://www.npmjs.com/package/@typeonce/ritmo-math): validated vectors, sizes, and bounding boxes
- [`@typeonce/ritmo-browser`](https://www.npmjs.com/package/@typeonce/ritmo-browser): animation-frame ticks for the fixed-step loop, keyboard, pointer, and touch input
- [`@typeonce/ritmo-render`](https://www.npmjs.com/package/@typeonce/ritmo-render): entity-to-node sync for any renderer
- [`@typeonce/ritmo-pixi`](https://www.npmjs.com/package/@typeonce/ritmo-pixi): Pixi container adapter for the render-node registry
- [`@typeonce/ritmo-devtools`](https://www.npmjs.com/package/@typeonce/ritmo-devtools): headless debug sessions and trace reports
- [`@typeonce/oxlint-plugin-ritmo`](https://www.npmjs.com/package/@typeonce/oxlint-plugin-ritmo): oxlint rules that keep simulation code deterministic and headless

Source: https://github.com/typeonce-dev/ritmo
