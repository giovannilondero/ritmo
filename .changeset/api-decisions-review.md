---
"@typeonce/ritmo": minor
"@typeonce/ritmo-math": patch
---

**One shape for `Runtime.make`, and runtime guards from a review of 0.8.0.** See [MIGRATION.md](https://github.com/typeonce-dev/ritmo/blob/main/MIGRATION.md#upgrading-to-090).

- **Breaking: `Runtime.make` always returns a `Result`.** It returned the bare runtime or a `Result` depending on the resource values present at runtime, while its type decided from the keys of the provided type, so resources typed `{ Score?: ... }` produced a bare runtime the type called a `Result`. The type is now `Success<Runtime>` when nothing provided can fail (read `.value`), and a `Result` to check when a constructed resource may be provided.
- **`thisTick` checks a writer that shares its reader's display name.** Systems may share a display name; the static check skipped any writer named like the reader. It now tells the reader apart by its system type.
- **New lint `next-state-replaced`** (warning, debug runtimes): a next state one system queued and another replaced with a different value before the same `applyStateTransitions(...)`, naming both. Observed lints (this one and `requirement-violated`) no longer need `nameSchedules` to appear. `Debug.NextStateReplacement` describes an entry.
- **A query match used after its run throws a named error.** Reading through a match kept past its run (in `local`) returned the internal absent marker once the entity was despawned, and writing put a removed component back without the insert path.
- **A query descriptor that behaves unlike the registered one throws**: a look-alike (same kind and name) that adds or drops entity-state transitions, a constructor, immutability, or transience. Look-alikes that behave the same keep working.
- `Scalar.Finite` and the `Vector2` / `Scalar` arithmetic helpers document that results keep the brand without re-validating, finite while they stay within `±Number.MAX_VALUE`.
