---
"@typeonce/ritmo": minor
---

**Component values are stored per component, in pages of entity ids**, and a system's run keeps the old values of only the slots it writes. This is the storage layout unboxed numbers build on. Performance is about the same as before; queries, cells and snapshots keep their API.

- **Breaking: `changed` means the value differs.** A write counts as a change only when the new value differs from the one before the system's run: a different number or string (`NaN` equals `NaN`), or a different object. Writing back the value you read, or an equal number, no longer counts. Inserting a component still counts as added and changed. The devtools journal records only these writes.

  ```diff
  -// re-set every frame to mark it changed
  -data.position.set(data.position.get())
  +// write a new value when it moves; keep writing back the same one when it does not
  +data.position.set({ x: position.x + velocity.x, y: position.y + velocity.y })
  ```

- **Breaking: a query match is valid during the run that produced it.** Its cells throw when used later. This covers a match kept in `local` state, captured in a closure, or returned from an inspector: before, such a match kept reading the entity's current values, even after it left the query. Keep the id or a handle, and resolve it again.

  ```diff
  -local.target ??= queries.enemies.each()[0]
  -const at = local.target?.data.position.get()
  +local.target ??= queries.enemies.each()[0]?.entity.id
  +const found = local.target === undefined ? undefined : queries.enemies.get(local.target)
  +const at = found?.ok ? found.value.data.position.get() : undefined
  ```

- **Breaking: `runtime.inspect(...)` throws while a schedule is running**, like `snapshot` and `restore`. Read the world from a system, or inspect between ticks.
