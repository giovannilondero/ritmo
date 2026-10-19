<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./brand/assets/ritmo-lockup-padded-inverse.svg">
    <img alt="Ritmo" src="./brand/assets/ritmo-lockup-padded.svg" width="360">
  </picture>
</p>

# Ritmo

The agent-first type safe ECS runtime

You direct the mechanics and feel. Your coding agent builds the simulation with
closed schemas, declared system access, explicit schedule boundaries, and typed
services. Compile-time checks reject undeclared access and missing requirements;
headless sessions expose lints, invariants, journals, and the causes of changes.

Ritmo works with your renderer and game loop. Its packages provide simulation,
input, timing, math, and renderer bridges. Drawing stays in the game.

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="./brand/assets/ritmo-motion-still.svg">
    <img alt="Ritmo: The agent-first type safe ECS runtime" src="./brand/assets/ritmo-banner.gif" width="720">
  </picture>
</p>

## Quick start

```sh
pnpm add @typeonce/ritmo
```

Requires TypeScript 5.9 or newer. The type tests run on every TypeScript
version from 5.9 up, and the packages build with TypeScript 7.

Leave `noErrorTruncation` off in your tsconfig. A rejected call's error names
the fix near its start, and the type tests check that every fix stays visible
in TypeScript's default (truncated) message; with truncation off, an error that
prints a whole schema can run to tens of kilobytes.

```ts
import { Clock, Descriptor, Schema } from "@typeonce/ritmo"

// Define the world once: components, resources, and the fixed step.
const step = Clock.hz(60)
const Time = Clock.resource("Example/Time", step)
const Position = Descriptor.Component<{ x: number; y: number }>()("Example/Position")
const Velocity = Descriptor.Component<{ x: number; y: number }>()("Example/Velocity")

// Bind the schema to its game-facing APIs.
const Game = Schema.bind(Schema.fragment({ components: { Position, Velocity }, resources: { Time } }))

const AdvanceTime = Clock.system(Game, { name: "Example/AdvanceTime", resource: Time })

// Systems receive only the access they declare.
const Move = Game.System("Example/Move", {
  queries: { moving: Game.Query({ selection: { position: Game.Query.write(Position), velocity: Game.Query.read(Velocity) } }) },
  resources: { time: Game.System.readResource(Time) }
}, ({ queries, resources }) => {
  const { dt } = resources.time.get()
  for (const match of queries.moving.each()) {
    const position = match.data.position.get()
    const velocity = match.data.velocity.get()
    match.data.position.set({ x: position.x + velocity.x * dt, y: position.y + velocity.y * dt })
  }
})

// Starting can fail (the clock is a validated resource), and so can a tick: both return a Result.
const made = Game.Runtime.make({ services: Game.Runtime.services(), resources: { Time: Clock.start(step) } })
if (made.ok) {
  const runtime = made.value
  const ticked = runtime.tick(Game.Schedule(AdvanceTime, Move))
  if (!ticked.ok) console.error(ticked.error)
}
```

## Packages

| Package | Contents |
|---|---|
| `@typeonce/ritmo` | The ECS runtime and the fixed-step loop |
| `@typeonce/ritmo-math` | Validated vectors, sizes, and bounding boxes; swept collision, spatial grid, flow field, deterministic random, and trig/exp/pow that return the same bits on every engine |
| `@typeonce/ritmo-browser` | Animation-frame tick source, keyboard, pointer, and touch input, input capture |
| `@typeonce/ritmo-render` | Entity to renderer node sync, for any renderer |
| `@typeonce/ritmo-pixi` | Pixi container adapter (`PixiNodeRegistry.make`) |
| `@typeonce/ritmo-devtools` | Headless debug sessions and trace reports ([README](./packages/devtools/README.md)) |
| `@typeonce/oxlint-plugin-ritmo` | Oxlint rules that keep simulation code deterministic and headless and runtime results checked ([README](./packages/oxlint-plugin/README.md)) |

All packages are released together with the same version.

## Set up your agent

Your agent learns Ritmo from what installs with it: the source and its JSDoc
in `node_modules/@typeonce/*/src`, each package's README and changelog, and
one skill with the principles for structuring a game.

1. Install the packages the game uses, for example
   `pnpm add @typeonce/ritmo @typeonce/ritmo-math @typeonce/ritmo-browser` and
   `pnpm add -D @typeonce/ritmo-devtools @typeonce/oxlint-plugin-ritmo oxlint`.
2. Link the skill, so it updates with every Ritmo upgrade:

   ```sh
   mkdir -p .claude/skills
   ln -s ../../node_modules/@typeonce/ritmo/skills/ritmo .claude/skills/ritmo   # Codex: .agents/skills/
   ```

3. Ask the agent to set up `.oxlintrc.json` from the
   [oxlint plugin README](https://www.npmjs.com/package/@typeonce/oxlint-plugin-ritmo)
   and a lint entry for `ritmo-devtools lint` from the
   [devtools README](https://www.npmjs.com/package/@typeonce/ritmo-devtools),
   and to run both in the game's check.

## Guarantees

- Names are unique: a bound schema rejects two descriptors of one kind with the same name at compile time.
- Nothing structural happens implicitly. Queued commands and state transitions wait for an explicit `applyDeferred()` or `applyStateTransitions(...)` in the schedule.
- Every system sees each change, event, and transition published since its own previous run, exactly once.
- Failures are values. A system that fails rolls back its writes, and the tick returns the failure.
- Queries visit only entities carrying their rarest required component and cache their matches. CI fails a pull request whose runtime benchmarks regress over 25%.

Ritmo was previously named `bevy-ts`: see the [rename guide](./MIGRATION.md).

<sub>[Brand assets and palette](./brand/README.md)</sub>
