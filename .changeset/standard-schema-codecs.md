---
"@typeonce/ritmo": minor
---

**Values are validated and saved through the game's own Standard Schemas. Ritmo ships no validators.** Any [Standard Schema](https://standardschema.dev) works (Zod, Valibot, ArkType, Effect through `Schema.toStandardSchemaV1`); a value that changes shape when saved takes a schema with an `encode` back to its saved form, `Descriptor.Codec<Type, Encoded>`.

- **Breaking: `Decode` is removed.** Use the game's schema library. With Zod: `Decode.struct({ x: Decode.number })` becomes `z.object({ x: z.number() })`. With Effect, write the `codec` helper from the skill's `playbooks/effect.md` once and pass every schema through it: `codec(Schema.Struct({ x: Schema.Finite }))`.

  ```diff
  -const Position = Descriptor.ConstructedComponent(Decode.struct({ x: Decode.number, y: Decode.number }))("Game/Position")
  +const Position = Descriptor.ConstructedComponent(z.object({ x: z.number(), y: z.number() }))("Game/Position")
  ```

- **Breaking: `ConstructedComponent` and `ConstructedResource` take a schema**, not a `{ result }` constructor. `Descriptor.fromStandardSchema` is gone: pass the schema itself. Raw input (`setRaw`, `updateRaw`, `Game.Command.entryRaw`, raw values given to `Game.Runtime.make`) is in the schema's saved form. A schema whose value is not its saved form (a `Map`, an `Option`, a class) or whose saved form is not plain data does not compile, and the error says to give it an `encode`. Validation is synchronous: a schema that answers with a promise fails. Failures are `{ _tag: "SchemaIssues", issues }`, the library's own issues with their paths.

- **Breaking: each state of `Descriptor.EntityState` and `Game.StateMachine` is `{}` or one object schema for all of its data**, instead of a record of field codecs. Ritmo adds only `_tag`. `set`, `update`, `get`, and `is` are unchanged.

  ```diff
  -Game.StateMachine("Game/Flow", { Menu: {}, GameOver: { winner: Decode.string } })
  +Game.StateMachine("Game/Flow", { Menu: {}, GameOver: z.object({ winner: z.string() }) })
  ```

- **Breaking: `runtime.snapshot()` returns `Result<WorldSnapshot, SnapshotError>`.** It runs each schema's `encode`, and fails with `UnencodableComponent`, `UnencodableResource`, or `UnencodableMachineState` when one rejects a value. `restore` decodes with the same schemas. A descriptor without a schema makes `snapshot` uncallable, with `"<Name> needs a schema"`. The format stays at version 3. Fix: `const saved = runtime.snapshot(); if (saved.ok) store(saved.value)`.

- **Breaking: `Entity.decodeHandle` and `InvalidHandle` are replaced by the guard `Entity.isHandle(Root, Intent?)`**, `(raw: unknown) => raw is Handle<Root, Intent>`. Build a handle schema from it with the library: `Schema.declare(Entity.isHandle(Root, Health))`, `z.custom(Entity.isHandle(Root, Health))`.

- **Breaking: `Brand.refine`, `Brand.all`, and `Brand.Constructor` are removed;** `Brand.Brand` and `Brand.Branded` stay. Brand values through the schema library (`z.number().brand(...)`, `Schema.brand(...)`).

- **Breaking: `Clock.InvalidTime` is removed.** A time saved at another rate fails restore with `SchemaIssues` whose message names both rates.
