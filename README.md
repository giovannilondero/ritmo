<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./brand/assets/ritmo-lockup-padded-inverse.svg">
    <img alt="Ritmo" src="./brand/assets/ritmo-lockup-padded.svg" width="360">
  </picture>
</p>

# Ritmo

**The agent-first, type-safe ECS runtime for games.**

🎮 You direct the mechanics and feel.<br>
🤖 Your coding agent writes the simulation.<br>
🛡️ Ritmo keeps the agent on track:

- ✅ **Wrong code does not compile.** Undeclared access and missing
  requirements are type errors, and each error names the fix.
- 🔍 **Every run can be inspected.** Headless sessions show lints,
  invariants, journals, and why each value changed.
- 🎨 **Your renderer, your loop.** Ritmo brings simulation, input, timing,
  math, and renderer bridges. Drawing stays in your game.

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

- Requires TypeScript 5.9 or newer (tested on every version from 5.9 up).
- Leave `noErrorTruncation` off: errors name the fix near their start, and
  an untruncated error can print a whole schema.

```ts
import { Clock, Descriptor, Schema } from "@typeonce/ritmo"

type Vec = { x: number; y: number }

// Define the world once: components, resources, and the fixed step.
const step = Clock.hz(60)
const Time = Clock.resource("Example/Time", step)
const Position = Descriptor.Component<Vec>()("Example/Position")
const Velocity = Descriptor.Component<Vec>()("Example/Velocity")

// Bind the schema to its game-facing APIs.
const Game = Schema.bind(
  Schema.fragment({
    components: { Position, Velocity },
    resources: { Time }
  })
)

const AdvanceTime = Clock.system(Game, {
  name: "Example/AdvanceTime",
  resource: Time
})

// Systems receive only the access they declare.
const Move = Game.System(
  "Example/Move",
  {
    queries: {
      moving: Game.Query({
        selection: {
          position: Game.Query.write(Position),
          velocity: Game.Query.read(Velocity)
        }
      })
    },
    resources: { time: Game.System.readResource(Time) }
  },
  ({ queries, resources }) => {
    const { dt } = resources.time.get()
    for (const match of queries.moving.each()) {
      const position = match.data.position.get()
      const velocity = match.data.velocity.get()
      match.data.position.set({
        x: position.x + velocity.x * dt,
        y: position.y + velocity.y * dt
      })
    }
  }
)

// Starting can fail (the clock is a validated resource),
// and so can a tick: both return a Result.
const made = Game.Runtime.make({
  services: Game.Runtime.services(),
  resources: { Time: Clock.start(step) }
})
if (made.ok) {
  const runtime = made.value
  const ticked = runtime.tick(Game.Schedule(AdvanceTime, Move))
  if (!ticked.ok) console.error(ticked.error)
}
```

## Packages

All packages are released together with the same version.

| Package | Contents |
|---|---|
| `@typeonce/ritmo` | ECS runtime and fixed-step loop |
| `@typeonce/ritmo-math` | Vectors, collision, spatial grid, flow field, seeded random, same-bits trig |
| `@typeonce/ritmo-browser` | Animation-frame ticks, keyboard, pointer, and touch input |
| `@typeonce/ritmo-render` | Entity-to-node sync for any renderer |
| `@typeonce/ritmo-pixi` | Pixi adapter for the render node registry |
| `@typeonce/ritmo-devtools` | Headless debug sessions, reports, and `ritmo-devtools lint` |
| `@typeonce/oxlint-plugin-ritmo` | Lint rules for deterministic, headless simulation code |

## Set up your agent

Your agent learns Ritmo from what installs with it: the source and its JSDoc,
each package's README and changelog, and one skill with the principles for
structuring a game.

1. Install the packages the game uses:

   ```sh
   pnpm add @typeonce/ritmo @typeonce/ritmo-math @typeonce/ritmo-browser
   pnpm add -D @typeonce/ritmo-devtools @typeonce/oxlint-plugin-ritmo oxlint
   ```

2. Link the skill into your agent's skills folder. A symlink keeps it in step
   with every Ritmo upgrade. `.agents/skills` is shown; use the folder your
   agent reads (for example `.claude/skills`):

   ```sh
   mkdir -p .agents/skills
   ln -s ../../node_modules/@typeonce/ritmo/skills/ritmo \
     .agents/skills/ritmo
   ```

3. Ask the agent to set up `.oxlintrc.json` from the
   [oxlint plugin README](https://www.npmjs.com/package/@typeonce/oxlint-plugin-ritmo)
   and `ritmo-devtools lint` from the
   [devtools README](https://www.npmjs.com/package/@typeonce/ritmo-devtools),
   and to run both in the game's check.

## Guarantees

- 🏷️ **Unique names.** A schema rejects two descriptors of one kind with the
  same name at compile time.
- ⏸️ **No hidden structural changes.** Commands and state transitions wait
  for an explicit `applyDeferred()` or `applyStateTransitions(...)`.
- 📬 **Every change seen once.** Each system sees what was published since
  its own previous run, exactly once.
- ↩️ **Failures are values.** A failing system rolls back its writes, and
  the tick returns the failure.
- ⚡ **Fast queries.** Queries visit only entities with their rarest
  required component and cache their matches. CI fails on runtime
  regressions over 25%.

Ritmo was previously named `bevy-ts`: see the [rename guide](./MIGRATION.md).

<sub>[Brand assets and palette](./brand/README.md)</sub>
