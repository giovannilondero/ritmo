/**
 * What differs between two saves of the same tick: the report for a desync
 * between peers of a networked game.
 *
 * A `Netcode` session made with `keepSnapshots: true` fails with `Desynced`
 * carrying this peer's save of the tick whose checksums differ; the other
 * peer's session carries its own. `compare(mine, theirs)` lists every
 * difference, entities by id and values by path, so an agent can see which
 * component or resource went apart first, then find the system that wrote
 * it with a `Session`'s `why` on a headless rerun.
 *
 * @module Desync
 * @docGroup devtools
 *
 * @example
 * ```ts
 * const left = sessions[0].advance(input)
 * const right = sessions[1].advance(input)
 * if (!left.ok && left.error._tag === "Desynced" && !right.ok && right.error._tag === "Desynced") {
 *   console.log(Desync.compare(left.error.snapshot!, right.error.snapshot!))
 * }
 * ```
 */
import type * as Snapshot from "@typeonce/ritmo/Snapshot"

import * as Format from "./Format.ts"
import * as Rendered from "./Rendered.ts"

/** One value that differs: where, and each side's (`undefined`: absent on that side). */
export interface Difference {
  /** `nextEntity`, `entity 12`, `entity 12 Game/Position.x`, `resource Game/Score`, `machine Game/Round`, `relation Game/ChildOf`, or `scope Game/Wave`. */
  readonly path: string
  readonly mine: unknown
  readonly theirs: unknown
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The leaves where two values differ, under `path`. */
const differences = (path: string, mine: unknown, theirs: unknown, into: Array<Difference>): void => {
  if (Format.sameValue(mine, theirs)) return
  if (isRecord(mine) && isRecord(theirs)) {
    for (const key of [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].sort()) {
      differences(`${path}.${key}`, mine[key], theirs[key], into)
    }
    return
  }
  if (Array.isArray(mine) && Array.isArray(theirs) && mine.length === theirs.length) {
    mine.forEach((item, index) => differences(`${path}[${index}]`, item, theirs[index], into))
    return
  }
  into.push({ path, mine, theirs })
}

/** Each named entry of two records, compared under `kind name`. */
const byName = (kind: string, mine: Readonly<Record<string, unknown>>, theirs: Readonly<Record<string, unknown>>, into: Array<Difference>): void => {
  for (const name of [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].sort()) {
    differences(`${kind} ${name}`, mine[name], theirs[name], into)
  }
}

/** Every difference between two saves, in a stable order: the next id, entities by id, then resources, machines, relations, and scopes by name. */
export const compare = (mine: Snapshot.WorldSnapshot, theirs: Snapshot.WorldSnapshot): Rendered.Rendered<ReadonlyArray<Difference>> => {
  const found: Array<Difference> = []
  differences("nextEntity", mine.nextEntity, theirs.nextEntity, found)
  const mineById = new Map(mine.entities.map((entity) => [entity.id, entity.components] as const))
  const theirsById = new Map(theirs.entities.map((entity) => [entity.id, entity.components] as const))
  for (const id of [...new Set([...mineById.keys(), ...theirsById.keys()])].sort((a, b) => a - b)) {
    const left = mineById.get(id)
    const right = theirsById.get(id)
    if (left === undefined || right === undefined) found.push({ path: `entity ${id}`, mine: left, theirs: right })
    else byName(`entity ${id}`, left, right, found)
  }
  byName("resource", mine.resources, theirs.resources, found)
  byName("machine", mine.machines, theirs.machines, found)
  byName("relation", mine.relations, theirs.relations, found)
  byName("scope", mine.scopes, theirs.scopes, found)
  const text = found.length === 0
    ? "The saves are equal."
    : [`${found.length} difference${found.length === 1 ? "" : "s"} (mine -> theirs):`, ...found.map(({ path, mine, theirs }) => `  ${path}: ${Format.value(mine)} -> ${Format.value(theirs)}`)].join("\n")
  return Rendered.make(found, text)
}
