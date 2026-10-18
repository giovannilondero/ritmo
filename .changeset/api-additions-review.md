---
"@typeonce/ritmo": minor
"@typeonce/ritmo-devtools": patch
---

**API additions from a second review.**

- **Writes take what reads return.** `set`, `update`, `emit`, `runtime.send`, `Command.entry`, and plain `[Descriptor, value]` entries accept `ReadonlyValue<T>`, so a value read from one cell (deeply readonly) can be written to another without a copy or a cast.
- **`Clock.durationOfSteps(step, n)`** builds a duration from a whole number of steps, instead of a round trip through seconds and `durationRaw`. A literal zero, negative, or fractional count does not compile; a computed one throws.
- **`Game.Entity.id(handle)`** returns the entity id a handle names, so games no longer store the id beside the handle.
- **Save migrations.** `Game.Runtime.make({ saves: Snapshot.migrations(Snapshot.migration(1, ...), Snapshot.migration(2, ...)) })`: snapshots carry a `gameVersion` (the last step; 0 without migrations and for older saves), and `restore` runs every step after the save's version in order, checking the structure after each, before validating as usual. A save newer than the last step fails with `NewerGameVersion`. Steps must be numbered 1, 2, 3, ... in order (checked at compile time and at runtime).
- **Docs** now state that a system does not see its own writes as changes (it does see its own events), how long `Condition.stateChanged` holds, that a sub-state value set at the marker its parent leaves is dropped, and that `restore` keeps a current resource the save lacks.
