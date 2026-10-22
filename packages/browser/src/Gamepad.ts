/**
 * Gamepad input as caller-named actions, plus the sticks and triggers.
 *
 * Games bind actions to buttons once and read one snapshot per update, as
 * with `Keyboard`. The module owns the plumbing every game rewrites: polling
 * (the Gamepad API has no button events), press/release edges, a radial dead
 * zone on the sticks, following the pad that was used last when several are
 * connected, and releasing everything held when a pad disconnects. It does
 * not know about the ECS; `InputCapture.system(...)` copies snapshots from a
 * service into a resource.
 *
 * Buttons are named by their place in the browser's standard mapping
 * (`"south"` is A on Xbox, Cross on PlayStation, B on Nintendo), so bindings
 * stay the same on every pad. A pad whose `mapping` is not `"standard"` is
 * read by the same indices, which may not match its labels: let players
 * remap (`rebind`). The snapshot also reports every `button` by name,
 * whatever the bindings, for fixed menu navigation and for a settings screen
 * that waits for the button to bind; `parseRebinding(...)` validates
 * bindings saved as JSON.
 *
 * The Gamepad API has no button events, so the pads are read on every
 * animation frame and on every `snapshot()`; a tap that starts and ends
 * between two updates still counts. Browsers expose a pad only after
 * a button is pressed on it, and only in a secure context (HTTPS or
 * localhost); elsewhere `navigator.getGamepads` is missing, and a game uses
 * `scripted(bindings, [])` as an idle stand-in.
 *
 * @module Gamepad
 * @docGroup browser
 *
 * @example
 * ```ts
 * const pad = Gamepad.actions(window, {
 *   attack: ["west"],
 *   dash: ["south"],
 *   pause: ["start"]
 * })
 *
 * // Once per update:
 * const snapshot = pad.snapshot()
 * move(snapshot.left)
 * if (snapshot.actions.attack.pressed) attack()
 *
 * // In a settings screen, rebinding keeps the action names:
 * pad.rebind({ attack: ["north"], dash: ["south"], pause: ["start"] })
 * ```
 *
 * For tests, replays, and headless runs, `scripted(...)` plays a timeline of
 * button presses, releases, and stick moves instead of polling a host, and
 * `recording(...)` wraps live actions to capture the timeline a session
 * produced. `parseTimeline(...)` validates a timeline loaded from JSON.
 */
import * as Result from "@typeonce/ritmo/Result"

import type * as BrowserTickSource from "./BrowserTickSource.ts"
import type { ActionState } from "./Keyboard.ts"

/**
 * The buttons of the browser's standard mapping, in index order: face
 * buttons by compass position, bumpers and triggers, the two small center
 * buttons, the stick clicks, the d-pad, and the home button.
 */
export const buttonNames = [
  "south",
  "east",
  "west",
  "north",
  "leftBumper",
  "rightBumper",
  "leftTrigger",
  "rightTrigger",
  "select",
  "start",
  "leftStick",
  "rightStick",
  "dpadUp",
  "dpadDown",
  "dpadLeft",
  "dpadRight",
  "home"
] as const

/** One button of the standard mapping, see {@link buttonNames}. */
export type Button = (typeof buttonNames)[number]

/**
 * Action name to the buttons that trigger it. Every action needs at least
 * one button.
 */
export type Bindings = Readonly<Record<string, readonly [Button, ...Array<Button>]>>

/**
 * New buttons for the same actions, for {@link Actions.rebind}. Load saved
 * ones with {@link parseRebinding}.
 */
export type Rebinding<B extends Bindings> = { readonly [Action in keyof B]: readonly [Button, ...Array<Button>] }

/** One button's reading, the subset of the browser's `GamepadButton` the module reads. */
export interface ButtonReading {
  readonly pressed: boolean
  readonly value: number
}

/** One pad's reading, the subset of the browser's `Gamepad` the module reads. */
export interface PadReading {
  readonly id: string
  readonly index: number
  readonly connected: boolean
  readonly mapping: string
  readonly buttons: ReadonlyArray<ButtonReading>
  readonly axes: ReadonlyArray<number>
}

