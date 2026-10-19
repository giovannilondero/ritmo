# @typeonce/ritmo-render

## 0.9.0

### Patch Changes

- 330246e: **Safety follow-ups from a second review.** Each closes a way a game could go wrong silently; see Upgrading under 0.9.0 in the `@typeonce/ritmo` CHANGELOG.md.

  - **A `SpawnedId` is valid only in the run that spawned it.** Kept in a closure or resource and passed to `commands.despawn` / `commands.remove` in a later run, it could name an entity despawned meanwhile whose id was reused. Such a command is now skipped, traced as a `staleTarget` effect, and reported by the new `stale-target` lint (`Debug.StaleTarget`). Keep the entity id or a handle and resolve it through a query.
  - **`any` and `never` are not descriptor values.** `Descriptor.Component<any>()`, `Resource`, `Event`, `Service`, and the transient variants fail at the constructor: `any` turned off every check on the descriptor, and `never` erased the fragment listing it.
  - **A saved component cannot require a transient one.** `Schema.bind` rejects `Schema.requires(Ghost, Trail)` when only `Trail` is transient: a restore brought `Ghost` back without it. A transient requirer may still require a transient component.
  - **Queries with `added` / `changed` filters have no lookups.** `get`, `getHandle`, `single`, `children`, and `descendants` failed with `QueryMismatch` whenever the target had not changed since the system's previous run; they no longer compile there. Declare a second query without filters to resolve entities. `each()` and `singleOptional()` are unchanged. The handle types are now `QueryIteration` and `QueryLookups` (`QueryHandle` combines them).
  - **A transition's exit phase is one transaction.** When a system in `onExit` / `onTransition` fails, everything the phase did (component writes, resources, events, queued next states and commands, stream positions) is undone and the transition stays queued, so the retry starts from the same state instead of running the earlier exit systems twice. These schedules can no longer contain `applyDeferred()`.
  - **A service or machine provided twice does not compile.** `Runtime.services` / `Runtime.machines` kept the last of two provisions; the second now fails, naming it.
  - **`RenderSync` recovers from dropped removals.** After a pause longer than a stream keeps entries, the removals it missed left nodes on screen; when its removal stream reports `lagged()`, it now destroys every node whose entity no longer matches. Give each `RenderSync.system` its own registry.
  - **New lint `stream-loss-unread`.** On a debug runtime, a reader of events, transition events, removed, despawned, or relation failures that lost entries without checking `lagged()` is a warning, and one reading under `pauseWhen` without checking it is noted (`Debug.StreamLoss`).

- Updated dependencies [c2c32e0]
- Updated dependencies [9cca78b]
- Updated dependencies [6c09482]
- Updated dependencies [ecfd0f1]
- Updated dependencies [d47a4f9]
- Updated dependencies [330246e]
- Updated dependencies [7f2b2dd]
  - @typeonce/ritmo@0.9.0

## 0.8.0

### Minor Changes

- a0fac0a: **`Game.Query.anyOf`.** `anyOf(...filters)` takes two or more `added` / `changed` filters and matches an entity once when any of them passes since the reading system's previous run, for example to redraw when either the position or the sprite changed. Filters listed side by side in `filters: [...]` still all have to pass. `anyOf` does not nest, and `Game.Condition.check` rejects it like every other change filter.

  - `RenderSync.system` now builds one query per sync system (an `anyOf` of its added and changed filters) instead of one query per trigger plus deduplication.
  - `Debug.QueryDescription` gains `anyOf` (one entry per `anyOf` filter, with its `added` and `changed` components); code that builds a `QueryDescription` by hand must add it. The text report prints it as `any of (...)`, and Monitor counts its components as reads.

### Patch Changes

- Updated dependencies [0b22113]
- Updated dependencies [a0fac0a]
- Updated dependencies [0b22113]
- Updated dependencies [a0fac0a]
- Updated dependencies [a580c9c]
- Updated dependencies [a580c9c]
  - @typeonce/ritmo@0.8.0

## 0.7.0

### Patch Changes

