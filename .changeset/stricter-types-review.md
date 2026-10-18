---
"@typeonce/ritmo": minor
---

**Stricter types from a review of 0.8.0.** Each change rejects code that was always wrong; see [MIGRATION.md](https://github.com/typeonce-dev/ritmo/blob/main/MIGRATION.md#upgrading-to-090).

- **A command target chosen from several queries is checked for every one of them.** `commands.despawn(cond ? a.entity : b.entity)`, `insert`, and `remove` compiled when either target was allowed, and a raw id joined with a match (`cond ? match.entity : match.entity.id`) passed as a match. `EntityRef` / `EntityMut` proof parameters are now contravariant (proving nothing is `never`), so a union of refs keeps only what all of them prove.
- **Drafts and inserts check components they may hold.** A conditional or spread entry holding a component with requirements now needs those requirements surely present, in `commands.spawn` and `commands.insert`. Fixed entries before or after a spread count as held.
- **Spawning a draft that stages relations needs `relates`.** `Game.Command.relate(draft, ChildOf, parent)` now requires `Game.System.relates(ChildOf)` on the spawning system, like `commands.relate`. `EntityDraft` gains a fourth type parameter, the relations it stages.
- **`thisTick` counts components named inside `Query.anyOf`** at compile time, as `tryTick` already did.
- **`Runtime.make` rejects an unknown resource key** next to known ones, naming it.
- **A query that can never match is rejected:** a component in `without` that a read or write slot, `with`, or a plain `added` / `changed` filter requires.
- **A plain `added` / `changed` filter proves its component** (`Query.Proven`, `ProvesComponent`): its matches hold it, so `despawn`, `insert`, and `getHandle` accept them. A `Query.anyOf` member proves nothing alone.
- **A transition schedule requires its machine**: `applyStateTransitions(transitions(onEnter(M, ...)))` on a runtime without `M` fails with `Missing machine`, and `tryTick` reports it.
- **A descriptor in the registry of another kind is rejected** (`components: { Score }` with a resource), naming where it belongs, at compile time and when an erased fragment is built.
