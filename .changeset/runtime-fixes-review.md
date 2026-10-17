---
"@typeonce/ritmo": patch
"@typeonce/ritmo-math": patch
"@typeonce/ritmo-devtools": patch
---

**Runtime fixes from a review of 0.8.0.** No API changes; each fix restores what the docs already promised.

- **Sub-states enter with their parent.** A sub-state now gets its entry value at the parent's commit, before any `onEnter` schedule runs. A failing `onEnter` of the parent no longer leaves it without a value (`inState` false and `set` failing with `SubStateInactive` until the parent came back), and its `despawnOnEnter` scopes no longer despawn what the parent's `onEnter` just spawned. The `onEnter` schedules still run parents first.
- **A queued transition survives a transition schedule setting the same machine.** A value queued before `applyStateTransitions(...)` is committed there even when an `onEnter` / `onExit` of an earlier machine also calls `set` on it; that newer value waits for the next marker.
- **`snapshot` and `restore` throw while a schedule is running**, like `send`. A restore from a system let its queued spawns overwrite restored entities, and a snapshot captured writes a failing system then rolled back. `tryTick` now sets the same guard, so `send` inside `tryTick` throws too.
- **`restore` rejects an unknown scope name** with the new `UnknownScope` error, instead of putting entities in a scope nothing can name.
- **`describe()` counts reads inside `Query.anyOf`**, so `component-never-read` no longer fires for a component read only through `anyOf`, and `read-before-write` sees it. A system placed directly and under `Schedule.when` / `pauseWhen` is one entry with both placements and the conditions of each.
- **`Collide2` stops a circle that starts exactly touching a wall** and moves into it, instead of moving it through the wall: `sweepCircleBox` / `sweepCircleBoxes` now report a hit at time 0, and `moveCircle` blocks. This happens whenever a game places a body exactly at a wall without a skin (a snapped spawn point, or a projectile set to a sweep's contact point). Moving away from the wall or sliding along it is unchanged. A game that fingerprints its simulation will see fights that touched a wall this way play differently: re-record the fingerprints with the upgrade.
- **Replays carry input into their window.** A replay saved after unchanged input (holding a direction longer than `keep`) had no input on its first ticks and handed systems `undefined` when played.
- **`Session.run` stops with `invariant-threw`** when an invariant throws, naming the invariant and the error, instead of throwing out of `run` and losing the run's text.
- The `Snapshot` docs now say that unread `runtime.send` events survive a restore, as they always did.