/** Where pads are read from, the subset of the browser's `navigator` the module reads. */
export interface GamepadNavigator {
  getGamepads(): ReadonlyArray<PadReading | null>
}

/**
 * What live actions need from the window: the pads, and animation frames to
 * read them on, since the Gamepad API has no button events.
 */
export interface GamepadHost extends BrowserTickSource.Host {
  readonly navigator: GamepadNavigator
}

/** A stick's tilt with the dead zone removed: zero at rest, length 1 at full tilt. `y` grows down, as on screen. */
export interface Vector {
  readonly x: number
  readonly y: number
}

export interface Snapshot<B extends Bindings> {
  /** Every bound action's state. */
  readonly actions: { readonly [Action in keyof B]: ActionState }
  /** Every button's state by name, whatever the bindings. */
  readonly buttons: { readonly [Name in Button]: ActionState }
  readonly left: Vector
  readonly right: Vector
  /** How far each trigger is pulled, 0 to 1. */
  readonly leftTrigger: number
  readonly rightTrigger: number
  /** Whether a pad is being followed. */
  readonly connected: boolean
  /** The followed pad's `id` (it names the maker, for button labels), or `null`. */
  readonly id: string | null
}

/**
 * Rejects actions a rebinding names that the bindings do not have, so
 * {@link Actions.rebind} takes exactly the actions it was made with.
 */
export type OnlyActionsOf<R, B extends Bindings> = {
  readonly [Name in Exclude<keyof R, keyof B>]: `${Name & string} is not an action of these bindings`
}

export interface Actions<B extends Bindings> {
  /** Returns the input state and starts a new press/release window. */
  snapshot(): Snapshot<B>
  /**
   * Binds the same actions to new buttons, from the next snapshot, for a
   * settings screen where players remap controls (capture the button to bind
   * from the snapshot's `buttons`). An action held only through buttons it
   * lost reports `released`. A button held across the rebind holds a newly
   * bound action only once it is pressed again, so an action never turns
   * held without a press. It takes exactly the actions the source was made
   * with.
   */
  rebind<const R extends Rebinding<B>>(bindings: R & OnlyActionsOf<R, B>): void
  /** Stops reading pads and cancels the animation frame. */
  dispose(): void
}

export interface ActionsOptions {
  /** Fraction of a stick's tilt that reads as zero. Defaults to 0.15. */
  readonly deadZone?: number
  /** How far a trigger is pulled before it counts as held. Defaults to 0.5. */
  readonly triggerThreshold?: number
}

const idleState: ActionState = { held: false, pressed: false, released: false }
const zero: Vector = { x: 0, y: 0 }

const idleButtons = (): Snapshot<Bindings>["buttons"] => {
  const buttons = {} as Record<Button, ActionState>
  for (const name of buttonNames) buttons[name] = idleState
  return buttons
}

/**
 * A snapshot with nothing held and no pad, for initializing an input
 * resource before the first capture.
 */
export const idle = <const B extends Bindings>(bindings: B): Snapshot<B> => {
  const actions = {} as Record<keyof B, ActionState>
  for (const name of Object.keys(bindings) as Array<keyof B>) actions[name] = idleState
  return { actions, buttons: idleButtons() as Snapshot<B>["buttons"], left: zero, right: zero, leftTrigger: 0, rightTrigger: 0, connected: false, id: null }
}

/** Removes the dead zone and rescales, so the stick goes from zero to full tilt smoothly. */
const stick = (x: number, y: number, deadZone: number): Vector => {
  const length = Math.sqrt(x * x + y * y)
  if (length <= deadZone) return zero
  const scaled = Math.min(1, (length - deadZone) / (1 - deadZone))
  return { x: (x / length) * scaled, y: (y / length) * scaled }
}

/**
 * The held buttons and the edges since the previous snapshot, shared by live
 * and scripted actions so both build snapshots the same way.
 */
