/**
 * One input source merged from several devices, so gameplay reads each
 * action once whatever the player uses.
 *
 * Declare the game's actions once with `Controls.actions([...])`, bind them
 * on every device (`Keyboard.actions`, `Gamepad.actions`, `Pointer.actions`,
 * `Touch.actions`), and merge the devices with the declaration's `merge`.
 * Merged devices
 * behave like one device with all their bindings: an action is `held` while
 * any device holds it, `pressed` when any device pressed it, and `released`
 * when a device released it and none holds it now. Device-specific data
 * (sticks, triggers, touch aim) stays in `devices`, under the names given to
 * `merge`; `lastUsed` names the device the player used last, for button
 * prompts.
 *
 * Devices the player uses together (keyboard and mouse) go in one
 * `group(...)`: the group is one entry of the merge, so walking with the
 * keyboard while aiming with the mouse keeps `lastUsed` on the group, and
 * `available` follows what the group binds between its devices. Grouped
 * devices keep their own names in `devices` and `rebind`.
 *
 * Every entry binds every action. A device that cannot (a touch layout
 * without a pause button) is passed as `actions.lacking(device, [...])`,
 * which names exactly the actions it lacks. Reading a lacking action on that
 * device does not compile; `available` reports whether the last used device
 * has each action, and `describe()` lists every gap as a `service-lint`.
 *
 * Capture the merged source with `InputCapture.system(...)` and build the
 * devices inside the `merge(...)` call, so nothing else takes their
 * snapshots. A game with one device captures that device directly instead.
 *
 * @module Controls
 * @docGroup browser
 *
 * @example
 * ```ts
 * const Actions = Controls.actions(["left", "right", "jump", "pause"])
 *
 * const keyBindings = { left: ["ArrowLeft", "a"], right: ["ArrowRight", "d"], jump: [" "], pause: ["Escape"] } as const
 * const padBindings = { left: ["dpadLeft"], right: ["dpadRight"], jump: ["south"], pause: ["start"] } as const
 *
 * // One function builds the controls, for the browser and for tests.
 * export const makeControls = (devices: {
 *   readonly keyboard: Keyboard.Actions<typeof keyBindings>
 *   readonly gamepad: Gamepad.Actions<typeof padBindings>
 * }) => Actions.merge(devices)
 *
 * const ControlsInput = Descriptor.Service<ReturnType<typeof makeControls>>()("Game/Controls")
 * const Input = Descriptor.TransientResource<InputCapture.SnapshotOf<typeof ControlsInput>>()("Game/Input")
 * const CaptureInput = InputCapture.system(Game, { name: "Game/CaptureInput", source: ControlsInput, resource: Input })
 *
 * const runtime = Game.Runtime.make({
 *   services: Game.Runtime.services(Game.Runtime.service(ControlsInput, makeControls({
 *     keyboard: Keyboard.actions(window, keyBindings),
 *     gamepad: Gamepad.actions(window, padBindings)
 *   }))),
 *   resources: { Input: Actions.idle({ keyboard: Keyboard.idle(keyBindings), gamepad: Gamepad.idle(padBindings) }) }
 * })
 *
 * // In a system:
 * const input = resources.input.get()
 * if (input.actions.jump.pressed) jump()
 * const prompt = input.lastUsed === "gamepad" ? "Ⓐ" : "Space"
 * ```
 */
import type * as System from "@typeonce/ritmo/System"
import * as Debug from "@typeonce/ritmo/Debug"

import type { ActionState } from "./Keyboard.ts"

/**
 * The part of a device's snapshot `Controls` merges: every action's state,
 * and whether the player used the device in this window.
 */
export interface DeviceSnapshot<A extends string> {
  readonly actions: { readonly [K in A]: ActionState }
  readonly used: boolean
}

/** A device `Controls` can merge: `Keyboard.actions`, `Gamepad.actions`, `Pointer.actions`, `Touch.actions`, or their scripted forms. */
export interface Device<A extends string = string> extends System.Consumes<"snapshot"> {
  snapshot(): DeviceSnapshot<A>
  dispose(): void
}

/**
 * Devices the player uses together as one (keyboard and mouse), built with
 * {@link ActionSet.group}. The group is one entry of the merge: it binds
 * what its devices bind between them, and `lastUsed` and `available` follow
 * it as a whole. Its devices keep their own names in `devices` and `rebind`.
 */
