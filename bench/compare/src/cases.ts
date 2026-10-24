/**
 * The five cases of the community ECS benchmark
 * (https://github.com/noctjs/ecs-benchmark), each written once per library in
 * that library's idiomatic fast path. One `run()` is one operation.
 *
 * - packed_5: 1,000 entities with A..E; five systems each double one value.
 * - simple_iter: 4,000 entities in four shapes; three systems swap two values.
 * - frag_iter: 26 shapes of 100 entities (one tag each, plus Data); one system doubles Data.
 * - entity_cycle: 1,000 entities with A each spawn one with B; then every B is despawned.
 * - add_remove: 1,000 entities with A gain B; then lose it.
 */
export const caseNames = ["packed_5", "simple_iter", "frag_iter", "entity_cycle", "add_remove"] as const

export type CaseName = (typeof caseNames)[number]

/** One library's world for one case: `run()` is one operation. */
export interface Instance {
  readonly run: () => void
}

export type Library = Record<CaseName, () => Instance>

/** 26 tag names for frag_iter. */
export const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
