/**
 * World storage behind the runtime.
 *
 * Layout:
 *
 * - every component ordinal has a store: its values in pages of
 *   `PAGE_SIZE` entities indexed by entity id (`ABSENT` marks an entity
 *   without it), next to the tick each value was added and last changed at.
 *   A page exists while one of its entities holds the component
 * - every live entity is one `EntityRecord`: its id, the ordinals it holds,
 *   and its cached query matches
 * - every component ordinal keeps the set of records that currently have it,
 *   so a query only visits entities that carry its rarest required component
 * - every component ordinal and relation keeps a membership version, bumped on
 *   structural change, so queries know when their cached match set is stale
 * - `added`/`changed` filters compare a value's ticks with the tick of the
 *   reading system's previous run
 *
 * A system run is a transaction. The first write to a slot keeps its old
 * value on the page (`saved`, `before`); commit compares each such slot with
 * its old value and stamps the changed tick of every value that differs (so
 * writing an equal value is not a change); rollback puts the old values back.
 * Ticks move only at commit, so a running system never sees its own writes as
 * changes.
 *
 * Ordinals are assigned per world from the schema, in schema order. Component
 * identity is the descriptor key, which is derived from `(kind, name)`; a bound
 * schema guarantees those names are unique.
 */
import type { Descriptor } from "../Descriptor.ts"
import * as Entity from "../Entity.ts"
import * as Relation from "../Relation.ts"
import * as Result from "../Result.ts"
import type { Schema } from "../Schema.ts"

/**
 * Marks a component slot that the entity does not currently have.
 */
export const ABSENT: unique symbol = Symbol("ritmo/absent")

/** Entities per page: an entity's page is `id >>> PAGE_BITS`, its slot `id & PAGE_MASK`. */
export const PAGE_BITS = 8
export const PAGE_SIZE = 1 << PAGE_BITS
export const PAGE_MASK = PAGE_SIZE - 1

/**
 * `PAGE_SIZE` consecutive entity ids of one component's store. A page object
 * is never replaced, so cells hold it directly; while none of its entities
 * holds the component, its arrays are the shared empty ones (every slot
 * `ABSENT`), which nothing writes to.
 */
export interface Page {
  readonly ordinal: number
  /** The id of the page's first slot. */
  readonly base: number
  values: Array<unknown>
  added: Float64Array
  changed: Float64Array
  /** Entities on the page that hold the component. */
  count: number
  /**
   * The transaction that last wrote to the page. While it runs, `saved` has
   * a bit for every slot it wrote, and `before` holds those slots' values
   * from before it (other slots of `before` are `undefined`).
   */
  savedIn: number
  readonly saved: Uint32Array
  before: Array<unknown> | undefined
  /** The phase that copied the page, and its values and changed ticks then. */
  phaseIn: number
  phaseValues: Array<unknown> | undefined
  phaseChanged: Float64Array | undefined
}

/** Whether a system transaction is running, and which one. */
export interface TransactionState {
  id: number
  active: boolean
}

/** One component's pages, by page index. */
export interface Store {
  readonly pages: Array<Page | undefined>
}

/** A packed array (not holey, which V8 reads more slowly) of `PAGE_SIZE` copies of `value`. */
const filled = (value: unknown): Array<unknown> => {
  const array: Array<unknown> = []
  for (let slot = 0; slot < PAGE_SIZE; slot++) array.push(value)
  return array
}

const emptyValues: Array<unknown> = filled(ABSENT)
const emptyTicks = new Float64Array(PAGE_SIZE)

export interface EntityRecord {
  readonly id: number
  /**
   * The public id value handed out for this entity, created once.
   */
  readonly entityId: Entity.EntityId<any, any>
  /**
   * Ordinals of the components the entity holds, ascending.
   */
  readonly held: Array<number>
  /**
   * The same set as bits (ordinal `n` is bit `n & 31` of word `n >>> 5`), so
   * a query's structure check is one load per component. Missing words read
   * as `undefined`, which `&` turns into 0.
   */
  readonly heldBits: Array<number>
  /**
   * Cached query matches by query ordinal, reused while the entity matches.
   */
  readonly matches: Array<unknown>
  /** The name of the component at an ordinal, for error messages (shared by the world's records). */
  readonly nameAt: (ordinal: number) => string
  alive: boolean
}

/** Inserts `ordinal` into an ascending list (an entity's held components, a handful). */
const insertSorted = (list: Array<number>, ordinal: number): void => {
  let index = list.length
  while (index > 0 && list[index - 1]! > ordinal) index--
  list.splice(index, 0, ordinal)
}

/** Whether a write replaced a value with a different one; `NaN` equals itself. */
const differs = (before: unknown, after: unknown): boolean =>
  before !== after && (before === before || after === after)

/**
 * An append-only list of entity ids with the change tick each entry was
 * recorded at. Ticks are non-decreasing, so readers binary-search their start.
 */
