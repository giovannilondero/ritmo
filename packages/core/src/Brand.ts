/**
 * Brand types for validated values.
 *
 * Brands let the library distinguish validated carried values from raw user
 * input without changing their runtime representation. `@typeonce/ritmo-math`
 * brands its types with them (`Vector2`, `Size2`, `Scalar`, `Aabb`), so
 * validated values move through the ECS without losing the fact that they
 * were checked once already.
 *
 * This module holds types only. Game code does not brand values by hand: it
 * brands through its schema library (`Schema.brand`, `z.brand`) and
 * validates through descriptors, which own their schema
 * (`Descriptor.ConstructedComponent(schema)`); raw input goes through it with
 * `Game.Command.entryRaw(...)` or `setRaw(...)`.
 *
 * @module Brand
 * @docGroup helpers
 *
 * @categoryDescription Brand Types
 * The nominal markers and constructor contracts used by branded public values.
 */
import type * as internal from "./internal/brand.ts"

/**
 * Public marker used to distinguish one validated domain from another.
 *
 * @category Brand Types
 */
export type Brand<Key> = internal.PublicBrand<Key>
/**
 * One value tagged with a stable public {@link Brand}.
 *
 * @category Brand Types
 */
export type Branded<Value, Key> = internal.Branded<Value, Key>

/**
 * Minimal constructor contract shared by branded helper modules.
 *
 * The constructor boundary is the only place raw input is accepted. After one
 * value has been validated, downstream helpers operate on the branded carried
 * type instead of revalidating plain structural data.
 *
 * @category Brand Types
 */
export interface Constructor<Value, Raw, Error> {
  /**
   * Validates one raw value and returns an explicit success/failure result.
   */
  readonly result: (raw: Raw) => import("./Result.ts").Result<Value, Error>
  /**
   * Validates one raw value and returns `null` on failure.
   *
   * This is useful at internal boundaries where only presence matters and no
   * structured error is needed.
   */
  readonly option: (raw: Raw) => Value | null
  /**
   * Checks whether one raw value already satisfies the branded invariants.
   */
  readonly is: (raw: Raw) => raw is Raw & Value
}