export interface Group<Members> {
  readonly _tag: "Group"
  readonly members: Members
}

/** A device passed with the actions it lacks; build it with {@link ActionSet.lacking}. */
export interface Lacking<D extends Unit, Missing extends string> {
  readonly _tag: "Lacking"
  readonly device: D
  readonly lacking: ReadonlyArray<Missing>
}

/** One entry of a merge before `lacking`: a device or a group of devices. */
type Unit = Device | Group<Readonly<Record<string, Device>>>

type Entry = Unit | Lacking<Unit, string>

/** The actions a device, or the devices of a group, bind. */
type ActionsOf<D> = D extends Group<infer M> ? { [K in keyof M]: ActionsOf<M[K]> }[keyof M]
  : D extends { snapshot(): { readonly actions: infer Actions } } ? keyof Actions & string
  : never

type DeviceOf<E> = E extends Lacking<infer D, string> ? D : E

type SnapshotOf<D> = D extends { snapshot(): infer S } ? S : never

/** The devices one merge entry contributes, by name: a group's members, or the device under the entry's name. */
type MembersOf<K, U> = U extends Group<infer M> ? M : { readonly [P in K & string]: U }

/** Every device name of a merge, with groups flattened. */
type DeviceNames<R> = { [K in keyof R]: keyof MembersOf<K, DeviceOf<R[K]>> }[keyof R] & string

/** The device a merge names `N`, wherever it is. */
type DeviceNamed<R, N> = {
  [K in keyof R]: MembersOf<K, DeviceOf<R[K]>> extends infer M ? N extends keyof M ? M[N] : never : never
}[keyof R]

/** Each device's full snapshot, by device name (group members under their own names). */
type DevicesOf<R> = { readonly [N in DeviceNames<R>]: SnapshotOf<DeviceNamed<R, N>> }

/** The `rebind` of each merged device that has one, by device name. */
type RebindOf<R> = {
  readonly [N in DeviceNames<R> as DeviceNamed<R, N> extends { readonly rebind: unknown } ? N : never]: DeviceNamed<R, N> extends { readonly rebind: infer Rebind } ? Rebind : never
}

/** The names one entry takes: its own, and its members' for a group. */
type NamesOf<K, U> = U extends Group<infer M> ? K | keyof M : K

/** A device or group name the merge uses twice. */
type Repeated<R> = {
  [K in keyof R]:
    | (NamesOf<K, DeviceOf<R[K]>> & { [J in Exclude<keyof R, K>]: NamesOf<J, DeviceOf<R[J]>> }[Exclude<keyof R, K>])
    | (DeviceOf<R[K]> extends Group<infer M> ? K & keyof M : never)
}[keyof R] & string

/** Rejects a merge that uses a name twice: `devices`, `rebind`, and `lastUsed` need one meaning per name. */
type UniqueNames<R> = [Repeated<R>] extends [never]
  ? unknown
  : `the name ${Repeated<R>} is used twice: give every device and group its own name`

/** A group member when it is a plain device binding only declared actions, otherwise an error naming the fix. */
type CheckMember<A extends string, Name extends string, D> = D extends Lacking<Unit, string>
  ? "lacking applies to the whole group: pass lacking(group(...), [...])"
  : D extends Group<unknown> ? "groups do not nest: list every device in one group"
  : [Exclude<ActionsOf<D>, A>] extends [never] ? D
  : `${Name} binds ${Exclude<ActionsOf<D>, A>}, which is not one of the actions`

/** Rejects a group of fewer than two devices. */
type TwoOrMore<M> = [keyof M] extends [never]
  ? "a group needs at least two devices"
  : { [K in keyof M]: [Exclude<keyof M, K>] extends [never] ? K : never }[keyof M] extends infer Alone extends string
    ? [Alone] extends [never] ? unknown : `a group needs at least two devices: pass ${Alone} to merge directly`
    : unknown

/** The entry when it covers exactly the actions `A`, otherwise an error naming the device and the fix. */
type CheckEntry<A extends string, Name extends string, E> = E extends Lacking<infer D, infer Missing>
  ? [Exclude<ActionsOf<D>, A>] extends [never]
    ? [Exclude<A, ActionsOf<D> | Missing>] extends [never]
      ? E
      : `${Name} has no action ${Exclude<A, ActionsOf<D> | Missing>}: bind it on ${Name}, or list it in its lacking(...)`
    : `${Name} binds ${Exclude<ActionsOf<D>, A>}, which is not one of the actions`
  : [Exclude<ActionsOf<E>, A>] extends [never]
    ? [Exclude<A, ActionsOf<E>>] extends [never]
      ? E
      : `${Name} has no action ${Exclude<A, ActionsOf<E>>}: bind it on ${Name}, or pass lacking(${Name}, [...]) from the action set`
    : `${Name} binds ${Exclude<ActionsOf<E>, A>}, which is not one of the actions`

