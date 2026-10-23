/**
 * One input source merged from several devices, so gameplay reads each
 * action once whatever the player uses.
 *
 * Declare the game's actions once with `Controls.actions([...])`, bind them
 * on every device (`Keyboard.actions`, `Gamepad.actions`, `Touch.track`),
 * and merge the devices with the declaration's `merge`. Merged devices
 * behave like one device with all their bindings: an action is `held` while
 * any device holds it, `pressed` when any device pressed it, and `released`
 * when a device released it and none holds it now. Device-specific data
 * (sticks, triggers, touch aim) stays in `devices`, under the names given to
 * `merge`; `lastUsed` names the device the player used last, for button
 * prompts.
 *
 * Every device binds every action. A device that cannot (a touch layout
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

/** A device `Controls` can merge: `Keyboard.actions`, `Gamepad.actions`, `Touch.track`, or their scripted forms. */
export interface Device<A extends string = string> extends System.Consumes<"snapshot"> {
  snapshot(): DeviceSnapshot<A>
  dispose(): void
}

/** A device passed with the actions it lacks; build it with {@link ActionSet.lacking}. */
export interface Lacking<D extends Device, Missing extends string> {
  readonly _tag: "Lacking"
  readonly device: D
  readonly lacking: ReadonlyArray<Missing>
}

type Entry = Device | Lacking<Device, string>

/** The actions a device binds. */
type ActionsOf<D> = D extends { snapshot(): { readonly actions: infer Actions } } ? keyof Actions & string : never

type DeviceOf<E> = E extends Lacking<infer D, string> ? D : E

type SnapshotOf<D> = D extends { snapshot(): infer S } ? S : never

/** Each device's full snapshot, by the name it was merged under. */
type DevicesOf<R> = { readonly [K in keyof R]: SnapshotOf<DeviceOf<R[K]>> }

/** The `rebind` of each merged device that has one, by the name it was merged under. */
type RebindOf<R> = {
  readonly [K in keyof R as DeviceOf<R[K]> extends { readonly rebind: unknown } ? K : never]: DeviceOf<R[K]> extends { readonly rebind: infer Rebind } ? Rebind : never
}

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
export interface Snapshot<A extends string, Devices> {
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
   * The device that reported input most recently, or `null` before any did.
   * When several report input in one window it stays on the current one if
   * it is among them, otherwise it takes the first in merge order.
   */
  readonly lastUsed: (keyof Devices & string) | null
}

/** The merged source, for `InputCapture.system(...)`. */
export interface Controls<A extends string, R> extends System.Consumes<"snapshot"> {
  /** Takes every device's snapshot, starting a new press window on each, and merges them. */
  snapshot(): Snapshot<A, DevicesOf<R>>
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
  lacking<D extends Device, const Missing extends ReadonlyArray<Exclude<A, ActionsOf<D>>>>(
    device: D & (
      [Exclude<ActionsOf<D>, A>] extends [never]
        ? [Exclude<A, ActionsOf<D>>] extends [never] ? "This device binds every action: pass it to merge without lacking" : unknown
        : `This device binds ${Exclude<ActionsOf<D>, A>}, which is not one of the actions`
    ),
    lacking: Missing & ([Exclude<A, ActionsOf<D> | Missing[number]>] extends [never] ? unknown : `This device also lacks ${Exclude<A, ActionsOf<D> | Missing[number]>}: bind it, or list it here`)
  ): Lacking<D, Missing[number]>
  /**
   * Merges `devices` into one source. Each binds every declared action, or
   * is passed through {@link lacking}; every action is bound by at least one
   * device. The names given here key `devices`, `lastUsed`, and `rebind`.
   */
  merge<const R extends Readonly<Record<string, Entry>>>(
    devices: { readonly [K in keyof R]: CheckEntry<A, K & string, R[K]> } & EveryActionBound<A, R>
  ): Controls<A, R>
  /**
   * A merged snapshot with nothing held and no device used yet, for
   * initializing the input resource: pass each device's idle snapshot
   * (`Keyboard.idle(...)`, ...) under its merge name.
   */
  idle<const Devices extends Readonly<Record<string, DeviceSnapshot<string>>>>(devices: Devices): Snapshot<A, Devices>
}

const idleState: ActionState = { held: false, pressed: false, released: false }

const isLacking = (entry: Entry): entry is Lacking<Device, string> => (entry as Partial<Lacking<Device, string>>)._tag === "Lacking"

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
    merge(devices) {
      const entries = Object.entries(devices as Readonly<Record<string, Entry>>).map(([name, entry]) =>
        isLacking(entry)
          ? { name, device: entry.device, lacking: new Set<string>(entry.lacking) }
          : { name, device: entry, lacking: new Set<string>() })
      let lastUsed: string | null = null
      const rebind: Record<string, (bindings: never) => void> = {}
      for (const { name, device } of entries) {
        const candidate = (device as Device & { readonly rebind?: unknown }).rebind
        if (typeof candidate === "function") rebind[name] = (bindings) => candidate.call(device, bindings)
      }
      const controls = {
        snapshot() {
          const snapshots: Record<string, DeviceSnapshot<string>> = {}
          for (const { name, device } of entries) snapshots[name] = device.snapshot()
          const used = entries.filter(({ name }) => snapshots[name]!.used)
          if (used.length > 0 && !used.some(({ name }) => name === lastUsed)) lastUsed = used[0]!.name
          const current = entries.find(({ name }) => name === lastUsed)
          const merged: Record<string, ActionState> = {}
          const available: Record<string, boolean> = {}
          for (const action of list) {
            let held = false
            let pressed = false
            let released = false
            for (const { name } of entries) {
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
          for (const { device } of entries) device.dispose()
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