interface TickLog {
  readonly ids: Array<number>
  readonly ticks: Array<number>
  /** Newest tick of any dropped entry. */
  droppedThrough: number
}

const makeLog = (): TickLog => ({ ids: [], ticks: [], droppedThrough: 0 })

const appendLog = (log: TickLog, id: number, tick: number): void => {
  log.ids.push(id)
  log.ticks.push(tick)
}

/**
 * Index of the first entry recorded after `since`.
 */
const firstAfter = (log: TickLog, since: number): number => {
  let low = 0
  let high = log.ticks.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (log.ticks[middle]! > since) high = middle
    else low = middle + 1
  }
  return low
}

const dropFront = (log: TickLog, count: number): void => {
  if (count > 0) {
    log.droppedThrough = Math.max(log.droppedThrough, log.ticks[count - 1]!)
    log.ids.splice(0, count)
    log.ticks.splice(0, count)
  }
}

/**
 * Drops entries recorded at or before `boundary`.
 */
const trimLog = (log: TickLog, boundary: number): void => {
  dropFront(log, firstAfter(log, boundary))
}

/**
 * A registered lifecycle reader's position: the tick of its previous
 * completed run, the same cursor its `added`/`changed` filters use.
 */
export interface LifecycleCursor {
  readonly lastRun: number
}

/**
 * Drops entries at or before `windowBoundary` that every registered reader
 * has read, then drops the oldest entries past `capacity`.
 */
const trimHeldLog = (
  log: TickLog,
  windowBoundary: number,
  readers: ReadonlySet<LifecycleCursor> | undefined,
  capacity: number
): void => {
  let boundary = windowBoundary
  if (readers !== undefined) {
    for (const reader of readers) boundary = Math.min(boundary, reader.lastRun)
  }
  trimLog(log, boundary)
  if (log.ids.length > capacity) dropFront(log, log.ids.length - capacity)
}

type ComponentDescriptor = Descriptor<"component", string, any>

const noSources: ReadonlyArray<number> = Object.freeze([])

export type World = ReturnType<typeof makeWorld>

/**
 * Structural-change callbacks used by the debug tracer. Installed only while
 * a trace listener is registered; component writes made through system
 * transactions are reported from the journal instead.
 */
export interface WorldHooks {
  spawned(id: number, components: Readonly<Record<string, unknown>>): void
  despawned(id: number): void
  inserted(id: number, ordinal: number, value: unknown): void
  overwritten(id: number, ordinal: number, before: unknown, after: unknown): void
  removed(id: number, ordinal: number): void
  related(sourceId: number, relation: Relation.Relation.Any, targetId: number): void
  unrelated(sourceId: number, relation: Relation.Relation.Any): void
}

/**
 * `lifecycleCapacity` caps each removed/despawned log, like
 * `Runtime.streamCapacity` caps event streams.
 */
