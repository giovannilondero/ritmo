/**
 * Cell implementations behind query slots, resources, and states.
 *
 * Cells are small prototype-based objects instead of per-call closures so a
 * query can create one set of cells per matched entity and reuse them for as
 * long as the entity keeps matching. Every read goes to live storage, so a
 * reused cell never observes a stale value.
 */
import type { ResultConstructor } from "../Descriptor.ts"
import * as Result from "../Result.ts"
import type { EntityRecord, World } from "./world.ts"
import { ABSENT } from "./world.ts"

/**
 * Validation behavior shared by every writable cell.
 */
abstract class WriteCellBase<T> {
  abstract get(): T
  abstract set(value: T): void

  /** Writes a validated candidate only on success. Backs `setRaw` / `updateRaw`. */
  writeResult<E>(result: Result.Result<T, E>): Result.Result<void, E> {
    if (!result.ok) {
      return Result.failure(result.error)
    }
    this.set(result.value)
    return Result.success(undefined)
  }

  update(f: (current: T) => T): void {
    this.set(f(this.get()))
  }

}

/**
 * Adds raw-validation helpers for values owned by constructed descriptors.
 */
const withConstructor = <T, Raw, Error>(
  cell: WriteCellBase<T>,
  constructor: ResultConstructor<T, Raw, Error>
) => Object.assign(cell, {
  setRaw(raw: Raw): Result.Result<void, Error> {
    return cell.writeResult(constructor.result(raw))
  },
  updateRaw(f: (current: T) => Raw): Result.Result<void, Error> {
    return cell.writeResult(constructor.result(f(cell.get())))
  }
})

/** What the write cell of an entity state component needs: its name, and the shared value of each data-less state. */
export interface EntityStatePlan {
  readonly component: string
  readonly empty: ReadonlyMap<string, { readonly _tag: string }>
}

export const entityStatePlan = (component: string, states: Readonly<Record<string, object>>): EntityStatePlan => ({
  component,
  empty: new Map(
    Object.entries(states)
      .filter(([, fields]) => Object.keys(fields).length === 0)
      .map(([state]) => [state, Object.freeze({ _tag: state })])
  )
})

type EntityStateMismatch = { readonly _tag: "EntityStateMismatch"; readonly component: string; readonly expected: string; readonly actual: string }

// Every successful move returns the same value: a per-entity move in a hot loop allocates no result.
const moved: Result.Result<void, never> = Object.freeze(Result.success(undefined))

/**
 * A required slot is empty only when its match outlived the run that produced
 * it: the entity was despawned, or lost the component. Reading would hand out
 * the internal marker as a value, and writing would put the component back
 * without the insert path, so both fail loudly instead.
 */
const staleMatch = (record: EntityRecord, ordinal: number): Error =>
  new Error(
    `${record.nameAt(ordinal)} was used through a query match after ${record.alive ? "its entity lost it" : "its entity was despawned"}: `
    + "a match is valid during the system run that produced it; keep the entity id or a handle and resolve it again with queries.x.get(id) or queries.x.getHandle(handle)"
  )


/** Kept out of `get` so the hot read stays small enough to inline. */
const staleRead = (record: EntityRecord, ordinal: number): never => {
  throw staleMatch(record, ordinal)
}

class ComponentReadCell {
  // The record's values array, held directly: one load per read instead of
  // two pays for the stale check. Records never replace their array.
  readonly values: Array<unknown>
  readonly ordinal: number
  readonly record: EntityRecord

  constructor(record: EntityRecord, ordinal: number) {
    this.values = record.values
    this.ordinal = ordinal
    this.record = record
  }

  get(): unknown {
    const value = this.values[this.ordinal]
    return value === ABSENT ? staleRead(this.record, this.ordinal) : value
  }
}

class ComponentWriteCell extends WriteCellBase<unknown> {
  readonly values: Array<unknown>
  readonly ordinal: number
  readonly record: EntityRecord
  readonly world: World

  constructor(record: EntityRecord, ordinal: number, world: World) {
    super()
    this.values = record.values
    this.ordinal = ordinal
    this.record = record
    this.world = world
  }

  get(): unknown {
    const value = this.values[this.ordinal]
    return value === ABSENT ? staleRead(this.record, this.ordinal) : value
  }

  set(value: unknown): void {
    if (!this.world.setComponentValue(this.record, this.ordinal, value)) staleRead(this.record, this.ordinal)
  }
}

/**
 * The write cell of an entity state component: `setRaw` for validated resets,
 * and the compare-and-set moves `transition` (enter a state with all of its
 * fields) and `update` (change the current state's fields). Its `update`
 * replaces the unscoped one, and there is no `updateRaw`: either could write
 * any state.
 */
class EntityStateWriteCell {
  readonly values: Array<unknown>
  readonly ordinal: number
  readonly record: EntityRecord
  readonly world: World
  readonly decoder: ResultConstructor<unknown, unknown, unknown>
  readonly plan: EntityStatePlan

