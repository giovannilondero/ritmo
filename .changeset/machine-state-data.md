---
"@typeonce/ritmo": minor
---

**Each state of a `Game.StateMachine` carries its own fields, so a game-wide mode and the data only it has are one value: a dialogue with its pages, a game over with its winner.**

- **Breaking: `Game.StateMachine(name, states, options?)` takes a record of states**, each listing its fields as `Decode` codecs (`{}` for a state without data), the same way `Descriptor.EntityState` declares states. The value is a tagged union: `_tag` names the state, next to that state's fields. The array form and number states are gone.

  ```diff
  -const Flow = Game.StateMachine("Game/Flow", ["Menu", "Playing", "GameOver"])
  +const Flow = Game.StateMachine("Game/Flow", { Menu: {}, Playing: {}, GameOver: { winner: Decode.string } })
  -Game.Runtime.machine(Flow, "Menu")
  +Game.Runtime.machine(Flow, { _tag: "Menu" })
  -nextMachines.flow.set("GameOver")
  +nextMachines.flow.set({ _tag: "GameOver", winner: "Red" })
  -if (machines.flow.get() === "Playing")
  +if (machines.flow.is("Playing"))   // or machines.flow.get()._tag === "Playing"
  ```

  A machine kept next to a resource that must agree with it (`Mode` plus a `Dialogue` that is `null` while not talking) becomes one machine whose state holds the resource's data.

- **Breaking: a queued move takes the target's full value.** `nextMachines.x.set(value)` and `setIfChanged(value)` take the state with all of its fields, and nothing carries over from the current state; the state and its fields commit together at `applyStateTransitions(...)`. `getPending()` returns the full value. `setIfChanged` skips only a value equal to the current one; the same state with other fields re-enters, like `set`.

- **`Game.System.updateMachine(M)`**, declared in `machines`, reads the machine and changes the fields of its current state at once: `machines.x.update({ state, data })`, a compare-and-set like the entity-state `update` that returns `MachineStateMismatch` (and, for a sub-state without a value, `SubStateInactive`) instead of writing. A field the state does not have does not compile, spread or not. It never changes the state, runs no enter or exit schedules, and publishes no transition event; it is rolled back with a failed system or exit phase. The state name changes only at the commit; the current state's fields change immediately. Inspectors and `Condition.check` keep only `Game.System.machine(M)`, and a system declares one slot per machine.

  ```ts
  machines: { mode: Game.System.updateMachine(Mode) }
  machines.mode.update({ state: "Talking", data: (talking) => ({ ...talking, typed: talking.typed + 1 }) })
  ```

- **`Machine.StateOf<typeof Mode, "Talking">`** is the value of one state (or, without the state, of the machine), like `Descriptor.EntityStateOf`. Both build on the shared `Descriptor.StateFields`, `StateDefinitions`, `StateName`, and `StateValueOf`, which replace the `EntityState*` names of the same types.

- **Unchanged, by state name:** `machines.x.is(state)`, `Game.Condition.inState(M, state)`, `stateChanged`, `onEnter` / `onExit` / `onTransition`, `despawnOnEnter` / `despawnOnExit`, and sub-states' `within: [Parent, state]`. Transition snapshots and events keep `from` and `to` as state names; read the entered state's fields with `machines.x.get()` (in `onExit`, it is still the state being left).

- **Breaking: snapshots are format version 3.** A machine is saved as its tagged value and restored through its state codecs; `InvalidMachineState` carries the `DecodeError` (its `path` says which field), and `InactiveSubState.requires` is a state name. A version 2 save is rejected with `UnsupportedVersion`.

- **Breaking, debug output:** `Debug.MachineDescription.current`, `MachineDump`, `NextStateWrite.value`, and `NextStateReplacement` values are machine values (`Machine.AnyValue`), and `TransitionEvent.from` / `to` are state names. `SystemEvent.machines` lists each `update` as a `Debug.MachineWrite`, and `SystemDescription.machines.updates` lists the machines a system updates.
