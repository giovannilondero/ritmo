---
name: ritmo
description: "Apply when setting up @typeonce/ritmo in a project, or building or changing a game on it: gameplay, content, readouts, UI, saves, host integration, splitting modules, or upgrading Ritmo. Setup, where the Ritmo docs are, and principles for where code and state belong so changes stay local and mistakes fail early."
---

# Ritmo games

Follow the game's existing structure and conventions. These principles decide where something belongs; the game decides its folders, UI framework, renderer, timing, and design.

## Setup

Do this once per project, and again for any step a project is missing. Use the project's package manager.

1. Install the runtime and the checks every Ritmo game uses:
   ```sh
   pnpm add @typeonce/ritmo @typeonce/ritmo-math
   pnpm add -D @typeonce/ritmo-devtools @typeonce/oxlint-plugin-ritmo oxlint
   ```
2. Link this skill from the installed package into the folder your agent reads skills from (`.agents/skills`, `.claude/skills`, ...), so it updates with every Ritmo upgrade:
   ```sh
   mkdir -p .agents/skills
   ln -s ../../node_modules/@typeonce/ritmo/skills/ritmo .agents/skills/ritmo
   ```
3. Set up `.oxlintrc.json` from the `@typeonce/oxlint-plugin-ritmo` README and a `ritmo-devtools lint` entry from the `@typeonce/ritmo-devtools` README. One check script runs the type check, `oxlint`, `ritmo-devtools lint`, and the tests.

Add-ons, installed only when the game needs them:
- `@typeonce/ritmo-browser`: a browser host (animation-frame loop, keyboard, pointer, touch).
- `@typeonce/ritmo-render`: mirrors entities into any renderer's nodes.
- `@typeonce/ritmo-pixi`: the Pixi adapter for `@typeonce/ritmo-render`.

## Where the docs are

- The API reference is the JSDoc in `node_modules/@typeonce/*/src`. Read a module's header before using the module, and an export's JSDoc before calling it. Do not work from memory or the web: the API changes between versions.
- Each package's `README.md` in `node_modules` covers its setup and workflow.
- When upgrading, read each package's `CHANGELOG.md` from the installed version up. Breaking entries name the fix.
- Compiler errors and lint messages name the fix. Apply it; never cast around it.

## Principles

**The simulation is the game; everything else is a host.**
- Put rules that change the world in systems. Put input capture, drawing, UI, storage, network, and audio in host code.
- Treat any code that changes saved world state as gameplay, wherever it lives.

**Input goes in as intents; output comes out as reads.**
- Turn player actions into typed host events (`runtime.send(...)`) or input resources that one system validates and applies. UI and render code never change saved world state.

**Each fact has one home.**
- Define each closed set (items, tools, building kinds) once. Derive labels, shortcuts, menus, and lookups from it.
- Type tables that must cover the whole set with `satisfies Record<Id, T>`, so a new id fails to compile until every table has an entry. Keep optional overrides `Partial` with an explicit default.

**Each piece of state has an owner and a lifetime.**
- For every new mutable value, choose its home: saved world state (a component or resource), unsaved runtime state (a transient component or resource, or the system's `local`), or host state (a service or host code). Decide what happens to it on new game, restore, and dispose.
- Keep gameplay state (counters, ids, timers, flags) out of module variables: they survive restore, ignore rollback, and are shared by every runtime in the process. A cache inside a pure helper, keyed by its whole input, is fine.
- When moving code, keep each shared cache, pool, and long-lived host object single.

**Extend what exists before adding.**
- Search for an existing system, component, definition, or UI piece first. Extend it or add a variant instead of writing a near copy.
- Add a system only for behaviour no existing one covers. New content that reuses behaviour is data.
- Give UI pieces a narrow view model and intent callbacks, not the runtime or a whole host object.

**Make the next mistake fail loudly.**
- When a rule can be a type, a lint, or a headless test, encode it there instead of in a comment.
- Verify a gameplay change with a headless run that asserts the observable outcome. Reproduce a bug headless before fixing it, then keep the reproduction as a test.
- Keep `oxlint` and `ritmo-devtools lint <entry>` in the game's check.
- Test the simulation with `Determinism.check` from `@typeonce/ritmo-devtools`: it runs it twice and names the first value that differs, which catches hidden inputs and module state.

## Self-check

- Does any UI or render code change saved world state?
- Did adding this id produce a type error everywhere it is needed?
- What happens to this value on restore?
- Did I extend an existing piece, or copy it?
- What check fails if someone breaks this tomorrow?
