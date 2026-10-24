# State, saves, and upgrades

1. Give every new mutable value one home:
   - saved world state: a component or resource. It is saved by `runtime.snapshot()`, restored by `runtime.restore(...)`, and rolled back when a system fails.
   - unsaved runtime state: a transient component or resource, or the system's `local`. It is rebuilt after restore. A transient value is rewound by `runtime.rewind(...)`; `local` is not, so a schedule that is rewound keeps none (see [`netcode.md`](netcode.md)).
   - host state: a service or host code.
   - A value with a mode (`phase: "waves" | "boss" | "dead"`), or fields used by only one kind (`room` for one call kind, `pings` for another), is not a flat record: a game-wide mode is a `Game.StateMachine` and a per-entity one is a `Descriptor.EntityState`, each state holding only its own fields.
2. Decide what the value does on new game, restore, and dispose, and test it: take a snapshot, restore it, and assert the value.
3. Give every saved value a schema (see the skill's "Validating and saving values"). Saved forms are plain data: a value that is not (a `Map`, an `Option`, a class) uses a schema with an `encode` back to plain data. Test the round trip: `runtime.snapshot()`, `JSON.stringify`, `JSON.parse`, `runtime.restore(...)`.
4. When the saved shape changes, add a step to `Snapshot.migrations(...)` so older saves still load.
5. To upgrade Ritmo, read each package's `CHANGELOG.md` from the installed version up, apply each breaking entry's fix, and fix the remaining compile errors as their messages say.

**Done when** a snapshot taken before the change restores after it and the game's check passes.
