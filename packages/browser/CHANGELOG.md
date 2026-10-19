# @typeonce/ritmo-browser

## 0.10.0

### Patch Changes

- 7002f4d: **Everything a game's agent needs now ships with the packages, and `ritmo-devtools lint` reports simulation modules the lint rules miss.**

  - **Breaking: `ritmo-devtools lint` fails on an uncovered simulation module.** Every module the entry loads that the `ritmo/keep-simulation-headless` override in `.oxlintrc.json` does not cover is reported as `uncovered-simulation-module`, and the command exits 1. Add the module (or its folder) to the simulation override's `"files"`, or stop importing values from it. Modules loaded only inside `lintTarget` are not checked. Requires Node 22.15 or newer (`engines.node` is now `>=22.15`).
  - **An agent skill ships with `@typeonce/ritmo`** in `skills/ritmo/SKILL.md`, for every change: where the docs are, and principles for where a game's code and state belong. Link it into the folder the game's agent reads skills from, for example `ln -s ../../node_modules/@typeonce/ritmo/skills/ritmo .agents/skills/ritmo`. `SETUP.md` in `@typeonce/ritmo` is the one-time setup: the base packages and checks every game uses, the add-ons, and linking the skill.
  - **Every package ships its `CHANGELOG.md`.** The upgrade notes for 0.8.0 and 0.9.0 are in the `@typeonce/ritmo` changelog.
  - **JSDoc corrections.** Examples no longer provide randomness or time as services (use the `Random` resource and `Clock`), the `Command` module example declares its commands, inspector docs state that `added`/`changed` reads report records since the inspector's previous evaluation, and every example uses prefixed names (`"Game/Position"`). Guidance that lived only in the repository's guides (spawn order, `ReadonlyValue` helpers, re-entering a state, `thisTick` and plugin systems, service effects and rollback) is now in the JSDoc.
  - Package READMEs link other packages' READMEs by GitHub URL, so the links work on npm.

- Updated dependencies [7002f4d]
- Updated dependencies [388a696]
  - @typeonce/ritmo@0.10.0

## 0.9.0

### Minor Changes

- 6c09482: **`FixedLoop` moves to core, so any host can drive it.** See Upgrading under 0.9.0 in the `@typeonce/ritmo` CHANGELOG.md.

  - **`FixedLoop` is now exported from `@typeonce/ritmo`** (`import { FixedLoop } from "@typeonce/ritmo"`). Its API is unchanged. `@typeonce/ritmo-browser` no longer exports it.
  - **`BrowserTickSource.make(window)`** in `@typeonce/ritmo-browser` replaces `FixedLoop.animationFrames(window)`. It is the browser's `TickSource`, named like `BrowserHostClock`. Native shells, desktop runtimes, and renderer tickers wrap their own frames with `FixedLoop.source(...)`.
  - **Package sources compile without DOM types.** Core, math, render, browser, and pixi reach no DOM global, and the compiler now rejects one. Published code is unchanged.

### Patch Changes

