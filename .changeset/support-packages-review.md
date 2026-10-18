---
"@typeonce/ritmo-math": minor
"@typeonce/ritmo-browser": patch
---

**Support package fixes from a second review.**

- **Random state in a resource.** `Random` is now a validator for its own state (`Descriptor.ConstructedResource(Random)("Game/Rng")`, saved and checked like any constructed resource), `Random.seed(n)` is its starting value, and `Random.draw(resources.rng)` gives a generator over the system's write cell that writes every draw back, so a system no longer stores the state by hand and a failed run rolls its draws back. `Random.make(state)` stays for state kept outside the world.
- **Preconditions are checked.** `Random.integer` throws unless both bounds are whole with `min < maxExclusive` (it drew outside both bounds), and `Random.range` throws when `min > max` or a bound is not finite (equal bounds still return `min`). `SpatialGrid.insert` / `forEachIn` throw on non-finite numbers (an infinite box never returned), and a box covering more cells than are occupied scans the occupied cells. `Random.weighted` calls `weight` once per item.
- **Input edges.** `Touch`: a `pointerdown` for a pointer id still held (its up was lost) cancels what that id held first, instead of leaving a button held until blur. `Keyboard.scripted`: pressing an action that is already held is not a new press, as with a live keyboard.
