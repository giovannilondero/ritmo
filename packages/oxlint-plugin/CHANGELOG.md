# @typeonce/oxlint-plugin-ritmo

## 0.14.0

## 0.13.0

### Minor Changes

- 791b52a: **`ritmo/no-state-spread`** reports `_tag` set over a spread of the previous state, such as `{ ...ground, _tag: "air", vy: 2 }`: the old state's fields survive at runtime while the new state's type hides them. Move an entity state with `cell.transition({ from, to, data })`, queue a state machine's move with the new state's fields (`nextMachines.x.set({ _tag, ...fields })`), or write the new state's fields out. Spreads that change fields of the same state are not reported. Turn it on for every file:

  ```jsonc
  "ritmo/no-state-spread": "error"
  ```

### Patch Changes

- 835f6ba: `ritmo/no-infinity-in-simulation-data` no longer names `Decode`: its fix is a nullable number schema from the game's schema library.

## 0.12.0

## 0.11.0

### Patch Changes

- e46f284: **Documentation pass over every public module.** Every export has JSDoc saying what it is for and which neighbouring API to use instead; examples that no longer compiled (`Session.make` without `hostClock`, `Replay.session`, the `Pointer` rebind) are fixed; `Debug.Lint` lists every lint code the runtime emits. The `stale-target` lint's fix now names `queries.x.getHandle(handle)`.

## 0.10.0

### Minor Changes

- 388a696: **The Ritmo skill routes each change to a playbook, and simulation code names no renderer type.**

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

### Patch Changes

- 7002f4d: **Everything a game's agent needs now ships with the packages, and `ritmo-devtools lint` reports simulation modules the lint rules miss.**

  - **Breaking: `ritmo-devtools lint` fails on an uncovered simulation module.** Every module the entry loads that the `ritmo/keep-simulation-headless` override in `.oxlintrc.json` does not cover is reported as `uncovered-simulation-module`, and the command exits 1. Add the module (or its folder) to the simulation override's `"files"`, or stop importing values from it. Modules loaded only inside `lintTarget` are not checked. Requires Node 22.15 or newer (`engines.node` is now `>=22.15`).
  - **An agent skill ships with `@typeonce/ritmo`** in `skills/ritmo/SKILL.md`, for every change: where the docs are, and principles for where a game's code and state belong. Link it into the folder the game's agent reads skills from, for example `ln -s ../../node_modules/@typeonce/ritmo/skills/ritmo .agents/skills/ritmo`. `SETUP.md` in `@typeonce/ritmo` is the one-time setup: the base packages and checks every game uses, the add-ons, and linking the skill.
  - **Every package ships its `CHANGELOG.md`.** The upgrade notes for 0.8.0 and 0.9.0 are in the `@typeonce/ritmo` changelog.
  - **JSDoc corrections.** Examples no longer provide randomness or time as services (use the `Random` resource and `Clock`), the `Command` module example declares its commands, inspector docs state that `added`/`changed` reads report records since the inspector's previous evaluation, and every example uses prefixed names (`"Game/Position"`). Guidance that lived only in the repository's guides (spawn order, `ReadonlyValue` helpers, re-entering a state, `thisTick` and plugin systems, service effects and rollback) is now in the JSDoc.
  - Package READMEs link other packages' READMEs by GitHub URL, so the links work on npm.

## 0.9.0

### Minor Changes

- 003b902: **New package: `@typeonce/oxlint-plugin-ritmo`, oxlint rules for Ritmo games.**

  Types reject wrong calls and devtools lints reject wrong runs; these rules catch the source patterns neither can see. Every report says what goes wrong and the Ritmo API to use instead.

  Simulation files (listed in an `overrides` entry, so host, render, and unrelated files keep using the platform):

  - `ritmo/use-clock-for-time`: `Date.now()`, `performance.now()`, `new Date()`, and timers; read the `Clock` resource.
  - `ritmo/use-random-for-randomness`: `Math.random()` and `crypto` randomness; draw with `Random.draw(resources.rng)`.
  - `ritmo/use-ops-for-math`: `Math.sin`, `Math.hypot`, `a ** b`, and the other functions engines approximate; use `Ops` (fixes itself once `Ops` is imported).
  - `ritmo/keep-simulation-headless`: page globals, host I/O, and renderer or UI imports; take input and data from the host, draw in a render schedule.
  - `ritmo/no-infinity-in-simulation-data`: `Infinity` and `NaN` in object literals, which cannot be saved and loaded; use `null`.

  Every file:

  - `ritmo/handle-tick-result`: a dropped `runtime.tick(...)`, `tryTick(...)`, or `restore(...)` result.
  - `ritmo/prefix-descriptor-and-system-names`: names without a `Game/` prefix.
  - `ritmo/use-cell-value`: `cell.present ? cell.get() : undefined`; use `cell.value()` (fixes itself).

  ```jsonc
  {
    "jsPlugins": ["@typeonce/oxlint-plugin-ritmo"],
    "rules": { "ritmo/handle-tick-result": "error" },
    "overrides": [
      {
        "files": ["src/sim/**"],
        "rules": { "ritmo/use-ops-for-math": "error" }
      }
    ]
  }
  ```