- 6cd9771: **`Ops`: math that returns the same bits on every engine.**

  JavaScript engines may approximate `Math.sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `exp`, `tanh`, `pow`, `hypot`, and `a ** b`, and they do: V8 on macOS arm64 and on Linux x64, and JavaScriptCore (Safari, every iOS browser), return different last bits, and a simulation grows that bit into a different run. `Ops` from `@typeonce/ritmo-math` has the same functions as pure-JavaScript ports of fdlibm (musl libm), built only from operations every engine rounds exactly, so a run replays bit for bit on any device. Each is within 1 ulp of the exact value (`tanh` within 2, like the native one); `Ops.hypot` takes exactly two numbers and never overflows.

  ```ts
  import { Ops } from "@typeonce/ritmo-math";

  const heading = Ops.atan2(dy, dx);
  const step = { x: Ops.cos(heading) * speed, y: Ops.sin(heading) * speed };
  ```

  Use `Ops` in simulation code instead of those `Math` functions; `Math.abs`, `min`, `max`, `floor`, `ceil`, `round`, `trunc`, `sign`, `sqrt`, `+ - * /`, and `x ** 2` are already exact everywhere.

  `Vec2.rotate`, `length`, `distance`, `normalizeOr`, `moveToward`, `clampLength`, `Collide2` corner normals, and `FlowField.way` now use `Ops`. Their results can differ from the previous version in the last bit, so a replay recorded on an earlier version may diverge. `Touch` (browser) measures stick and aim offsets with `Math.sqrt(x * x + y * y)` instead of `Math.hypot`, for the same reason.

- 886ba39: **Support package fixes from a second review.**

  - **Random state in a resource.** `Random` is now a validator for its own state (`Descriptor.ConstructedResource(Random)("Game/Rng")`, saved and checked like any constructed resource), `Random.seed(n)` is its starting value, and `Random.draw(resources.rng)` gives a generator over the system's write cell that writes every draw back, so a system no longer stores the state by hand and a failed run rolls its draws back. `Random.make(state)` stays for state kept outside the world.
  - **Preconditions are checked.** `Random.integer` throws unless both bounds are whole with `min < maxExclusive` (it drew outside both bounds), and `Random.range` throws when `min > max` or a bound is not finite (equal bounds still return `min`). `SpatialGrid.insert` / `forEachIn` throw on non-finite numbers (an infinite box never returned), and a box covering more cells than are occupied scans the occupied cells. `Random.weighted` calls `weight` once per item.
  - **Input edges.** `Touch`: a `pointerdown` for a pointer id still held (its up was lost) cancels what that id held first, instead of leaving a button held until blur. `Keyboard.scripted`: pressing an action that is already held is not a new press, as with a live keyboard.

- Updated dependencies [c2c32e0]
- Updated dependencies [9cca78b]
- Updated dependencies [6c09482]
- Updated dependencies [ecfd0f1]
- Updated dependencies [d47a4f9]
- Updated dependencies [330246e]
- Updated dependencies [7f2b2dd]
  - @typeonce/ritmo@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [0b22113]
- Updated dependencies [a0fac0a]
- Updated dependencies [0b22113]
- Updated dependencies [a0fac0a]
- Updated dependencies [a580c9c]
- Updated dependencies [a580c9c]
  - @typeonce/ritmo@0.8.0

## 0.7.0

### Minor Changes

- 84eac37: Add simulation time through `Clock.hz`, a validated `Clock.resource`, and a schedule built by `Clock.system`. A held clock sets `dt` to zero and preserves its step. Durations carry their rate, reject sub-step literals, and validate seconds from data through `durationRaw`. Restoring a clock saved at another rate fails validation.

  `FixedLoop.start` and `Replay.recorder` take `step: Clock.hz(...)` instead of `stepSeconds`, sharing one fixed step with the simulation. `HostClock` supplies host timing through an injected contract; browser hosts can use `BrowserHostClock.make(window)`. Debug runtimes use `debug: { hostClock }` and the monitor requires an explicit DOM host.

  Add `Determinism.check` over a factory of fresh headless debug runtimes and scripted inputs. It compares all component and resource values, including transient values, and reruns the first differing frame to name its system or schedule marker. Execution failures, defects, and reused runtimes fail explicitly. This checks repeatability on the current engine.

  New replay files and the lint CLI use the Ritmo name.

- 7ebd9af: One way to do each thing. Breaking changes, with no deprecated aliases:

  - **Systems fail with `Result.failure(error)`.** The `Fx` module is removed (`Fx.fail`, `succeed`, `sync`, `map`, `flatMap`, `access`, `accessService`, `provide`, `runSync`). A system returns nothing or a `Result`; returning `Result.failure(error)` rolls back its ECS writes, drops its commands and events, and types `error` into the tick result exactly like `Fx.fail` did. Replace `return Fx.fail(e)` with `return Result.failure(e)`; a returned lookup failure (`if (!found.ok) return found`) also works. `SystemDefinition` and `Schema.BoundSystem` lose their success type parameter: `SystemDefinition<Spec, E, Root, Name, Needs>`, `BoundSystem<S, Root, Spec, E, Name, Needs>`.
  - **`Feature` is removed** (`Schema.Feature.define` / `compose`). A plugin is a function `(Game, options) => System | Schedule`, like `RenderSync.system(Game, ...)`; list every fragment in one `Schema.bind(...)`.
  - **`Schema.merge` is removed**: use `Schema.bind(A, B, ...)`.
  - **A descriptor owns its validator.** `Definition` is removed: validate through the constructed descriptor (`Game.Command.entryRaw(Position, raw)`, for example in a draft built once at module load) or call the constructor (`Vector2.result(raw)`). `Command.entryResult` is removed: `entryRaw` is the one way to validate raw input at spawn. `setResult` / `updateResult` are removed from write cells: use `setRaw` / `updateRaw` on constructed descriptors. `Brand` is documented as a tool for packages that author validated value types.
  - **`Descriptor.State` is renamed `Descriptor.EntityState`** (per-entity state, not to be confused with the game-wide `Game.StateMachine`). Related names follow: `EntityStateDescriptor`, `EntityStateValue`, `EntityStateTransitions`, `isEntityState`, `EntityStateWriteCell`, and the transition failure `EntityStateMismatchError` with `_tag: "EntityStateMismatch"` and `component` (was `state`) naming the component.
  - **Silent failures are loud.** `RemovedReadView` and `DespawnedReadView` gain `lagged()`, like event readers. `describe()` reports a `relation-failure-never-read` warning for a relation that commands have related or reordered while no described system reads its failures.
  - **Devtools invariants are typed.** `Invariant.make(name, () => ...)` is replaced by `Invariant.fromInspector(Game.Inspector(name, access, check))`, where `check` returns a violation message or `undefined`. `Session.make` rejects at compile time an invariant that reads a resource, service, or machine the runtime does not provide. `Runtime.ValidateInspector` is exported for tools like this.
  - JSDoc now states when to use each of `EntityScope` / `Hierarchy`, `when` / `pauseWhen` (on a system and on `Schedule.when` / `Schedule.pauseWhen`), `tryTick` / `tick`, and `Game.StateMachine` / `Descriptor.EntityState`.
  - **`Game.System.thisTick(read)`**: wraps `readEvent(E)` or `readResource(R)` to require that every system writing it runs earlier in the same `runtime.tick(...)` call. `tick` checks it at compile time ("ApplyDamage needs Damage from this tick, but its writer UpdateFrostFields runs after it: move ..."), and calls whose order is not statically known (a read with no writer compiles); `tryTick` checks it at runtime (`TickOrderViolation`) and `describe()` reports `this-tick-order`. Schedule types gain a sixth parameter (`Order`); constraint positions accept any with `Schedule.AnyScheduleOrder`.
  - **Lint as a tool.** `ritmo-devtools lint <entry>` (and `Lint.run` in code) prints every lint of a game's schedules with its fix, and exits 1 on warnings (info does not fail). The entry module exports `lintTarget: () => { runtime, schedules, describe? }`. `Debug.Lint` gains `fix`, the change that resolves it.
  - **Replays.** `Replay.recorder(runtime, { schedule, name, keep, stepSeconds, sink, hostClock, saveOn? })` keeps the last seconds of one schedule's ticks (periodic snapshots, source-service values as changes, host sends) and saves them through a `Replay.Sink`: `Replay.memorySink`, `ReplayNodeSink` (files), `ReplayViteSink` with `ReplayVitePlugin` (dev server), and Monitor's new `replay` option ("Save replay" button). A recorded schedule whose services are not plain-data `snapshot()` sources or plain data is a compile error. `Replay.session`, `verify`, and `extract` replay a file headless. Core's `Debug.Handle` gains `observeHost` (tick start/end and sends, without tracing).
  - **`debug` takes a host clock: `debug: { hostClock }`** (`debug: true` is removed). Core and devtools read no platform clock or globals: the new core `HostClock` module is the injected contract (`HostClock.standard` is `Date.now`, `HostClock.test()` is a manual clock at 0 with `adjust(ms)` returning a `Result`, `HostClock.elapsed` clamps negative durations), and `BrowserHostClock.make(window)` in the browser package reads `window.performance`. A value that may be `undefined` (`debug: import.meta.env.DEV ? { hostClock } : undefined`) gives an optional `debug` handle that code must check, so a dev-only debug runtime needs no second runtime type; omitting `debug` attaches nothing. Devtools take the clock and host explicitly: `Session.make(runtime, { ..., hostClock })`, `Replay.recorder(runtime, { ..., hostClock })`, a replay target returns `hostClock`, and `Monitor.attach(runtime, { ..., host: window })`. With `HostClock.test()` every timing is 0, so session and replay text is identical across runs.
  - **Lookups go through declared queries.** `lookup.get(id, Q)`, `lookup.getHandle(h, Q)`, `lookup.childMatches(id, R, Q)`, and `lookup.descendantMatches(id, R, Q)` are removed: they let a system read or write components it never declared. Use `queries.x.get(id)`, `queries.x.getHandle(h)` (same intent proof), `queries.x.children(id, R)`, and `queries.x.descendants(id, R, options)` on a query in the spec. `lookup` keeps the id-returning helpers (`related`, `relatedSources`, `parent`, `ancestors`, `descendants`, `root`).
  - **Systems declare their commands.** A system has `commands` only when its spec declares them: `commands: Game.System.commands(Game.System.spawns(Position, Enemy), Game.System.inserts(Stunned), Game.System.removes(Stunned), Game.System.despawns(Enemy), Game.System.despawnsScope(Level), Game.System.relates(ChildOf))`. Each method exists only with its permission, and only for what it lists; errors name the fix ("Noise is not declared in this system's commands: add it to Game.System.spawns(...)"). Drafts built from spread arrays or conditional entries are checked over every component they may hold. `despawn` takes `match.entity` from a query proving one of the `despawns` components, or the `SpawnedId` that `spawn` / `spawnIn` returned in the same run, never a raw id. The draft builder `Game.Command.insert` is renamed `Game.Command.extend` (it clashed with `commands.insert`). Spawn-time relations in a draft (`Game.Command.relate(draft, ...)`) are part of the spawn and need no `relates`.
  - **`Game.System.thisTick(query)`**: a query that needs this tick's command changes. Its writers are systems whose declared commands can change what it matches (`spawns` covering every component it requires, or `inserts` / `removes` of any component it names, optional slots, `with`, `without`, and filters included; `despawns` never count). `runtime.tick(...)` rejects a writer that runs after the reader, and one before it with no `applyDeferred()` in between ("AimAtNewest needs this tick's commands for queries.enemies, but SpawnWave queues them with no applyDeferred() in between: add Game.Schedule.applyDeferred() after SpawnWave"). Transition bundles count at their `applyStateTransitions(...)` step (which applies queued commands first), as if every schedule in them runs, markers inside included; this now also holds for event and resource reads. `tryTick` and the `this-tick-order` lint check the same at runtime (`OrderIssue.kind` gains `"unflushedWriter"`); `tryTick` checks each schedule once. Transition schedules and bundles carry their order (a sixth / seventh type parameter, defaulting to any order).
  - **Fix: a `Game.Query(...)` written inline in a spec keeps omitted lists empty.** Without `with` (or `without`, `filters`, relation lists) an inline query in `queries: { ... }` took the spec's widened list type (every component), so it proved every component to `despawn` and `getHandle`. Omitted lists are now `[]` wherever the query is written.
  - **Devtools read declared command permissions.** `describe()` lists each system's permissions (`SystemDescription.commands`) and indexes `spawns` / `inserts` / `removes` as component writers, so `component-never-read` covers components only commands write. `relation-failure-never-read` also fires for a declared `relates` before any command ran. New `command-permission-unused` lint (info): on a debug runtime, "X may insert C but never did in this session" for systems that ran. `session.why(entity, Component)` names the systems whose `spawns` could have spawned the entity.
  - **Ignored tick failures are reported (debug only).** A failed `tick` / `tryTick` result whose `ok` nobody read is reported as a `failure.ignored` trace and host event (`frame`, `schedule`, `system`, `error`, `skipped`: the systems that did not run, `when: "next-tick" | "session-end"`) at the start of the next tick, or by the new `debug.checkIgnoredFailures()`. Core emits only. Devtools: `Session.run` stops with `reason: "ignored-failure"`, `report()` / `journal()` show "tick failure ignored: Load failed with "level file missing"; 2 later systems did not run (not read before the next tick)", the replay recorder saves on it (`saveOn.failure`), and the monitor raises an alert.

### Patch Changes

- 358401a: Link the bevy-ts migration guide from each published package README.
- Updated dependencies [84eac37]
- Updated dependencies [7ebd9af]
- Updated dependencies [358401a]
  - @typeonce/ritmo@0.7.0

## 0.6.0

### Minor Changes

- 130cb6e: Rename the package family from `@typeonce/bevy-ts*` to `@typeonce/ritmo*`.
  Update imports, workspace dependencies, type identity markers, examples, and
  documentation together. There are no compatibility aliases; use the matching
  Ritmo package for each previous Bevy TS package. The separate release preparation
  change coordinates the repository rename and retirement of the generated
  documentation site.
  Use "The agent-first type safe ECS runtime" in package metadata,
  documentation, and brand assets.

### Patch Changes

- a8e0473: Retire the generated documentation site and point package homepages, source links,
  and issue links to the Ritmo repository in the Typeonce GitHub organization.
  Keep source JSDoc and repository guides, including the Pixi walkthrough in its
  example README.
- Updated dependencies [a8e0473]
- Updated dependencies [130cb6e]
- Updated dependencies [a1f18a8]
  - @typeonce/ritmo@0.6.0

## 0.5.0

### Patch Changes

- @typeonce/bevy-ts@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [e2b2275]
  - @typeonce/bevy-ts@0.4.0

## 0.3.0

### Minor Changes

- 421a727: Add `Touch`: on-screen touch controls over an element.

  - A floating stick that appears where the thumb lands in its region, with a dead zone and a tilt of length 0 to 1.
  - Buttons with `held`/`pressed`/`released` edges that survive taps shorter than a frame. Buttons with an `aimRadius` aim by dragging (Brawl Stars style), and the aim is reported on the release. A cancelled touch (system gesture, window blur) releases with `cancelled: true`.
  - Each finger belongs to one control, so moving and attacking work at the same time. The layout is a function of the element's size.
  - `view()` returns live positions for drawing the controls, and `scripted(buttons, timeline)` plays timelines for tests.
  - Sets `touch-action: none` on the element while tracking.

  `Pointer.track` now ignores touch pointers by default (new `pointerTypes` option, default `["mouse", "pen"]`), so a finger on an on-screen control is not also a click.

- f196f48: `Touch` layouts take an optional `swipe` area: a finger landing there, and not on a button or the stick, reports how far it moved since the previous snapshot (`snapshot().swipe.delta`, in CSS pixels). This enables Genshin Impact-style controls: move with the stick on the left, and swipe anywhere else to turn or look around. Scripted timelines take `swipe` deltas per frame.

### Patch Changes

- 2b0fb7e: Add `Game.Condition.check(name, access, predicate)` (types in `@typeonce/bevy-ts/Condition`): a run condition computed by ordinary code, so conditions need no growing set of combinators. A check declares its reads like a system and receives them read-only. It may read resources, machines, and queries with no write slots and no `added`/`changed` filters; events, transition events, removed/despawned reads, relation failures, and services are compile errors, as are other games' descriptors and non-boolean predicates. Its reads become requirements of whatever it gates, through `not`/`and`/`or`, a system's `when`, and `Schedule.when`. Checks are evaluated before each gated system against committed values, so they see writes from earlier systems in the same run, and they never advance the world tick or a reader cursor. A throwing predicate propagates like a throwing system. Devtools render checks as `check(name)` and count their reads as the gated system's reads.

  Conditions now carry their requirements in one type-level field, read with `ConditionNeeds` / `ConditionNeedsFromConditions`. `MachineNeedsFromCondition(s)` remain and extract only the machines. `InputCapture.system` and `RenderSync` (`system`, `interpolate`) pass a check's requirements through their `when` option.

- Updated dependencies [2b0fb7e]
- Updated dependencies [c4d1add]
- Updated dependencies [bd9bdd5]
- Updated dependencies [bd9bdd5]
- Updated dependencies [94bdc32]
- Updated dependencies [bd9bdd5]
  - @typeonce/bevy-ts@0.3.0

## 0.2.0

### Minor Changes

- 4b3a312: Add `Pointer`: mouse and pen input over one element, with element-relative position, whether the pointer is over the element, and `primary`/`secondary`/`middle` button states with press/release edges that survive clicks shorter than a frame. It captures the pointer while a button is held, suppresses the context menu by default, and releases buttons on window blur. `Pointer.scripted`, `Pointer.recording`, and `Pointer.parseTimeline` mirror the keyboard timeline helpers for tests and replays.
- 4b3a312: Keyboard bindings can match physical keys: `Keyboard.code("KeyW")` binds by `KeyboardEvent.code`, so a position stays fixed across layouts (WASD on AZERTY) and modifiers cannot change the match (Option+W typing "∑" on macOS, Shift+1 typing "!"). Character and physical bindings mix freely on one action. Character bindings are also more robust: a key released while a modifier changed its character (W pressed, then Option, then W released as "∑") now releases its action instead of staying held. `KeyEvent` gains an optional `code`; the module docs list browser-reserved shortcuts (Ctrl/Cmd+W) that pages cannot block.
- 4b3a312: `InputCapture.system(...)` and `RenderSync.system(...)` accept `when`, run conditions like a system's own. A gated capture takes no snapshots meanwhile, so presses stay in the device until it resumes (pauses, hit-stop); a gated render sync catches up on additions, changes, and removals when it runs again. The machines the conditions read are requirements of the generated system.

### Patch Changes

- Updated dependencies [4b3a312]
- Updated dependencies [4b3a312]
- Updated dependencies [4b3a312]
  - @typeonce/bevy-ts@0.2.0

## 0.1.1

### Patch Changes

- c95a102: First release published from CI through npm trusted publishing, with provenance attestations. Declarations are now verified against consumers on both TypeScript 7 and TypeScript 6. No API or output changes.
- Updated dependencies [c95a102]
  - @typeonce/bevy-ts@0.1.1
