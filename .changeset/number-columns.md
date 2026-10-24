---
"@typeonce/ritmo": minor
"@typeonce/ritmo-math": patch
---

**Number components are stored unboxed, in number columns.** A component whose value is a number (a plain or branded number such as `Scalar.Finite`, a number literal union, an entity id) keeps its values in a typed array. Reading one returns the number and writing one copies it in: nothing is allocated, and change detection and rollback compare plain numbers. On the community ECS benchmark cases, iteration with number writes is about 1.4× faster than before.

- **Breaking: a number component declares `{ columns: "number" }`.** The runtime cannot see a value's type, so the component says how it is stored. Without the option, the name argument does not compile, and the error names the fix (`… holds a number: add { columns: "number" } …`). The option is rejected on any other value, and the descriptor's type does not change. It works with `Component`, `ConstructedComponent` and `TransientComponent`, and next to `immutable: true`.

  ```diff
  -const Health = Descriptor.Component<number>()("Game/Health")
  +const Health = Descriptor.Component<number>()("Game/Health", { columns: "number" })
  -const Speed = Descriptor.ConstructedComponent(Scalar.Positive.codec)("Game/Speed")
  +const Speed = Descriptor.ConstructedComponent(Scalar.Positive.codec)("Game/Speed", { columns: "number" })
  ```

  Queries, cells (`get`, `set`, `update`, `setRaw`, `updateRaw`, optional `value()`), commands and snapshots keep their API. A value that reaches a number column through erased types and is not a number throws, naming the component.