  constructor(record: EntityRecord, ordinal: number, world: World, decoder: ResultConstructor<unknown, unknown, unknown>, plan: EntityStatePlan) {
    this.values = record.values
    this.ordinal = ordinal
    this.record = record
    this.world = world
    this.decoder = decoder
    this.plan = plan
  }

  get(): unknown {
    const value = this.values[this.ordinal]
    return value === ABSENT ? staleRead(this.record, this.ordinal) : value
  }

  set(value: unknown): void {
    if (!this.world.setComponentValue(this.record, this.ordinal, value)) staleRead(this.record, this.ordinal)
  }

  setRaw(raw: unknown): Result.Result<void, unknown> {
    const value = this.decoder.result(raw)
    if (!value.ok) return value
    this.set(value.value)
    return moved
  }

  transition(move: { readonly from: string; readonly to: string; readonly data?: object }): Result.Result<void, EntityStateMismatch> {
    const actual = (this.get() as { readonly _tag: string })._tag
    if (actual !== move.from) return this.mismatch(move.from, actual)
    this.set(move.data === undefined ? this.plan.empty.get(move.to) ?? { _tag: move.to } : { _tag: move.to, ...move.data })
    return moved
  }

  update(change: { readonly state: string; readonly data: (current: object) => object }): Result.Result<void, EntityStateMismatch> {
    const current = this.get() as { readonly _tag: string }
    if (current._tag !== change.state) return this.mismatch(change.state, current._tag)
    this.set({ _tag: change.state, ...change.data(current) })
    return moved
  }

  private mismatch(expected: string, actual: string): Result.Result<void, EntityStateMismatch> {
    return Result.failure({ _tag: "EntityStateMismatch", component: this.plan.component, expected, actual })
  }
}

class OptionalComponentCell {
  readonly record: EntityRecord
  readonly ordinal: number

  constructor(record: EntityRecord, ordinal: number) {
    this.record = record
    this.ordinal = ordinal
  }

  get present(): boolean {
    const values = this.record.values
    return this.ordinal < values.length && values[this.ordinal] !== ABSENT
  }

  get(): unknown {
    return this.record.values[this.ordinal]
  }

  value(): unknown {
    const value = this.record.values[this.ordinal]
    return value === ABSENT ? undefined : value
  }
}

class StoreReadCell {
  readonly store: Map<symbol, unknown>
  readonly key: symbol

  constructor(store: Map<symbol, unknown>, key: symbol) {
    this.store = store
    this.key = key
  }

  get(): unknown {
    return this.store.get(this.key)
  }
}

class StoreWriteCell extends WriteCellBase<unknown> {
  readonly store: Map<symbol, unknown>
  readonly key: symbol
  readonly write: (key: symbol, value: unknown) => void

  constructor(store: Map<symbol, unknown>, key: symbol, write: (key: symbol, value: unknown) => void) {
    super()
    this.store = store
    this.key = key
    this.write = write
  }

  get(): unknown {
    return this.store.get(this.key)
  }

  set(value: unknown): void {
    this.write(this.key, value)
  }
}

export const componentRead = (record: EntityRecord, ordinal: number): { get(): unknown } =>
  new ComponentReadCell(record, ordinal)

export const componentWrite = (
  record: EntityRecord,
  ordinal: number,
  world: World,
  constructor: ResultConstructor<unknown, unknown, unknown> | undefined,
  entityState: EntityStatePlan | undefined
): object => {
  if (entityState !== undefined && constructor !== undefined) return new EntityStateWriteCell(record, ordinal, world, constructor, entityState)
  const cell = new ComponentWriteCell(record, ordinal, world)
  return constructor === undefined ? cell : withConstructor(cell, constructor)
}

export const componentOptional = (record: EntityRecord, ordinal: number): { readonly present: boolean; get(): unknown; value(): unknown } =>
  new OptionalComponentCell(record, ordinal)

export const storeRead = (store: Map<symbol, unknown>, key: symbol): { get(): unknown } =>
  new StoreReadCell(store, key)

/**
 * A writable cell over resource or state storage. Writes go through `write`
 * so the runtime can journal them for rollback.
 */
export const storeWrite = (
  store: Map<symbol, unknown>,
  key: symbol,
  write: (key: symbol, value: unknown) => void,
  constructor: ResultConstructor<unknown, unknown, unknown> | undefined
): WriteCellBase<unknown> => {
  const cell = new StoreWriteCell(store, key, write)
  return constructor === undefined ? cell : withConstructor(cell, constructor)
}

/**
 * A read cell over a derived value, used for relation slots.
 */
export const derivedRead = <T>(read: () => T): { get(): T } => ({ get: read })

/**
 * A maybe-present cell over a derived value, used for optional relation slots.
 */
export const derivedOptional = <T>(
  isPresent: () => boolean,
  read: () => T
): { readonly present: boolean; get(): T; value(): T | undefined } => ({
  get present() {
    return isPresent()
  },
  get: read,
  value: () => (isPresent() ? read() : undefined)
})
