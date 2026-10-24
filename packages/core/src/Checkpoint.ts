/**
 * Rewind a runtime in memory, for rollback netcode and client prediction.
 *
 * `runtime.checkpoint(simulate)` marks the world between ticks.
 * `runtime.rewind(checkpoint)` puts it back exactly as it was then, so
 * ticking `simulate` again gives the same results, bit for bit, as a runtime
 * that never rewound: entity ids and the next id, component values and their
 * change ticks, relations in order, scopes, every resource (transient ones
 * too), committed and queued machine states, pending commands, unread
 * events, and the read positions of every system `simulate` runs.
 *
 * A rollback game takes one checkpoint per tick, ticks ahead with guessed
 * remote input, and when real input for an earlier tick arrives and differs,
 * rewinds to the checkpoint before it and ticks again up to the present. The
 * runtime keeps the last `checkpoints` checkpoints (an option of
 * `Game.Runtime.make`, {@link defaultWindow} by default); an older one,
 * one newer than a checkpoint the runtime rewound to, and every one taken
 * before a `restore` can no longer be rewound to (`Released`).
 *
 * Checkpoints are cheap: taking one copies nothing but resources, machines,
 * and queues. From then on, the first change to a page of component values,
 * to an entity, a relation, or a scope keeps what it replaced, so the cost
 * of a tick grows with what it changes, not with the size of the world.
 *
 * To persist, use `runtime.snapshot()`: a checkpoint is a value of this
 * runtime only, with nothing in it to save (`JSON.stringify` gives `{}`),
 * and `restore` rejects it. To rewind in-process, use checkpoints:
 * `restore` is for loading saves, and gives new ids, drops queued work, and
 * restarts every reader.
 *
 * What `simulate` may use is checked when the checkpoint is taken:
 *
 * - its services must be input sources (`snapshot()`) or plain data. A
 *   service with effects (playing a sound) would run again for every tick
 *   ticked again; emit an event or write a resource, and act on it from the
 *   host. The host feeds the input of each tick again through its source,
 *   keyed by the tick it is for (`Clock`), not by when it arrived.
 * - its systems may not keep `local` state, which a rewind cannot put back:
 *   keep it in a resource or a component.
 *
 * Systems and inspectors outside `simulate` (rendering, a HUD, a host's
 * inspector) do not rewind. Their next run sees the rewind as ordinary
 * changes: a value written after the checkpoint as changed, a component or
 * entity that is gone as removed or despawned, one that came back as added.
 * A removal is reported only for what is still gone when the reader runs, so
 * an entity the rewind took away and the ticks after it brought back (the
 * same id: ids are exact) is seen as changed, never as despawned and spawned
 * again. They may see a value as changed that ended up equal. Events they
 * read during ticks that are ticked again are published again: act on
 * events of confirmed ticks only, or de-duplicate them by tick.
 *
 * @module Checkpoint
 * @docGroup runtime
 *
 * @example
 * ```ts
 * const history = new Map<number, Checkpoint.Checkpoint<typeof Root>>()
 *
 * // Every tick: keep where it starts, then run it with the input known so far.
 * history.set(tick, runtime.checkpoint(simulate))
 * runtime.tick(simulate)
 *
 * // Real input for an earlier tick differs from the guess: go back and run again.
 * const rewound = runtime.rewind(history.get(wrongTick)!)
 * if (rewound.ok) {
 *   for (let at = wrongTick; at <= tick; at++) {
 *     history.set(at, runtime.checkpoint(simulate))
 *     runtime.tick(simulate)
 *   }
 * }
 * ```
 */
import type { Descriptor } from "./Descriptor.ts"
import * as Internal from "./internal/checkpoint.ts"
import type * as Requirement from "./Requirement.ts"
import type * as Schedule from "./Schedule.ts"
import type { SystemDefinition } from "./System.ts"

declare const checkpointTypeId: unique symbol

/**
 * The world of one runtime at one moment between ticks, to rewind to with
 * `runtime.rewind(checkpoint)`. Opaque: it holds nothing to read or save.
 * `Root` is the game's schema root, so a checkpoint of another game does not
 * type-check.
 */
export interface Checkpoint<out Root = unknown> {
  readonly [checkpointTypeId]: "~ritmo/Checkpoint"
  readonly __schemaRoot?: Root | undefined
}

/** How many checkpoints a runtime keeps when `Game.Runtime.make` is not given `checkpoints`. */
export const defaultWindow = 16

/** The checkpoint was taken by another runtime. */
export interface OtherRuntime {
  readonly _tag: "OtherRuntime"
}

/**
 * The runtime let go of the checkpoint: `window`, it is older than the last
 * `checkpoints` taken; `rewound`, the runtime rewound to an older one; or
 * `restored`, a save was restored after it was taken.
 */
export interface Released {
  readonly _tag: "Released"
  readonly reason: "window" | "rewound" | "restored"
}

/** Why `runtime.rewind(checkpoint)` changed nothing. */
export type RewindError = OtherRuntime | Released

/**
 * Whether `value` is a checkpoint a runtime took. A checkpoint copied or
 * parsed back from JSON is not one.
 */
export const isCheckpoint = (value: unknown): value is Checkpoint =>
  Internal.isCheckpoint(value)

type AnySystem = SystemDefinition<any, any, any, any, any>

/** Plugin systems with an erased spec (`any`) are not checked. */
type IsErased<T> = 0 extends 1 & T ? true : false

type ServiceIssue<Need> =
  Need extends Descriptor<"service", infer Name, infer Value>
    ? Value extends Schedule.Source<any> ? never
      : Schedule.IsPlain<Value> extends true ? never
      : `${Name} is neither a snapshot() source nor plain data, so a rewind would call it again for every tick run again: give the simulation its input through a source, and its effects on the host through events or resources`
    : never

type LocalIssue<Sys> =
  Sys extends AnySystem
    ? IsErased<Sys["spec"]> extends true ? never
      : [Exclude<Sys["spec"]["local"], undefined>] extends [never] ? never
      : `${Sys["name"]} keeps local state, which a rewind cannot put back: keep it in a resource or a component`
    : never

type OrderEntries<Selected> =
  Selected extends { readonly __order?: (_: never) => infer Order extends Schedule.AnyScheduleOrder } ? Order["entries"] : ReadonlyArray<unknown>

type ScheduleIssues<Selected> =
  number extends OrderEntries<Selected>["length"]
    ? "the systems of this schedule are not statically known (it was widened to a schedule type): pass the schedule as built"
    : | ServiceIssue<Extract<Requirement.Of<Selected>, Descriptor<"service", string, any>>>
      | LocalIssue<Schedule.SystemsIn<Selected>>

/**
 * Resolves to `unknown` when a schedule can be rewound: every service it
 * uses (its transition bundles included) is an input source or plain data,
 * and none of its systems keeps `local` state. Otherwise to an object naming
 * each problem and its fix. `runtime.checkpoint(schedule)` uses it.
 */
export type ValidateRewindable<Selected> =
  [ScheduleIssues<Selected>] extends [never]
    ? unknown
    : { readonly __fixCheckpoint__: ScheduleIssues<Selected> }
