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

## For agents

Setting up Ritmo in a game:

1. Install the runtime, the packages the game needs, and the checks:

   ```sh
   pnpm add @typeonce/ritmo @typeonce/ritmo-math @typeonce/ritmo-browser
   pnpm add -D @typeonce/ritmo-devtools @typeonce/oxlint-plugin-ritmo oxlint
   ```

   Add `@typeonce/ritmo-render` to mirror entities into a renderer, and
   `@typeonce/ritmo-pixi` for Pixi.
2. Link the skill into the folder you read skills from (`.agents/skills`,
   `.claude/skills`, ...), and follow it:

   ```sh
   mkdir -p .agents/skills
   ln -s ../../node_modules/@typeonce/ritmo/skills/ritmo \
     .agents/skills/ritmo
   ```

3. Set up `.oxlintrc.json` from the
   [oxlint plugin README](https://github.com/typeonce-dev/ritmo/blob/main/packages/oxlint-plugin/README.md)
   and a `ritmo-devtools lint` entry from the
   [devtools README](https://github.com/typeonce-dev/ritmo/blob/main/packages/devtools/README.md).
   Run typecheck, `oxlint`, `ritmo-devtools lint`, and the tests in the
   game's check script.

The API reference is the JSDoc in `node_modules/@typeonce/*/src`: read a
module's header before using it. Upgrade notes are in each package's
`CHANGELOG.md`.

Related packages, released together with the same version:

- [`@typeonce/ritmo-math`](https://github.com/typeonce-dev/ritmo/blob/main/packages/math/README.md): validated vectors, sizes, and bounding boxes
- [`@typeonce/ritmo-browser`](https://github.com/typeonce-dev/ritmo/blob/main/packages/browser/README.md): animation-frame ticks for the fixed-step loop, keyboard, pointer, and touch input
- [`@typeonce/ritmo-render`](https://github.com/typeonce-dev/ritmo/blob/main/packages/render/README.md): entity-to-node sync for any renderer
- [`@typeonce/ritmo-pixi`](https://github.com/typeonce-dev/ritmo/blob/main/packages/pixi/README.md): Pixi container adapter for the render-node registry
- [`@typeonce/ritmo-devtools`](https://github.com/typeonce-dev/ritmo/blob/main/packages/devtools/README.md): headless debug sessions and trace reports
- [`@typeonce/oxlint-plugin-ritmo`](https://github.com/typeonce-dev/ritmo/blob/main/packages/oxlint-plugin/README.md): oxlint rules that keep simulation code deterministic and headless

Source: https://github.com/typeonce-dev/ritmo