const tracker = <B extends Bindings>(initial: B) => {
  // Fixed at creation: a rebind swaps buttons, never the actions.
  const names = Object.keys(initial) as Array<keyof B & string>
  let bindings: Rebinding<B> = initial
  const actionsByButton = new Map<Button, Array<keyof B & string>>()
  const index = (): void => {
    actionsByButton.clear()
    for (const name of names) {
      for (const button of bindings[name]!) {
        const bound = actionsByButton.get(button)
        if (bound) bound.push(name)
        else actionsByButton.set(button, [name])
      }
    }
  }
  index()
  const held = new Set<Button>()
  const pressed = new Set<Button>()
  const released = new Set<Button>()
  /**
   * Each held button and the actions it holds: those bound to it when it
   * went down that are still bound to it.
   */
  const holding = new Map<Button, Set<keyof B & string>>()
  const pressedActions = new Set<keyof B>()
  const releasedActions = new Set<keyof B>()
  const isHeld = (name: keyof B & string): boolean => bindings[name]!.some((button) => holding.get(button)?.has(name) === true)
  const up = (button: Button): void => {
    if (!held.delete(button)) return
    released.add(button)
    for (const name of holding.get(button) ?? []) releasedActions.add(name)
    holding.delete(button)
  }
  return {
    held,
    down(button: Button) {
      if (held.has(button)) return
      held.add(button)
      pressed.add(button)
      const bound = actionsByButton.get(button) ?? []
      holding.set(button, new Set(bound))
      for (const name of bound) pressedActions.add(name)
    },
    up,
    upAll() {
      for (const button of [...held]) up(button)
    },
    rebind(next: Rebinding<B>) {
      const before = names.filter(isHeld)
      bindings = next
      index()
      // A held button keeps only the actions still bound to it; new ones wait for a fresh press.
      for (const [button, actions] of holding) {
        const bound = actionsByButton.get(button) ?? []
        for (const name of actions) if (!bound.includes(name)) actions.delete(name)
      }
      for (const name of before) if (!isHeld(name)) releasedActions.add(name)
    },
    snapshot(analog: Pick<Snapshot<B>, "left" | "right" | "leftTrigger" | "rightTrigger" | "connected" | "id">): Snapshot<B> {
      const buttons = {} as Record<Button, ActionState>
      for (const name of buttonNames) {
        const isDown = held.has(name)
        buttons[name] = isDown || pressed.has(name) || released.has(name)
          ? { held: isDown, pressed: pressed.has(name), released: released.has(name) && !isDown }
          : idleState
      }
      const actions = {} as Record<keyof B, ActionState>
      for (const name of names) {
        const isDown = isHeld(name)
        actions[name] = { held: isDown, pressed: pressedActions.has(name), released: releasedActions.has(name) && !isDown }
      }
      pressed.clear()
      released.clear()
      pressedActions.clear()
      releasedActions.clear()
      return { actions, buttons, ...analog }
    }
  }
}

/** Whether a pad is being touched: a button down or a stick past the dead zone. */
const inUse = (pad: PadReading, deadZone: number, triggerThreshold: number): boolean =>
  pad.buttons.some((button, index) => isDown(button, index, triggerThreshold)) ||
  // Only the sticks' axes: some pads report their triggers as extra axes resting at -1.
  pad.axes.slice(0, 4).some((axis) => Math.abs(axis) > deadZone)

const triggerIndices = new Set([6, 7])

const isDown = (button: ButtonReading, index: number, triggerThreshold: number): boolean =>
  triggerIndices.has(index) ? button.value >= triggerThreshold : button.pressed

/** Reads the pads, treating a host that throws (a blocked permission policy) as having none. */
const readPads = (host: GamepadHost): ReadonlyArray<PadReading | null> => {
  try {
    return host.navigator.getGamepads()
  } catch {
    return []
  }
}

/**
 * Starts reading pads from `host`, usually `window`, on every animation
 * frame until `dispose()`. With several pads connected it follows the one
 * used last; a pad that disconnects releases everything it held.
 */
