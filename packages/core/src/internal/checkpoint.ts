/**
 * Checkpoint values and what the runtime keeps behind them.
 *
 * A checkpoint is an empty frozen object: what it stands for lives in a
 * module-private map, so it serializes to `{}` and cannot be forged or
 * edited. Only the runtime that took it reads it back.
 */
const internals = new WeakMap<object, unknown>()

/** A new checkpoint value standing for `internal`. */
export const make = (internal: unknown): object => {
  const checkpoint = Object.freeze(Object.create(null) as object)
  internals.set(checkpoint, internal)
  return checkpoint
}

/** What a checkpoint value stands for, or `undefined` when `value` is not one. */
export const internalOf = (value: unknown): unknown =>
  typeof value === "object" && value !== null ? internals.get(value) : undefined

/** Whether `value` is a checkpoint some runtime took. */
export const isCheckpoint = (value: unknown): boolean =>
  typeof value === "object" && value !== null && internals.has(value)
