---
"@typeonce/ritmo": minor
---

**One way to do each thing, and docs that match the code.** See [MIGRATION.md](https://github.com/typeonce-dev/ritmo/blob/main/MIGRATION.md#upgrading-to-090).

- **Removed** `Relation.Hierarchy` / `Relation.Relation` (use `Descriptor.Hierarchy` / `Descriptor.Relation`), `Schema.empty()` (use `Schema.fragment({})`), and `Debug.MemberFor` (described the removed `debug: true`). `Relation.PairBrand` is now exported as a type.
- **Command permissions need at least one entry**: `Game.System.spawns()` with nothing no longer compiles (it made `commands.spawn` say spawn is not declared).
- **Redundant resource and event slots are rejected**: a `readResource` next to another slot of the same resource, or one resource or event twice in the same mode. A `changedResource` next to a `writeResource`, and reading the events a system emits, stay allowed.
- **`value()` on optional query cells** returns the value, or `undefined` when the entity does not hold the component.
- JSDoc now matches the code: `Game.Command.spawn` and `entryRaw` name `extend`, `Schedule.when` says bundle transition schedules are not gated, `Clock.every` is false on step 0, and `EntityStateWriteCell.transition` says when to use `set` instead.