export const actions = <const B extends Bindings>(host: GamepadHost, bindings: B, options: ActionsOptions = {}): Actions<B> => {
  const deadZone = options.deadZone ?? 0.15
  const triggerThreshold = options.triggerThreshold ?? 0.5
  const state = tracker(bindings)
  let followed: number | null = null
  let disposed = false
  let reading: PadReading | null = null
  let frame = 0

  const poll = (): void => {
    if (disposed) return
    const pads = readPads(host).filter((pad): pad is PadReading => pad !== null && pad.connected)
    const current = pads.find((pad) => pad.index === followed)
    // Keep the followed pad while it is in use; otherwise switch to another one being used, or keep the first there is.
    const used = current !== undefined && inUse(current, deadZone, triggerThreshold)
      ? current
      : pads.find((pad) => pad.index !== followed && inUse(pad, deadZone, triggerThreshold))
    const next = used ?? current ?? pads[0]
    if (next?.index !== followed) state.upAll()
    followed = next?.index ?? null
    reading = next ?? null
    if (next === undefined) return
    for (let index = 0; index < buttonNames.length; index++) {
      const button = next.buttons[index]
      const name = buttonNames[index]!
      if (button !== undefined && isDown(button, index, triggerThreshold)) state.down(name)
      else state.up(name)
    }
  }

  const onFrame = (): void => {
    if (disposed) return
    poll()
    frame = host.requestAnimationFrame(onFrame)
  }
  frame = host.requestAnimationFrame(onFrame)

  return {
    snapshot() {
      poll()
      const pad = reading
      if (pad === null) return state.snapshot({ left: zero, right: zero, leftTrigger: 0, rightTrigger: 0, connected: false, id: null })
      const axis = (index: number) => pad.axes[index] ?? 0
      const trigger = (index: number) => Math.min(1, Math.max(0, pad.buttons[index]?.value ?? 0))
      return state.snapshot({
        left: stick(axis(0), axis(1), deadZone),
        right: stick(axis(2), axis(3), deadZone),
        leftTrigger: trigger(6),
        rightTrigger: trigger(7),
        connected: true,
        id: pad.id
      })
    },
    rebind: state.rebind,
    dispose() {
      if (disposed) return
      disposed = true
      host.cancelAnimationFrame(frame)
      reading = null
      state.upAll()
    }
  }
}

/**
 * Input changes applied just before one snapshot: the buttons, then the
 * sticks and triggers, which keep their value until set again, then
 * `connected`. `frame` is the snapshot's index, counting from 0 at the first
 * `snapshot()` call. A button in both `press` and `release` changed twice
 * within the frame: a tap shorter than a frame when it was up, a release and
 * a new press when it was held.
 */
export interface TimelineEntry {
  readonly frame: number
  /**
   * Connects or disconnects the pad from this frame on. The first entry
   * connects it unless it says otherwise. A disconnect releases every held
   * button and zeroes the sticks and triggers, as with a live pad.
   */
  readonly connected?: boolean
  readonly press?: ReadonlyArray<Button>
  readonly release?: ReadonlyArray<Button>
  readonly left?: Vector
  readonly right?: Vector
  readonly leftTrigger?: number
  readonly rightTrigger?: number
}

/**
 * Input changes by snapshot index. Plain data, so it round-trips through
 * JSON; load it back with `parseTimeline`. It names buttons, not actions, so
 * a replay follows the bindings as live play does.
 */
export type Timeline = ReadonlyArray<TimelineEntry>

/** Actions driven by a timeline instead of a host. */
export interface Scripted<B extends Bindings> extends Actions<B> {
  /** Number of snapshots taken so far, which is the next frame index. */
  readonly frames: () => number
}

/**
 * Plays `timeline`: before the snapshot at index `frame`, every entry for
 * that frame is applied. A pad counts as connected from the first entry on,
 * until an entry says `connected: false`.
 * Buttons stay held from their press until their release; pressing a held
 * button is not a new press.
 */
