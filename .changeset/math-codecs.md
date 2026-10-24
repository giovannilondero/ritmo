---
"@typeonce/ritmo-math": minor
---

**Each validated type has one `codec`, a Standard Schema, and a guard `is` that takes `unknown`.** `Vector2.codec`, `Size2.codec`, `Aabb.codec`, `Random.codec`, and `Scalar.Finite.codec` / `NonNegative.codec` / `Positive.codec` go straight into `Descriptor.ConstructedComponent(...)` or `ConstructedResource(...)`; inside a game's own schema, build the field from `is` (`Schema.declare(Vector2.is)`, `z.custom(Vector2.is)`).

- **Breaking: `Vector2.decode`, `Size2.decode`, `Aabb.decode`, `Random.decode`, and their `DecodeError` are removed.** `Descriptor.ConstructedComponent(Vector2)` becomes `Descriptor.ConstructedComponent(Vector2.codec)`; to check a value, use `Vector2.is(raw)` or `Vector2.result(raw)`, which stay.