- 358401a: Link the bevy-ts migration guide from each published package README.
- Updated dependencies [84eac37]
- Updated dependencies [7ebd9af]
- Updated dependencies [358401a]
  - @typeonce/ritmo@0.7.0

## 0.6.0

### Minor Changes

- c20bbc0: `RenderSync.interpolate` takes a `blend` option for values beyond a 2D position (3D positions, angles, scales), and `place` receives what `blend` returns. Without `blend` only `x` and `y` are blended, so `blend` is now required when a component is not `{ x, y }` or holds other numbers: a `{ x, y, z }` position no longer type-checks while its `z` is silently left unblended.
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
- a1f18a8: Two fixes:

  - **Snapshots keep entity scopes.** `snapshot()` now saves scope membership (`scopes`: per scope name, its members' ids) and `restore()` rebuilds it, so `despawnScope` finds restored entities. The format moves to version 2. Version 1 snapshots had no scopes and are rejected with `UnsupportedVersion` instead of being restored with every scoped entity loose. Invalid membership (an id that is not a saved entity, or one in two scopes) fails with `InvalidScope`.
  - **RenderSync follows membership.** A node now exists exactly while its entity has the renderable, the transform, and every required `select` slot. It is created whichever of them arrives last, and destroyed when any of them is removed (before, only the renderable's arrival and removal counted). The redundant despawn read is gone, because despawns are recorded as removals.

- Updated dependencies [a8e0473]
- Updated dependencies [130cb6e]
- Updated dependencies [a1f18a8]
  - @typeonce/ritmo@0.6.0

## 0.5.0

### Patch Changes

- @typeonce/bevy-ts@0.5.0

## 0.4.0

### Minor Changes

- e2b2275: New package `@typeonce/bevy-ts-render`: the renderer-agnostic part of `@typeonce/bevy-ts-pixi`, the entity-keyed node registry (`NodeRegistry.make`) and the render sync systems (`RenderSync.system`, `RenderSync.interpolate`), for games drawn with Three.js, the DOM, or any other renderer.

  **Breaking:** import `NodeRegistry` and `RenderSync` from `@typeonce/bevy-ts-render`. Pixi exports only `PixiNodeRegistry`, with `make(container)` replacing `NodeRegistry.inContainer(container)`. The platform-prefixed adapter implements the generic registry contract and is provided through the existing typed runtime service API. The old Pixi modules and re-exports are removed immediately. Pixi depends only on the render package, dropping its unused browser and core dependencies.

  This combines the four planned steps into one 0.4.0 release of the fixed package group.

  - `Game.Schedule.pauseWhen` retains event-reader cursors during a pause. Ordinary `when` gates still discard messages across mode changes and take precedence over pause gates in either nesting order. Stream capacity bounds retention, and debug traces expose whether a skipped run held messages.
  - A system's optional `local` factory owns scratch state per runtime, shared by gated copies. Locals are neither rolled back nor snapshotted and are rebuilt after successful restore. Debug descriptions show which systems declare them.
  - Optional and conditional local factories preserve `undefined` in the callback type. Factories allocate fresh scratch state without side effects; mode changes preserve locals, and values needing cleanup belong in host-managed services.
  - `runtime.send` immediately publishes a schema event from the host at a fresh tick. Calls during a tick or with unknown descriptors throw. Unread host messages survive restore without replaying to readers that already consumed them. Devtools trace sends and include external producers in event lints.
  - **Breaking:** `EntityId` and `Handle` are branded numbers. Replace `id.value` and `handle.value` with `id` and `handle`. Handles now compare by numeric identity and work as `Set` keys without allocating objects. `decodeHandle` and `Decode.handle` accept only positive integer numbers. Object-shaped handles are rejected, including inside snapshots; snapshots write numbers.
  - The guides cover fallible lookups, inspector machine reads, `Query.Cells`, shared access objects, simulation-owned time, and seeded random state. `Feature` remains supported and is documented in the package-authoring guide.

### Patch Changes

- Updated dependencies [e2b2275]
  - @typeonce/bevy-ts@0.4.0