export const scripted = <const B extends Bindings>(bindings: B, timeline: Timeline): Scripted<B> => {
  const state = tracker(bindings)
  const byFrame = new Map<number, Array<TimelineEntry>>()
  for (const entry of timeline) {
    const entries = byFrame.get(entry.frame)
    if (entries) entries.push(entry)
    else byFrame.set(entry.frame, [entry])
  }
  const first = timeline.reduce((earliest, entry) => Math.min(earliest, entry.frame), Number.POSITIVE_INFINITY)
  const resting = { left: zero, right: zero, leftTrigger: 0, rightTrigger: 0 }
  let analog = resting
  let connected = false
  let frame = 0
  return {
    snapshot() {
      for (const entry of byFrame.get(frame) ?? []) {
        const releases = new Set(entry.release ?? [])
        for (const button of entry.press ?? []) {
          if (state.held.has(button) && releases.has(button)) {
            // Released and pressed again within the frame.
            releases.delete(button)
            state.up(button)
          }
          state.down(button)
        }
        for (const button of releases) state.up(button)
        analog = {
          left: entry.left ?? analog.left,
          right: entry.right ?? analog.right,
          leftTrigger: entry.leftTrigger ?? analog.leftTrigger,
          rightTrigger: entry.rightTrigger ?? analog.rightTrigger
        }
        connected = entry.connected ?? (frame === first ? true : connected)
        if (!connected) {
          state.upAll()
          analog = resting
        }
      }
      frame += 1
      return state.snapshot({ ...analog, connected, id: connected ? "scripted" : null })
    },
    rebind: state.rebind,
    dispose() {},
    frames: () => frame
  }
}

/** Live actions that also record the timeline they produce. */
export interface Recording<B extends Bindings> extends Actions<B> {
  /** The recorded timeline; `scripted(bindings, timeline)` replays it exactly. */
  readonly timeline: () => Timeline
}

const sameVector = (a: Vector, b: Vector): boolean => a.x === b.x && a.y === b.y

/**
 * Wraps `actions` and records, for every snapshot, the buttons pressed and
 * released since the previous one and the sticks and triggers that moved.
 */
export const recording = <B extends Bindings>(actions: Actions<B>): Recording<B> => {
  const entries: Array<TimelineEntry> = []
  let previous: Omit<Snapshot<B>, "actions" | "id"> = { buttons: idleButtons(), left: zero, right: zero, leftTrigger: 0, rightTrigger: 0, connected: false }
  let frame = 0
  return {
    snapshot() {
      const snapshot = actions.snapshot()
      const press = buttonNames.filter((name) => snapshot.buttons[name].pressed)
      // A press of a button held at the previous snapshot means it was released in between.
      const release = buttonNames.filter((name) => snapshot.buttons[name].released || (snapshot.buttons[name].pressed && previous.buttons[name].held))
      const entry: Record<string, unknown> = {
        ...(press.length > 0 ? { press } : {}),
        ...(release.length > 0 ? { release } : {}),
        ...(sameVector(snapshot.left, previous.left) ? {} : { left: snapshot.left }),
        ...(sameVector(snapshot.right, previous.right) ? {} : { right: snapshot.right }),
        ...(snapshot.leftTrigger === previous.leftTrigger ? {} : { leftTrigger: snapshot.leftTrigger }),
        ...(snapshot.rightTrigger === previous.rightTrigger ? {} : { rightTrigger: snapshot.rightTrigger }),
        // The first entry connects the pad by itself; later changes are written out.
        ...(snapshot.connected === previous.connected || entries.length === 0 ? {} : { connected: snapshot.connected })
      }
      // The first entry also marks when a pad appeared, so a replay connects on the same frame.
      if (Object.keys(entry).length > 0 || (entries.length === 0 && snapshot.connected)) entries.push({ frame, ...entry })
      previous = snapshot
      frame += 1
      return snapshot
    },
    rebind: (bindings) => actions.rebind(bindings),
    dispose: () => actions.dispose(),
    timeline: () => [...entries]
  }
}

/**
 * Why loaded data is not a timeline. `path` points at the offending value,
 * for example `[3].press[0]`.
 */
export interface InvalidTimeline {
  readonly _tag: "InvalidTimeline"
  readonly path: string
  readonly message: string
}

const buttonSet: ReadonlySet<string> = new Set(buttonNames)

/** Whether `name` is a button of the standard mapping, for validating stored bindings. */
export const isButton = (name: unknown): name is Button => typeof name === "string" && buttonSet.has(name)

/**
 * Validates untrusted data, such as a parsed JSON file, as a timeline: an
 * array of entries with a non-negative integer `frame`, optional
 * `press`/`release` arrays of button names, optional `left`/`right` vectors
 * of length at most 1, optional triggers from 0 to 1, and an optional
 * boolean `connected`.
 */