export const makeWorld = <S extends Schema.Any>(schema: S, lifecycleCapacity: number) => {
  let nextEntity = 1
  const records = new Map<number, EntityRecord>()

  const ordinals = new Map<symbol, number>()
  const descriptors: Array<ComponentDescriptor> = []
  const members: Array<Set<EntityRecord>> = []
  const stores: Array<Store> = []
  const componentVersions: Array<number> = []
  /**
   * Bumped on every spawn and despawn, for queries without required components.
   */
  let entitiesVersion = 0

  const relationTargets = new Map<symbol, Map<number, number>>()
  const relatedSources = new Map<symbol, Map<number, Array<number>>>()
  const relationVersions = new Map<symbol, number>()
  const relationDefinitions = Object.values(schema.relations) as ReadonlyArray<Relation.Relation.Any>

  /**
   * The world change tick. It advances for every system run and every command
   * flush; all writes in that span are stamped with it.
   */
  let tick = 0
  /**
   * Logs of changed components per ordinal. They back sparse `changed`
   * iteration and keep entries from the current and previous frame only (see
   * `advanceFrame`); older changes are found by scanning slot ticks instead.
   * `retainedAfter` is the tick up to which entries may already have been
   * dropped.
   */
  const changedLogs: Array<TickLog | undefined> = []
  /**
   * Per ordinal, the records whose membership changed, with the component
   * version after the change. Queries replay it to update their cached match
   * set incrementally. `membershipFrom[ordinal]` is the version after which
   * the log is complete.
   */
  const membershipRecords: Array<Array<EntityRecord>> = []
  const membershipVersions: Array<Array<number>> = []
  const membershipFrom: Array<number> = []
  const frameVersions: Array<number> = []
  /**
   * Per ordinal, the tick from which the changed log is complete, or
   * `undefined` while no query filters on the component (writes then skip the
   * log entirely).
   */
  const changedLogFrom: Array<number | undefined> = []
  /**
   * Logs of removed components per ordinal, and of despawned entities. They
   * back removed/despawned reads, which have no slot to scan, so an entry is
   * kept for the current and previous frame and beyond that until every
   * registered reader has read it (up to `lifecycleCapacity` entries per log).
   * Schedules ticked at a lower rate than the ones that despawn (rendering
   * after several fixed updates) therefore see every removal.
   */
  const removedLogs: Array<TickLog | undefined> = []
  const despawnedLog = makeLog()
  const removedReaders: Array<Set<LifecycleCursor> | undefined> = []
  const despawnedReaders = new Set<LifecycleCursor>()
  let retainedAfter = 0
  let frameStart = 0

  /**
   * The running system transaction, and the pages it wrote to.
   */
  let transaction = 0
  let inTransaction = false
  // Reused, with an explicit count: resetting an array's `length` is a runtime call.
  const savedPages: Array<Page> = []
  let savedCount = 0
  /**
   * Whether a run is going on (a system body, an inspector read, or a
   * condition check), and the hand-outs of the queries it used: their
   * matches are valid until it ends.
   */
  let inRun = false
  // Reused, with an explicit count: resetting an array's `length` is a runtime call.
  const handedOut: Array<{ live: boolean }> = []
  let handedOutCount = 0
  /** The running transaction, shared with write cells so their hot path stays inline. */
  const transactionState: TransactionState = { id: 0, active: false }
  /**
   * A phase: several system transactions undone together (a transition's
   * exit schedules). Each page a committed transaction wrote keeps its values
   * and changed ticks from before the phase.
   */
  let phase = 0
  let inPhase = false
  const phasePages: Array<Page> = []

  /**
   * Entity ownership used by scene and level lifetime scopes.
   */
  const scopeByEntity = new Map<number, symbol>()
  const scopeMembers = new Map<symbol, Set<number>>()

  let hooks: WorldHooks | undefined
  /** Suppresses per-component and relation hooks inside spawns and despawns. */
  let hookDepth = 0

  const nameAt = (ordinal: number): string => descriptors[ordinal]?.name ?? `component #${ordinal}`

  const ordinalOf = (descriptor: ComponentDescriptor): number => {
    const known = ordinals.get(descriptor.key)
    if (known !== undefined) {
      return known
    }
    const ordinal = descriptors.length
    ordinals.set(descriptor.key, ordinal)
    descriptors.push(descriptor)
    members.push(new Set())
    stores.push({ pages: [] })
    componentVersions.push(0)
    membershipRecords.push([])
    membershipVersions.push([])
    membershipFrom.push(0)
    frameVersions.push(0)
    return ordinal
  }

  for (const descriptor of Object.values(schema.components) as ReadonlyArray<ComponentDescriptor>) {
    ordinalOf(descriptor)
  }

  const pageAt = (ordinal: number, id: number): Page | undefined => stores[ordinal]!.pages[id >>> PAGE_BITS]

  /** The page holding `id`'s slot, created (empty) when missing. */
  const pageFor = (ordinal: number, id: number): Page => {
    const pages = stores[ordinal]!.pages
    const index = id >>> PAGE_BITS
    let page = pages[index]
    if (page === undefined) {
      page = {
        ordinal,
        base: index << PAGE_BITS,
        values: emptyValues,
        added: emptyTicks,
        changed: emptyTicks,
        count: 0,
        savedIn: 0,
        saved: new Uint32Array(PAGE_SIZE >>> 5),
        before: undefined,
        phaseIn: 0,
        phaseValues: undefined,
        phaseChanged: undefined
      }
      while (pages.length < index) pages.push(undefined)
      pages[index] = page
    }
    return page
  }

  const has = (record: EntityRecord, ordinal: number): boolean =>
    (record.heldBits[ordinal >>> 5]! & (1 << (ordinal & 31))) !== 0

  const holdBit = (record: EntityRecord, ordinal: number): void => {
    const bits = record.heldBits
    const word = ordinal >>> 5
    while (bits.length <= word) bits.push(0)
    bits[word] = bits[word]! | (1 << (ordinal & 31))
  }

  const dropBit = (record: EntityRecord, ordinal: number): void => {
    const word = ordinal >>> 5
    record.heldBits[word] = record.heldBits[word]! & ~(1 << (ordinal & 31))
  }

  /** The value of a component the entity holds (`ABSENT` when it does not). */
  const valueAt = (record: EntityRecord, ordinal: number): unknown => {
    const page = pageAt(ordinal, record.id)
    return page === undefined ? ABSENT : page.values[record.id & PAGE_MASK]
  }

  /** The page holding `id`'s slot, with storage to write into. */
  const ensurePage = (ordinal: number, id: number): Page => {
    const page = pageFor(ordinal, id)
    if (page.values === emptyValues) {
      page.values = filled(ABSENT)
      page.added = new Float64Array(PAGE_SIZE)
      page.changed = new Float64Array(PAGE_SIZE)
    }
    return page
  }

  /**
   * Clears one slot, leaving `record.held` to the caller; a page left empty
   * lets go of its storage, except while a transaction or phase may still
   * restore it.
   */
  const clearSlot = (record: EntityRecord, ordinal: number): void => {
    const page = pageAt(ordinal, record.id)!
    page.values[record.id & PAGE_MASK] = ABSENT
    page.count -= 1
    if (page.count === 0 && !inTransaction && !inPhase) {
      page.values = emptyValues
      page.added = emptyTicks
      page.changed = emptyTicks
      page.before = undefined
    }
  }

  /**
   * Records a membership change of `record` for one component.
   */
  const bumpMembership = (record: EntityRecord, ordinal: number): void => {
    const version = componentVersions[ordinal]! + 1
    componentVersions[ordinal] = version
    membershipRecords[ordinal]!.push(record)
    membershipVersions[ordinal]!.push(version)
  }

  const logFor = (logs: Array<TickLog | undefined>, ordinal: number): TickLog => {
    let log = logs[ordinal]
    if (log === undefined) {
      log = makeLog()
      logs[ordinal] = log
    }
    return log
  }

  /**
   * Stamps a slot as changed at the current tick, logging it once per tick.
   */
  const stampChanged = (page: Page, slot: number): void => {
    if (page.changed[slot] === tick) {
      return
    }
    page.changed[slot] = tick
    if (changedLogFrom[page.ordinal] !== undefined) {
      appendLog(logFor(changedLogs, page.ordinal), page.base + slot, tick)
    }
  }

  const bumpRelation = (key: symbol): void => {
    relationVersions.set(key, (relationVersions.get(key) ?? 0) + 1)
  }

  const entityIdOf = (id: number): Entity.EntityId<any, any> => Entity.makeEntityId(id)

  const allocateEntity = (): Entity.EntityId<any, any> => {
    const id = Entity.makeEntityId(nextEntity)
    nextEntity += 1
    return id
  }

  /**
   * Creates the record for a reserved id and writes its initial components.
   */
  const spawnEntity = (
    entityId: Entity.EntityId<any, any>,
    components: ReadonlyArray<Entity.StagedComponent>
  ): void => {
    let record = records.get(entityId)
    if (!record) {
      record = {
        id: entityId,
        entityId,
        held: [],
        heldBits: [],
        matches: [],
        nameAt,
        alive: true
      }
      records.set(record.id, record)
      entitiesVersion += 1
    }
    if (hooks !== undefined) {
      hookDepth += 1
      const written: Record<string, unknown> = {}
      for (let index = 0; index < components.length; index++) {
        const component = components[index]!
        writeRecord(record, ordinalOf(component[0]), component[1])
        written[component[0].name] = component[1]
      }
      hookDepth -= 1
      hooks.spawned(record.id, written)
      return
    }
    for (let index = 0; index < components.length; index++) {
      const component = components[index]!
      writeRecord(record, ordinalOf(component[0]), component[1])
    }
  }

  /**
   * Writes a slot that holds a value, outside any transaction: a different
   * value is stamped as changed at once. Write cells handle the transaction
   * path themselves (`transactionState`, `touchPage`).
   */
  const writeOutsideTransaction = (page: Page, slot: number, value: unknown): void => {
    const before = page.values[slot]
    page.values[slot] = value
    if (differs(before, value)) stampChanged(page, slot)
  }

  /**
   * Registers a page the running transaction is about to write to for the
   * first time. Write cells then save each slot's old value before its first
   * write (`saved`, `before`); commit and rollback visit only those slots.
   */
  const touchPage = (page: Page): void => {
    // `saved` is all zero here: commit and rollback clear every word they visit.
    page.savedIn = transaction
    page.before ??= filled(undefined)
    savedPages[savedCount++] = page
  }

  /**
   * Visits the slots the running transaction saved on a page, lowest first,
   * with the value from before the transaction.
   */
  const forEachSaved = (page: Page, visit: (slot: number, before: unknown) => void): void => {
    const saved = page.saved
    const before = page.before!
    for (let word = 0; word < saved.length; word++) {
      let bits = saved[word]!
      while (bits !== 0) {
        const lowest = bits & -bits
        const slot = (word << 5) + 31 - Math.clz32(lowest)
        visit(slot, before[slot])
        bits ^= lowest
      }
    }
  }

  /**
   * Starts a transaction for one system run.
   */
  const beginTransaction = (): void => {
    transaction += 1
    inTransaction = true
    transactionState.id = transaction
    transactionState.active = true
  }

  /**
   * Keeps the transaction's writes: every value that differs from the copy
   * is stamped as changed now.
   */
  const commitTransaction = (): void => {
    inTransaction = false
    transactionState.active = false
    for (let index = 0; index < savedCount; index++) {
      const page = savedPages[index]!
      if (inPhase && page.phaseIn !== phase) savePhasePage(page)
      const saved = page.saved
      const before = page.before!
      const values = page.values
      for (let word = 0; word < saved.length; word++) {
        let bits = saved[word]!
        while (bits !== 0) {
          const lowest = bits & -bits
          const slot = (word << 5) + 31 - Math.clz32(lowest)
          if (differs(before[slot], values[slot])) stampChanged(page, slot)
          // Old values do not outlive the transaction.
          before[slot] = undefined
          bits ^= lowest
        }
        saved[word] = 0
      }
    }
    savedCount = 0
  }

  /**
   * Restores every page the transaction wrote; no tick moved, so values are
   * all there is to restore.
   */
  const rollbackTransaction = (): void => {
    inTransaction = false
    transactionState.active = false
    for (let index = 0; index < savedCount; index++) {
      const page = savedPages[index]!
      const values = page.values
      const before = page.before!
      forEachSaved(page, (slot, value) => {
        values[slot] = value
        before[slot] = undefined
      })
      page.saved.fill(0)
    }
    savedCount = 0
  }

  /**
   * Keeps a page's values and ticks from before the phase, the first time a
   * transaction in it commits writes to the page: the slots it saved get
   * their old values back, and commit is about to stamp the ticks.
   */
  const savePhasePage = (page: Page): void => {
    page.phaseIn = phase
    const values = page.values.slice()
    forEachSaved(page, (slot, before) => {
      values[slot] = before
    })
    page.phaseValues = values
    page.phaseChanged = page.changed.slice()
    phasePages.push(page)
  }

  const clearPhase = (): void => {
    inPhase = false
    for (const page of phasePages) {
      page.phaseValues = undefined
      page.phaseChanged = undefined
    }
    phasePages.length = 0
  }

  /** Starts a phase: the transactions committed until it ends can be undone together. */
  const beginPhase = (): void => {
    phase += 1
    inPhase = true
  }

  /** Restores every page written in the phase, with its change ticks. */
  const rollbackPhase = (): void => {
    for (const page of phasePages) {
      const values = page.values
      const saved = page.phaseValues!
      for (let slot = 0; slot < PAGE_SIZE; slot++) values[slot] = saved[slot]
      page.changed.set(page.phaseChanged!)
    }
    clearPhase()
  }

  const clearEntityScope = (id: number): void => {
    const scopeKey = scopeByEntity.get(id)
    if (scopeKey === undefined) {
      return
    }
    scopeByEntity.delete(id)
    const members = scopeMembers.get(scopeKey)
    members?.delete(id)
    if (members?.size === 0) {
      scopeMembers.delete(scopeKey)
    }
  }

  const assignEntityScope = (id: number, scopeKey: symbol): void => {
    if (!records.has(id)) {
      return
    }
    clearEntityScope(id)
    let members = scopeMembers.get(scopeKey)
    if (!members) {
      members = new Set()
      scopeMembers.set(scopeKey, members)
    }
    members.add(id)
    scopeByEntity.set(id, scopeKey)
  }

  const destroyEntityScope = (scopeKey: symbol): void => {
    for (const id of [...(scopeMembers.get(scopeKey) ?? [])]) {
      destroyEntity(id)
    }
  }

  const writeRecord = (record: EntityRecord, ordinal: number, value: unknown): void => {
    const page = ensurePage(ordinal, record.id)
    const slot = record.id & PAGE_MASK
    if (page.values[slot] === ABSENT) {
      page.count += 1
      insertSorted(record.held, ordinal)
      holdBit(record, ordinal)
      members[ordinal]!.add(record)
      bumpMembership(record, ordinal)
      page.added[slot] = tick
      if (hooks !== undefined && hookDepth === 0) hooks.inserted(record.id, ordinal, value)
    } else if (hooks !== undefined && hookDepth === 0) {
      hooks.overwritten(record.id, ordinal, page.values[slot], value)
    }
    page.values[slot] = value
    stampChanged(page, slot)
  }

  const writeComponent = (id: number, descriptor: ComponentDescriptor, value: unknown): void => {
    const record = records.get(id)
    if (record) {
      writeRecord(record, ordinalOf(descriptor), value)
    }
  }

  const removeComponent = (id: number, descriptor: ComponentDescriptor): void => {
    const record = records.get(id)
    if (!record) {
      return
    }
    const ordinal = ordinalOf(descriptor)
    if (!has(record, ordinal)) {
      return
    }
    clearSlot(record, ordinal)
    record.held.splice(record.held.indexOf(ordinal), 1)
    dropBit(record, ordinal)
    members[ordinal]!.delete(record)
    bumpMembership(record, ordinal)
    appendLog(logFor(removedLogs, ordinal), id, tick)
    if (hooks !== undefined) hooks.removed(id, ordinal)
  }

  const relatedSourceIds = (relation: Relation.Relation.Any, targetId: number): ReadonlyArray<number> =>
    relatedSources.get(relation.key)?.get(targetId) ?? noSources

  const relationTarget = (relation: Relation.Relation.Any, sourceId: number): number | undefined =>
    relationTargets.get(relation.key)?.get(sourceId)

  const addRelatedSource = (relation: Relation.Relation.Any, targetId: number, sourceId: number): void => {
    let store = relatedSources.get(relation.key)
    if (!store) {
      store = new Map()
      relatedSources.set(relation.key, store)
    }
    const entries = store.get(targetId)
    if (!entries) {
      store.set(targetId, [sourceId])
      return
    }
    if (!entries.includes(sourceId)) {
      entries.push(sourceId)
    }
  }

  const removeRelatedSource = (relation: Relation.Relation.Any, targetId: number, sourceId: number): void => {
    const store = relatedSources.get(relation.key)
    const entries = store?.get(targetId)
    if (!store || !entries) {
      return
    }
    const next = entries.filter((entry) => entry !== sourceId)
    if (next.length === 0) {
      store.delete(targetId)
      return
    }
    store.set(targetId, next)
  }

  const unrelate = (sourceId: number, relation: Relation.Relation.Any): void => {
    const targets = relationTargets.get(relation.key)
    const previousTarget = targets?.get(sourceId)
    if (previousTarget === undefined) {
      return
    }
    targets!.delete(sourceId)
    removeRelatedSource(relation, previousTarget, sourceId)
    bumpRelation(relation.key)
    if (hooks !== undefined && hookDepth === 0) hooks.unrelated(sourceId, relation)
  }

  const wouldCreateHierarchyCycle = (relation: Relation.Relation.Any, sourceId: number, targetId: number): boolean => {
    let current: number | undefined = targetId
    while (current !== undefined) {
      if (current === sourceId) {
        return true
      }
      current = relationTarget(relation, current)
    }
    return false
  }

  const tryRelate = (
    sourceId: number,
    relation: Relation.Relation.Any,
    targetId: number
  ): Result.Result<void, Relation.Relation.MutationError> => {
    if (!records.has(sourceId)) {
      return Result.failure(Relation.missingEntityError(sourceId))
    }
    if (!records.has(targetId)) {
      return Result.failure(Relation.missingTargetEntityError(sourceId, targetId, relation.name))
    }
    if (!relation.allowSelf && sourceId === targetId) {
      return Result.failure(Relation.selfRelationNotAllowedError(sourceId, relation.name))
    }
    if (relation.relationKind === "hierarchy" && wouldCreateHierarchyCycle(relation, sourceId, targetId)) {
      return Result.failure(Relation.hierarchyCycleError(sourceId, targetId, relation.name))
    }

    let targets = relationTargets.get(relation.key)
    if (!targets) {
      targets = new Map()
      relationTargets.set(relation.key, targets)
    }
    const previousTarget = targets.get(sourceId)
    if (previousTarget !== undefined && previousTarget !== targetId) {
      removeRelatedSource(relation, previousTarget, sourceId)
    }
    targets.set(sourceId, targetId)
    addRelatedSource(relation, targetId, sourceId)
    bumpRelation(relation.key)
    if (hooks !== undefined) hooks.related(sourceId, relation, targetId)
    return Result.success(undefined)
  }

  const reorderChildren = (
    parentId: number,
    relation: Relation.Relation.Any,
    childIds: ReadonlyArray<number>
  ): Result.Result<void, Relation.Relation.MutationError> => {
    if (!records.has(parentId)) {
      return Result.failure(Relation.missingEntityError(parentId))
    }

    const currentChildren = relatedSourceIds(relation, parentId)
    const seenChildren = new Set<number>()

    for (const childId of childIds) {
      if (!records.has(childId)) {
        return Result.failure(Relation.missingChildEntityError(parentId, childId, relation.name))
      }
      if (seenChildren.has(childId)) {
        return Result.failure(Relation.duplicateChildError(parentId, childId, relation.name))
      }
      seenChildren.add(childId)
      if (relationTarget(relation, childId) !== parentId) {
        return Result.failure(Relation.childNotRelatedToParentError(parentId, childId, relation.name))
      }
    }

    if (currentChildren.length !== childIds.length) {
      return Result.failure(Relation.childSetMismatchError(parentId, relation.name))
    }
    for (const childId of currentChildren) {
      if (!seenChildren.has(childId)) {
        return Result.failure(Relation.childSetMismatchError(parentId, relation.name))
      }
    }

    if (childIds.length > 0) {
      relatedSources.get(relation.key)!.set(parentId, [...childIds])
      bumpRelation(relation.key)
    }
    return Result.success(undefined)
  }

  const destroyEntity = (id: number): void => {
    const record = records.get(id)
    if (!record) {
      return
    }
    if (hooks !== undefined) {
      hooks.despawned(id)
      hookDepth += 1
    }
    for (const relation of relationDefinitions) {
      const current = relatedSourceIds(relation, id)
      const sources = current.length === 0 ? noSources : [...current]
      if (relation.linkedDespawn) {
        for (const sourceId of sources) {
          destroyEntity(sourceId)
        }
      } else {
        for (const sourceId of sources) {
          unrelate(sourceId, relation)
        }
      }
      unrelate(id, relation)
    }
    const held = record.held
    for (let index = 0; index < held.length; index++) {
      const ordinal = held[index]!
      clearSlot(record, ordinal)
      members[ordinal]!.delete(record)
      bumpMembership(record, ordinal)
      appendLog(logFor(removedLogs, ordinal), id, tick)
    }
    held.length = 0
    record.heldBits.length = 0
    clearEntityScope(id)
    appendLog(despawnedLog, id, tick)
    record.alive = false
    records.delete(id)
    entitiesVersion += 1
    if (hooks !== undefined) hookDepth -= 1
  }

  /**
   * Advances the change tick and returns it.
   */
  const advanceTick = (): number => {
    tick += 1
    return tick
  }

  /**
   * Starts a new frame (one `runtime.tick(...)` call): log entries older than
   * the previous frame are dropped. Returns that boundary tick (entries at or
   * before it are gone), or `0` when nothing was dropped yet.
   */
  const advanceFrame = (): number => {
    for (let ordinal = 0; ordinal < descriptors.length; ordinal++) {
      // Keep membership changes from the current and previous frame.
      const boundary = frameVersions[ordinal]!
      const versions = membershipVersions[ordinal]!
      let count = 0
      while (count < versions.length && versions[count]! <= boundary) count++
      if (count > 0) {
        versions.splice(0, count)
        membershipRecords[ordinal]!.splice(0, count)
        membershipFrom[ordinal] = boundary
      }
      frameVersions[ordinal] = componentVersions[ordinal]!
    }
    if (frameStart > 0) {
      for (const log of changedLogs) if (log) trimLog(log, frameStart)
      removedLogs.forEach((log, ordinal) => {
        if (log) trimHeldLog(log, frameStart, removedReaders[ordinal], lifecycleCapacity)
      })
      trimHeldLog(despawnedLog, frameStart, despawnedReaders, lifecycleCapacity)
      retainedAfter = frameStart
    }
    frameStart = tick
    return retainedAfter
  }

  const entriesSince = (log: TickLog | undefined, since: number): ReadonlyArray<number> => {
    if (log === undefined) return noSources
    const start = firstAfter(log, since)
    return start === log.ids.length ? noSources : log.ids.slice(start)
  }

  /**
   * Plain export of every live entity: id and component values by
   * descriptor name, in spawn order, leaving out `skip`ped descriptors.
   */
  const exportEntities = (
    skip: (descriptor: ComponentDescriptor) => boolean
  ): Array<{ readonly id: number; readonly components: Record<string, unknown> }> =>
    [...records.values()]
      .sort((left, right) => left.id - right.id)
      .map((record) => {
        const components: Record<string, unknown> = {}
        for (const ordinal of record.held) {
          const descriptor = descriptors[ordinal]!
          if (!skip(descriptor)) components[descriptor.name] = valueAt(record, ordinal)
        }
        return { id: record.id, components }
      })

  /**
   * Relation edges grouped by target, preserving the stored source order.
   */
  const exportRelations = (): Record<string, Array<readonly [number, ReadonlyArray<number>]>> => {
    const exported: Record<string, Array<readonly [number, ReadonlyArray<number>]>> = {}
    for (const relation of relationDefinitions) {
      exported[relation.name] = [...(relatedSources.get(relation.key)?.entries() ?? [])]
        .map(([target, sources]) => [target, [...sources]] as const)
    }
    return exported
  }

  /**
   * Scope membership by scope storage key, members in id order. Every
   * member is a live entity: despawns leave their scope.
   */
  const exportScopes = (): Array<readonly [symbol, ReadonlyArray<number>]> =>
    [...scopeMembers].map(([key, members]) => [key, [...members].sort((left, right) => left - right)] as const)

  /**
   * Despawns every live entity (recorded like normal despawns).
   */
  const despawnAll = (): void => {
    for (const id of [...records.keys()]) {
      destroyEntity(id)
    }
  }

  const nextEntityValue = (): number => nextEntity

  /**
   * Visits the component values the running system transaction changed,
   * with the value before the transaction and the current one.
   */
  const forEachJournaled = (visit: (id: number, ordinal: number, before: unknown, after: unknown) => void): void => {
    for (let index = 0; index < savedCount; index++) {
      const page = savedPages[index]!
      const values = page.values
      forEachSaved(page, (slot, before) => {
        if (differs(before, values[slot])) visit(page.base + slot, page.ordinal, before, values[slot])
      })
    }
  }

  const setNextEntity = (value: number): void => {
    nextEntity = Math.max(nextEntity, value)
  }

  return {
    records,
    relationDefinitions,
    ordinalOf,
    nameAt,
    has,
    valueAt,
    /** The page holding `id`'s slot of a component, for cells that read it directly. */
    pageFor,
    entityIdOf,
    allocateEntity,
    spawnEntity,
    transactionState: transactionState as Readonly<TransactionState>,
    /** Starts a run: matches handed out from now on are valid until `endRun`. */
    beginRun: (): void => {
      inRun = true
    },
    /** Ends the run: every match handed out in it stops being usable. */
    endRun: (): void => {
      inRun = false
      for (let index = 0; index < handedOutCount; index++) handedOut[index]!.live = false
      handedOutCount = 0
    },
    /** Makes a query's matches usable until the running run ends. */
    handOut: (stamp: { live: boolean }): void => {
      if (inRun && !stamp.live) {
        stamp.live = true
        handedOut[handedOutCount++] = stamp
      }
    },
    touchPage,
    writeOutsideTransaction,
    writeComponent,
    removeComponent,
    destroyEntity,
    assignEntityScope,
    destroyEntityScope,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    beginPhase,
    commitPhase: clearPhase,
    rollbackPhase,
    tryRelate,
    unrelate,
    reorderChildren,
    relationTarget,
    relatedSourceIds,
    advanceTick,
    advanceFrame,
    exportEntities,
    exportRelations,
    exportScopes,
    despawnAll,
    nextEntityValue,
    setNextEntity,
    forEachJournaled,
    setHooks: (next: WorldHooks | undefined): void => {
      hooks = next
      hookDepth = 0
    },
    /** Tick at or before which changed-log entries may have been dropped. */
    retainedAfter: (): number => retainedAfter,
    descriptorAt: (ordinal: number): ComponentDescriptor => descriptors[ordinal]!,
    membersOf: (ordinal: number): ReadonlySet<EntityRecord> => members[ordinal]!,
    /**
     * Records whose membership of `ordinal` changed after `version`, or
     * `undefined` when the log no longer covers that range. May repeat.
     */
    membershipChangesSince: (ordinal: number, version: number): ReadonlyArray<EntityRecord> | undefined => {
      if (version < membershipFrom[ordinal]!) return undefined
      const versions = membershipVersions[ordinal]!
      let low = 0
      let high = versions.length
      while (low < high) {
        const middle = (low + high) >>> 1
        if (versions[middle]! > version) high = middle
        else low = middle + 1
      }
      return membershipRecords[ordinal]!.slice(low)
    },
    componentVersion: (ordinal: number): number => componentVersions[ordinal]!,
    relationVersion: (key: symbol): number => relationVersions.get(key) ?? 0,
    entitiesVersion: (): number => entitiesVersion,
    currentTick: (): number => tick,
    /**
     * Whether the component was added after `since`.
     */
    addedSince: (record: EntityRecord, ordinal: number, since: number): boolean => {
      const page = pageAt(ordinal, record.id)
      const slot = record.id & PAGE_MASK
      return page !== undefined && page.values[slot] !== ABSENT && page.added[slot]! > since
    },
    /**
     * Whether the component was added or changed after `since`.
     */
    changedSince: (record: EntityRecord, ordinal: number, since: number): boolean => {
      const page = pageAt(ordinal, record.id)
      const slot = record.id & PAGE_MASK
      return page !== undefined && page.values[slot] !== ABSENT && page.changed[slot]! > since
    },
    /**
     * Candidate ids for a `changed`/`added` filter on `ordinal` after `since`,
     * or `undefined` when the log no longer covers that range. Ids may repeat.
     */
    changedCandidates: (ordinal: number, since: number): ReadonlyArray<number> | undefined => {
      const from = changedLogFrom[ordinal]
      return from === undefined || since < from || since < retainedAfter
        ? undefined
        : entriesSince(changedLogs[ordinal], since)
    },
    /**
     * Starts logging changes of one component, for sparse `added`/`changed`
     * queries. Changes before this point are found by scanning instead.
     */
    trackChanges: (ordinal: number): void => {
      if (changedLogFrom[ordinal] === undefined) {
        changedLogFrom[ordinal] = tick
      }
    },
    removedSince: (ordinal: number, since: number): ReadonlyArray<number> => entriesSince(removedLogs[ordinal], since),
    despawnedSince: (since: number): ReadonlyArray<number> => entriesSince(despawnedLog, since),
    /** Makes `reader` hold removal records of `ordinal` until it has read them. */
    registerRemovedReader: (ordinal: number, reader: LifecycleCursor): void => {
      let readers = removedReaders[ordinal]
      if (readers === undefined) {
        readers = new Set()
        removedReaders[ordinal] = readers
      }
      readers.add(reader)
    },
    /** Makes `reader` hold despawn records until it has read them. */
    registerDespawnedReader: (reader: LifecycleCursor): void => {
      despawnedReaders.add(reader)
    },
    /**
     * Whether removal records of `ordinal` after `since` (and after
     * `registeredAt`, when the reader started) were dropped before being read.
     */
    removedLagged: (ordinal: number, since: number, registeredAt: number): boolean => {
      const log = removedLogs[ordinal]
      return log !== undefined && log.droppedThrough > Math.max(since, registeredAt)
    },
    /** Like `removedLagged`, for despawn records. */
    despawnedLagged: (since: number, registeredAt: number): boolean =>
      despawnedLog.droppedThrough > Math.max(since, registeredAt)
  }
}