/** The actions some merged device binds. */
type BoundBy<R> = { [K in keyof R]: ActionsOf<DeviceOf<R[K]>> }[keyof R]

/** Rejects a merge where no device binds an action. */
type EveryActionBound<A extends string, R> = [Exclude<A, BoundBy<R>>] extends [never]
  ? unknown
  : `no device binds ${Exclude<A, BoundBy<R>>}: bind it on one device, or remove it from Controls.actions`

/**
 * The merged input. `actions` merges every device; `devices` holds each
 * device's own snapshot under the name it was merged under.
 */
export interface Snapshot<A extends string, Devices, Used extends string = keyof Devices & string> {
  readonly actions: { readonly [K in A]: ActionState }
  /**
   * Whether the last used device binds each action: `false` for the actions
   * it was merged as lacking, so the game can offer them another way (an
   * on-screen pause button). Every action is available before any device is
   * used.
   */
  readonly available: { readonly [K in A]: boolean }
  readonly devices: Devices
  /**
   * The device (or group) that reported input most recently, or `null`
   * before any did. When several report input in one window it stays on the
   * current one if it is among them, otherwise it takes the first in merge
   * order.
   */
  readonly lastUsed: Used | null
}

/** The merged source, for `InputCapture.system(...)`. */
export interface Controls<A extends string, R> extends System.Consumes<"snapshot"> {
  /** Takes every device's snapshot, starting a new press window on each, and merges them. */
  snapshot(): Snapshot<A, DevicesOf<R>, keyof R & string>
  /** Each merged device's `rebind`, for a settings screen; devices without one (touch) are not listed. */
  readonly rebind: RebindOf<R>
  /** Disposes every merged device. */
  dispose(): void
}

/**
 * The game's actions, declared once. Every merge, gap, and idle snapshot is
 * built from it, so action names are checked against one list.
 */
export interface ActionSet<A extends string> {
  /** The declared actions, in order, for listing them on a settings screen. */
  readonly names: ReadonlyArray<A>
  /**
   * Marks the actions `device` cannot report, for {@link merge}. List
   * exactly the declared actions it does not bind: autocomplete offers them,
   * and a missing or extra name does not compile.
   */
  lacking<D extends Unit, const Missing extends ReadonlyArray<Exclude<A, ActionsOf<D>>>>(
    device: D & (
      [Exclude<ActionsOf<D>, A>] extends [never]
        ? [Exclude<A, ActionsOf<D>>] extends [never] ? "This device binds every action: pass it to merge without lacking" : unknown
        : `This device binds ${Exclude<ActionsOf<D>, A>}, which is not one of the actions`
    ),
    lacking: Missing & ([Exclude<A, ActionsOf<D> | Missing[number]>] extends [never] ? unknown : `This device also lacks ${Exclude<A, ActionsOf<D> | Missing[number]>}: bind it, or list it here`)
  ): Lacking<D, Missing[number]>
  /**
   * Groups devices the player uses together (keyboard and mouse), for
   * {@link merge}: the group binds what its devices bind between them, and
   * `lastUsed` and `available` follow it as a whole, so walking with the
   * keyboard while aiming with the mouse is one device in use. A group needs
   * two or more plain devices, each binding only declared actions; pass the
   * group to {@link lacking} for the actions none of them binds.
   */
  group<const M extends Readonly<Record<string, Entry | Group<unknown>>>>(
    members: { readonly [K in keyof M]: CheckMember<A, K & string, M[K]> } & TwoOrMore<M>
  ): Group<M>
  /**
   * Merges `devices` into one source. Each entry (a device or a
   * {@link group}) binds every declared action, or is passed through
   * {@link lacking}; every action is bound by at least one device. Entry
   * names key `lastUsed`; device names (a group's members under their own)
   * key `devices` and `rebind`.
   */
  merge<const R extends Readonly<Record<string, Entry>>>(
    devices: { readonly [K in keyof R]: CheckEntry<A, K & string, R[K]> } & EveryActionBound<A, R> & UniqueNames<R>
  ): Controls<A, R>
  /**
   * A merged snapshot with nothing held and no device used yet, for
   * initializing the input resource: pass each device's idle snapshot
   * (`Keyboard.idle(...)`, ...) under its device name.
   */
  idle<const Devices extends Readonly<Record<string, DeviceSnapshot<string>>>>(devices: Devices): Snapshot<A, Devices, never>
}