export const parseTimeline = (data: unknown): Result.Result<Timeline, InvalidTimeline> => {
  const invalid = (path: string, message: string) => Result.failure<InvalidTimeline>({ _tag: "InvalidTimeline", path, message })
  if (!Array.isArray(data)) return invalid("", "expected an array of entries")
  const entries: Array<TimelineEntry> = []
  for (let index = 0; index < data.length; index++) {
    const entry: unknown = data[index]
    const path = `[${index}]`
    if (typeof entry !== "object" || entry === null) return invalid(path, "expected an object")
    const fields = entry as Readonly<Record<string, unknown>>
    const frame = fields["frame"]
    if (typeof frame !== "number" || !Number.isInteger(frame) || frame < 0) return invalid(`${path}.frame`, "expected a non-negative integer")
    const parsed: Record<string, unknown> = { frame }
    for (const field of ["press", "release"] as const) {
      const value = fields[field]
      if (value === undefined) continue
      if (!Array.isArray(value)) return invalid(`${path}.${field}`, "expected an array of button names")
      for (let offset = 0; offset < value.length; offset++) {
        if (!isButton(value[offset])) return invalid(`${path}.${field}[${offset}]`, `expected one of ${buttonNames.join(", ")}`)
      }
      parsed[field] = [...value]
    }
    for (const field of ["left", "right"] as const) {
      const value = fields[field]
      if (value === undefined) continue
      const { x, y } = (typeof value === "object" && value !== null ? value : {}) as { readonly x?: unknown; readonly y?: unknown }
      if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y) || x * x + y * y > 1 + 1e-9) {
        return invalid(`${path}.${field}`, "expected { x, y } of length at most 1")
      }
      parsed[field] = { x, y }
    }
    for (const field of ["leftTrigger", "rightTrigger"] as const) {
      const value = fields[field]
      if (value === undefined) continue
      if (typeof value !== "number" || !(value >= 0 && value <= 1)) return invalid(`${path}.${field}`, "expected a number from 0 to 1")
      parsed[field] = value
    }
    const connected = fields["connected"]
    if (connected !== undefined) {
      if (typeof connected !== "boolean") return invalid(`${path}.connected`, "expected a boolean")
      parsed["connected"] = connected
    }
    entries.push(parsed as unknown as TimelineEntry)
  }
  return Result.success(entries)
}

/**
 * Why loaded data is not a rebinding for the bindings. `path` points at the
 * offending value, for example `attack[1]`.
 */
export interface InvalidRebinding {
  readonly _tag: "InvalidRebinding"
  readonly path: string
  readonly message: string
}

/**
 * Validates untrusted data, such as saved settings parsed from JSON, as new
 * buttons for `bindings`: an object with exactly the same action names, each
 * mapped to a non-empty array of button names. Pass the result to
 * {@link Actions.rebind}; on failure, keep the defaults.
 *
 * @example
 * ```ts
 * const saved = Gamepad.parseRebinding(bindings, JSON.parse(stored))
 * if (saved.ok) pad.rebind(saved.value)
 * ```
 */
export const parseRebinding = <const B extends Bindings>(
  bindings: B,
  data: unknown
): Result.Result<Rebinding<B>, InvalidRebinding> => {
  const invalid = (path: string, message: string) => Result.failure<InvalidRebinding>({ _tag: "InvalidRebinding", path, message })
  if (typeof data !== "object" || data === null || Array.isArray(data)) return invalid("", "expected an object of action names")
  const fields = data as Readonly<Record<string, unknown>>
  const names = Object.keys(bindings)
  for (const name of Object.keys(fields)) {
    if (!names.includes(name)) return invalid(name, `unknown action, expected one of ${names.join(", ")}`)
  }
  const rebinding: Record<string, ReadonlyArray<Button>> = {}
  for (const name of names) {
    const value = fields[name]
    if (!Array.isArray(value) || value.length === 0) return invalid(name, "expected a non-empty array of button names")
    for (let offset = 0; offset < value.length; offset++) {
      if (!isButton(value[offset])) return invalid(`${name}[${offset}]`, `expected one of ${buttonNames.join(", ")}`)
    }
    rebinding[name] = [...value]
  }
  return Result.success(rebinding as unknown as Rebinding<B>)
}
