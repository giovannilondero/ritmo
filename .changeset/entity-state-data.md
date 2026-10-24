---
"@typeonce/ritmo": minor
---

**Each state of a `Descriptor.EntityState` carries its own fields, so a value can never pair a state with data from another one.**

- **Breaking: `Descriptor.EntityState(name, states, options?)` takes a record of states**, each `{}` (no data) or one schema for all of its data. The value is a tagged union: `_tag` names the state, next to that state's fields. Snapshots and `setRaw` decode each state's data with its schema, and `_tag` is the only field Ritmo adds. The `transitions` graph is unchanged. Number states are gone: state names are the record's keys.

  ```diff
  -const Phase = Descriptor.EntityState("Game/Phase", ["ready", "windup"] as const, { transitions: { ready: ["windup"], windup: ["ready"] } })
  +const Phase = Descriptor.EntityState("Game/Phase", { ready: {}, windup: z.object({ frames: z.int() }) }, { transitions: { ready: ["windup"], windup: ["ready"] } })
  -Game.Command.spawn([Phase, "ready"])
  +Game.Command.spawn([Phase, { _tag: "ready" }])
  -if (data.phase.get() === "windup")
  +if (data.phase.get()._tag === "windup")
  ```

  A closed set of values with no moves between them (a team, a direction) is not an entity state: declare it with `Descriptor.ConstructedComponent(z.literal(["Down", "Up"]))("Game/Facing")`, with your schema library's literal schema.

- **Breaking: the write cell moves with `transition({ from, to, data })`**, which takes all of `to`'s fields, so nothing carries over from `from`. A state without fields takes no `data`. With a union `from`, `to` must be a move every one of them allows.

  ```diff
  -data.phase.transition("ready", "windup")
  +data.phase.transition({ from: "ready", to: "windup", data: { frames: 12 } })
  ```

- **`update({ state, data })`** changes the fields of the current state without leaving it: `data` maps the current value to the new fields, and a field the state does not have does not compile, spread or not. Like `transition`, it writes only while the entity is in `state`, and otherwise returns `EntityStateMismatch`. **Breaking:** it replaces the cell's `update(f)` and `updateRaw(f)`, which could write any state; `set(value)` and `setRaw(raw)` stay for resets. `EntityStateMismatchError`'s `expected` and `actual` are now state names.

- **`Descriptor.EntityStateOf<typeof Contact, "air">`** is the value of one state (or, without the state, of the component), for game functions that take or return it. `EntityStateValue` is removed.