const idleState: ActionState = { held: false, pressed: false, released: false }

const isLacking = (entry: Entry): entry is Lacking<Unit, string> => (entry as Partial<Lacking<Unit, string>>)._tag === "Lacking"

const isGroup = (unit: Unit): unit is Group<Readonly<Record<string, Device>>> =>
  (unit as Partial<Group<unknown>>)._tag === "Group"

/** A merge entry's devices by name: a group's members, or the device under the entry's name. */
const membersOf = (name: string, unit: Unit): ReadonlyArray<{ readonly name: string; readonly device: Device }> =>
  isGroup(unit)
    ? Object.entries(unit.members).map(([member, device]) => ({ name: member, device }))
    : [{ name, device: unit }]

/**
 * Declares the game's actions. Build the merged source with the returned
 * set's `merge`.
 */
export const actions = <const A extends readonly [string, ...Array<string>]>(names: A): ActionSet<A[number]> => {
  const list: ReadonlyArray<A[number]> = [...new Set(names)]
  const everyAvailable = (): Record<string, boolean> => Object.fromEntries(list.map((name) => [name, true]))
  return {
    names: list,
    lacking: (device, lacking) => ({ _tag: "Lacking", device, lacking }),
    group: (members) => ({ _tag: "Group", members }) as never,
    merge(devices) {
      const entries = Object.entries(devices as Readonly<Record<string, Entry>>).map(([name, entry]) => {
        const unit = isLacking(entry) ? entry.device : entry
        return { name, members: membersOf(name, unit), lacking: new Set<string>(isLacking(entry) ? entry.lacking : []) }
      })
      const all = entries.flatMap((entry) => entry.members)
      let lastUsed: string | null = null
      const rebind: Record<string, (bindings: never) => void> = {}
      for (const { name, device } of all) {
        const candidate = (device as Device & { readonly rebind?: unknown }).rebind
        if (typeof candidate === "function") rebind[name] = (bindings) => candidate.call(device, bindings)
      }
      const controls = {
        snapshot() {
          const snapshots: Record<string, DeviceSnapshot<string>> = {}
          for (const { name, device } of all) snapshots[name] = device.snapshot()
          const used = entries.filter(({ members }) => members.some(({ name }) => snapshots[name]!.used))
          if (used.length > 0 && !used.some(({ name }) => name === lastUsed)) lastUsed = used[0]!.name
          const current = entries.find(({ name }) => name === lastUsed)
          const merged: Record<string, ActionState> = {}
          const available: Record<string, boolean> = {}
          for (const action of list) {
            let held = false
            let pressed = false
            let released = false
            for (const { name } of all) {
              const state = (snapshots[name]!.actions as Readonly<Record<string, ActionState | undefined>>)[action]
              if (state === undefined) continue
              held ||= state.held
              pressed ||= state.pressed
              released ||= state.released
            }
            merged[action] = held || pressed || released ? { held, pressed, released: released && !held } : idleState
            available[action] = current === undefined || !current.lacking.has(action)
          }
          return { actions: merged, available, devices: snapshots, lastUsed }
        },
        rebind,
        dispose() {
          for (const { device } of all) device.dispose()
        },
        [Debug.serviceLints]: () =>
          entries.flatMap(({ name, lacking }) =>
            [...lacking].map((action) => ({
              severity: "info" as const,
              message: `${name} lacks ${action}, so while ${name} is the last used device the player cannot ${action}`,
              fix: `fine if the game offers ${action} another way while ${name} is in use (read available.${action} from the input); otherwise bind ${action} on ${name}`
            })))
      }
      // The checked signature carries the device types; the implementation is the same for every merge.
      return controls as never
    },
    idle: (devices) => ({
      actions: Object.fromEntries(list.map((name) => [name, idleState])) as Snapshot<A[number], never>["actions"],
      available: everyAvailable() as Snapshot<A[number], never>["available"],
      devices,
      lastUsed: null
    })
  }
}
