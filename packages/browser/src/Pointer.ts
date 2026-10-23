/**
 * Mouse and pen input over one element: bound actions, raw buttons, and the
 * position. Touches are ignored by default; on-screen touch controls are
 * `Touch`.
 *
 * `Pointer.actions(target, window, bindings)` binds game actions to
 * buttons, like `Keyboard.actions` and `Gamepad.actions`, so the pointer
 * merges into `Controls` (group it with the keyboard there, so the two count
 * as one device for `lastUsed` and `available`). Games that aim with the
 * mouse read `position`. The module owns the browser plumbing:
 * element-relative coordinates, press/release edges that survive clicks
 * shorter than one frame, pointer capture so a release outside the element
 * is still seen, suppressing the context menu, clearing buttons on window
 * blur, and listener cleanup. It does not know about the ECS;
 * `InputCapture.system(...)` copies snapshots into a resource.
 *
 * Positions are in CSS pixels relative to the element's top-left corner.
 * Converting them into world coordinates (camera, zoom, projection) is game
 * code. `rebind(...)` swaps the buttons of the same actions, and
 * `parseRebinding(...)` validates saved ones.
 *
 * @module Pointer
 * @docGroup browser
 *
 * @example
 * ```ts
 * const bindings = { fire: ["primary"], aim: ["secondary"] } as const
 * const mouse = Pointer.actions(canvas, window, bindings)
 *
 * // Once per update (through InputCapture in a game):
 * const input = mouse.snapshot()
 * aimAt(input.position)
 * if (input.actions.fire.pressed) fire()
 *
 * // Settings screen: bind the button the player clicks.
 * const clicked = Pointer.buttonNames.find((button) => input.buttons[button].pressed)
 * if (clicked !== undefined) mouse.rebind({ fire: [clicked], aim: ["secondary"] })
 *
 * // On teardown:
 * mouse.dispose()
 * ```
 *
 * For tests, replays, and headless runs, `scripted(bindings, timeline)`
 * plays a timeline of moves, presses, and releases, and `recording(...)`
 * wraps a live pointer to capture the timeline a session produced.
 * `parseTimeline(...)` validates a timeline loaded from JSON.
 */
import type * as System from "@typeonce/ritmo/System"
import * as Result from "@typeonce/ritmo/Result"

import type { ActionState } from "./Keyboard.ts"
import * as ButtonsInternal from "./internal/buttons.ts"
import { buttonTracker, idleActions, idleButtons } from "./internal/buttons.ts"
import { anyUsed } from "./internal/used.ts"

export type { ActionState }

/**
 * The buttons a snapshot reports, in `PointerEvent.button` order 0 to 4:
 * the main (usually left) button, the wheel button, the secondary (usually
 * right) button, and the side buttons.
 */
export const buttonNames = ["primary", "middle", "secondary", "back", "forward"] as const

/** One pointer button, see {@link buttonNames}. */
export type Button = (typeof buttonNames)[number]

const buttonOf = (code: number): Button | undefined => buttonNames[code]

const buttonSet: ReadonlySet<string> = new Set(buttonNames)

/** Whether `name` is a pointer button, for validating stored bindings. */
export const isButton = (name: unknown): name is Button => typeof name === "string" && buttonSet.has(name)

/**
 * Action name to the buttons that trigger it. Every action needs at least
 * one button; `{}` tracks the position and raw buttons only.
 */
export type Bindings = Readonly<Record<string, readonly [Button, ...Array<Button>]>>

/**
 * New buttons for the same actions, for {@link Actions.rebind}. Load saved
 * ones with {@link parseRebinding}.
 */
export type Rebinding<B extends Bindings> = { readonly [Action in keyof B]: readonly [Button, ...Array<Button>] }

/**
 * Rejects actions a rebinding names that the bindings do not have, so
 * {@link Actions.rebind} takes exactly the actions it was made with.
 */
export type OnlyActionsOf<R, B extends Bindings> = {
  readonly [Name in Exclude<keyof R, keyof B>]: `${Name & string} is not an action of these bindings`
}

/** A position in CSS pixels relative to the element's top-left corner. */
export interface Position {
  readonly x: number
  readonly y: number
}

export interface Snapshot<B extends Bindings> {
  /** Every bound action's state. */
  readonly actions: { readonly [Action in keyof B]: ActionState }
  /** Every button's state by name, whatever the bindings (capture the button to bind from here). */
  readonly buttons: { readonly [Name in Button]: ActionState }
  /** The last position the pointer was seen at, or where it was last left. */
  readonly position: Position
  /** Whether the pointer is currently over the element (or captured by it). */
  readonly over: boolean
  /**
   * Some button was pressed in this window or is held, or the pointer moved
   * over the element: the player is using the pointer.
   */
  readonly used: boolean
}

export interface Actions<B extends Bindings> extends System.Consumes<"snapshot"> {
  /** Returns the pointer state and starts a new press/release window. */
  snapshot(): Snapshot<B>
  /**
   * Binds the same actions to new buttons, from the next snapshot, for a
   * settings screen where players remap controls (capture the button to bind
   * from the snapshot's `buttons`). An action held only through buttons it
   * lost reports `released`; a button held across the rebind holds a newly
   * bound action only once it is pressed again. It takes exactly the actions
   * the pointer was made with.
   */
  rebind<const R extends Rebinding<B>>(bindings: R & OnlyActionsOf<R, B>): void
  /** Removes the event listeners. */
  dispose(): void
}

/**
 * The subset of `PointerEvent` the module reads.
 */
export interface PointerEventLike {
  readonly clientX: number
  readonly clientY: number
  readonly button: number
  readonly pointerId: number
  /** `"mouse"`, `"pen"`, or `"touch"`; events without it count as mouse. */
  readonly pointerType?: string
  preventDefault(): void
}

/**
 * The element the pointer is tracked over, usually the game canvas.
 */
export interface PointerTarget {
  addEventListener(
    type: "pointerdown" | "pointerup" | "pointermove" | "pointerenter" | "pointerleave" | "pointercancel",
    listener: (event: PointerEventLike) => void
  ): void
  addEventListener(type: "contextmenu", listener: (event: { preventDefault(): void }) => void): void
  removeEventListener(
    type: "pointerdown" | "pointerup" | "pointermove" | "pointerenter" | "pointerleave" | "pointercancel",
    listener: (event: PointerEventLike) => void
  ): void
  removeEventListener(type: "contextmenu", listener: (event: { preventDefault(): void }) => void): void
  getBoundingClientRect(): { readonly left: number; readonly top: number }
  setPointerCapture?(pointerId: number): void
  releasePointerCapture?(pointerId: number): void
}

/**
 * Where window blur is observed, usually `window`. Buttons held when the
 * window loses focus are released.
 */
export interface BlurHost {
  addEventListener(type: "blur", listener: () => void): void
  removeEventListener(type: "blur", listener: () => void): void
}

export interface ActionsOptions {
  /**
   * Suppress the context menu over the element, so the secondary button is
   * usable. Defaults to `true`.
   */
  readonly preventContextMenu?: boolean
  /**
   * `PointerEvent.pointerType`s tracked. Defaults to `["mouse", "pen"]`:
   * touches are left to `Touch`, so a finger on an on-screen control is not
   * also a click.
   */
  readonly pointerTypes?: ReadonlyArray<string>
}

/**
 * A snapshot with no buttons down and no use yet, for initializing an input
 * resource before the first capture.
 */
export const idle = <const B extends Bindings>(bindings: B, position: Position = { x: 0, y: 0 }): Snapshot<B> => ({
  actions: idleActions(bindings),
  buttons: idleButtons(buttonNames),
  position: { x: position.x, y: position.y },
  over: false,
  used: false
})

/** The button tracker with the position, shared by live and scripted pointers. */
const tracker = <B extends Bindings>(initial: B, start: Position) => {
  const buttons = buttonTracker(buttonNames, initial)
  let position = start
  let moved = false
  return {
    buttons,
    move(next: Position) {
      if (next.x === position.x && next.y === position.y) return
      position = next
      moved = true
    },
    snapshot(over: boolean): Snapshot<B> {
      const taken = buttons.take()
      const used = moved || anyUsed(taken.buttons)
      moved = false
      return { ...taken, position: { x: position.x, y: position.y }, over, used }
    }
  }
}

/**
 * Starts tracking the pointer over `target` with `bindings`. `blurHost`
 * (usually `window`) releases held buttons when the page loses focus.
 */
export const actions = <const B extends Bindings>(
  target: PointerTarget,
  blurHost: BlurHost,
  bindings: B,
  options: ActionsOptions = {}
): Actions<B> => {
  const preventContextMenu = options.preventContextMenu ?? true
  const pointerTypes = options.pointerTypes ?? ["mouse", "pen"]
  const tracked = (event: PointerEventLike): boolean => pointerTypes.includes(event.pointerType ?? "mouse")
  const state = tracker(bindings, { x: 0, y: 0 })
  let over = false

  const locate = (event: PointerEventLike): void => {
    const rect = target.getBoundingClientRect()
    state.move({ x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  const onDown = (event: PointerEventLike): void => {
    if (!tracked(event)) return
    locate(event)
    over = true
    const button = buttonOf(event.button)
    if (button === undefined) return
    event.preventDefault()
    target.setPointerCapture?.(event.pointerId)
    state.buttons.down(button)
  }

  const onUp = (event: PointerEventLike): void => {
    if (!tracked(event)) return
    locate(event)
    const button = buttonOf(event.button)
    if (button === undefined || !state.buttons.held.has(button)) return
    state.buttons.up(button)
    if (state.buttons.held.size === 0) target.releasePointerCapture?.(event.pointerId)
  }

  const onMove = (event: PointerEventLike): void => {
    if (!tracked(event)) return
    locate(event)
    over = true
  }

  const onLeave = (event: PointerEventLike): void => {
    if (tracked(event)) over = false
  }

  const onCancel = (event: PointerEventLike): void => {
    if (tracked(event)) state.buttons.upAll()
  }

  const onContextMenu = (event: { preventDefault(): void }): void => {
    if (preventContextMenu) event.preventDefault()
  }

  target.addEventListener("pointerdown", onDown)
  target.addEventListener("pointerup", onUp)
  target.addEventListener("pointermove", onMove)
  target.addEventListener("pointerenter", onMove)
  target.addEventListener("pointerleave", onLeave)
  target.addEventListener("pointercancel", onCancel)
  target.addEventListener("contextmenu", onContextMenu)
  blurHost.addEventListener("blur", state.buttons.upAll)

  return {
    snapshot: () => state.snapshot(over),
    rebind: state.buttons.rebind,
    dispose() {
      target.removeEventListener("pointerdown", onDown)
      target.removeEventListener("pointerup", onUp)
      target.removeEventListener("pointermove", onMove)
      target.removeEventListener("pointerenter", onMove)
      target.removeEventListener("pointerleave", onLeave)
      target.removeEventListener("pointercancel", onCancel)
      target.removeEventListener("contextmenu", onContextMenu)
      blurHost.removeEventListener("blur", state.buttons.upAll)
    }
  }
}

/**
 * Pointer changes applied just before one snapshot: the move first, then
 * presses, then releases. `frame` is the snapshot's index, counting from 0 at
 * the first `snapshot()` call. A button both pressed and released in one frame
 * is a click shorter than a frame.
 */
export interface TimelineEntry {
  readonly frame: number
  readonly move?: Position
  readonly press?: ReadonlyArray<Button>
  readonly release?: ReadonlyArray<Button>
}

/**
 * Pointer changes by snapshot index. Plain data, so it round-trips through
 * JSON; load it back with `parseTimeline`. It names buttons, not actions, so
 * a replay follows the bindings as live play does.
 */
export type Timeline = ReadonlyArray<TimelineEntry>

/** A pointer driven by a timeline instead of an element. */
export interface Scripted<B extends Bindings> extends Actions<B> {
  /** Number of snapshots taken so far, which is the next frame index. */
  readonly frames: () => number
}

/**
 * Plays `timeline` with `bindings`: before the snapshot at index `frame`,
 * every entry for that frame is applied. Buttons stay held from their press
 * until their release. The scripted pointer is always over the element.
 */
export const scripted = <const B extends Bindings>(bindings: B, timeline: Timeline, start: Position = { x: 0, y: 0 }): Scripted<B> => {
  const byFrame = new Map<number, Array<TimelineEntry>>()
  for (const entry of timeline) {
    const entries = byFrame.get(entry.frame)
    if (entries) entries.push(entry)
    else byFrame.set(entry.frame, [entry])
  }
  const state = tracker(bindings, start)
  let frame = 0
  return {
    snapshot() {
      for (const entry of byFrame.get(frame) ?? []) {
        if (entry.move !== undefined) state.move(entry.move)
        for (const button of entry.press ?? []) state.buttons.down(button)
        for (const button of entry.release ?? []) state.buttons.up(button)
      }
      frame += 1
      return state.snapshot(true)
    },
    rebind: state.buttons.rebind,
    dispose() {},
    frames: () => frame
  }
}

/** A live pointer that also records the timeline it produces. */
export interface Recording<B extends Bindings> extends Actions<B> {
  /** The recorded timeline; `scripted(bindings, timeline)` replays the same positions and buttons. */
  readonly timeline: () => Timeline
}

/**
 * Wraps `pointer` and records, for every snapshot, the position when it moved
 * and the buttons pressed and released since the previous one.
 */
export const recording = <B extends Bindings>(pointer: Actions<B>): Recording<B> => {
  const entries: Array<TimelineEntry> = []
  let frame = 0
  let last: Position | undefined
  return {
    snapshot() {
      const snapshot = pointer.snapshot()
      const moved = last === undefined || last.x !== snapshot.position.x || last.y !== snapshot.position.y
      last = snapshot.position
      const press = buttonNames.filter((button) => snapshot.buttons[button].pressed)
      const release = buttonNames.filter((button) => snapshot.buttons[button].released)
      if (moved || press.length > 0 || release.length > 0) {
        entries.push({
          frame,
          ...(moved ? { move: snapshot.position } : {}),
          ...(press.length > 0 ? { press } : {}),
          ...(release.length > 0 ? { release } : {})
        })
      }
      frame += 1
      return snapshot
    },
    rebind: (bindings) => pointer.rebind(bindings),
    dispose: () => pointer.dispose(),
    timeline: () => [...entries]
  }
}

/**
 * Why loaded data is not a pointer timeline. `path` points at the offending
 * value, for example `[3].move.x`.
 */
export interface InvalidTimeline {
  readonly _tag: "InvalidTimeline"
  readonly path: string
  readonly message: string
}

/**
 * Validates untrusted data, such as a parsed JSON file, as a pointer
 * timeline: an array of entries with a non-negative integer `frame`, an
 * optional finite `move`, and optional `press`/`release` arrays of buttons.
 */
export const parseTimeline = (data: unknown): Result.Result<Timeline, InvalidTimeline> => {
  const invalid = (path: string, message: string) => Result.failure<InvalidTimeline>({ _tag: "InvalidTimeline", path, message })
  if (!Array.isArray(data)) return invalid("", "expected an array of entries")
  const entries: Array<TimelineEntry> = []
  for (let index = 0; index < data.length; index++) {
    const entry: unknown = data[index]
    const path = `[${index}]`
    if (typeof entry !== "object" || entry === null) return invalid(path, "expected an object")
    const { frame, move, press, release } = entry as {
      readonly frame?: unknown
      readonly move?: unknown
      readonly press?: unknown
      readonly release?: unknown
    }
    if (typeof frame !== "number" || !Number.isInteger(frame) || frame < 0) {
      return invalid(`${path}.frame`, "expected a non-negative integer")
    }
    let position: Position | undefined
    if (move !== undefined) {
      if (typeof move !== "object" || move === null) return invalid(`${path}.move`, "expected an object with x and y")
      const { x, y } = move as { readonly x?: unknown; readonly y?: unknown }
      if (typeof x !== "number" || !Number.isFinite(x)) return invalid(`${path}.move.x`, "expected a finite number")
      if (typeof y !== "number" || !Number.isFinite(y)) return invalid(`${path}.move.y`, "expected a finite number")
      position = { x, y }
    }
    const buttonsAt = (value: unknown, field: string): Result.Result<Array<Button> | undefined, InvalidTimeline> => {
      if (value === undefined) return Result.success(undefined)
      if (!Array.isArray(value)) return invalid(`${path}.${field}`, "expected an array of buttons")
      const names: Array<Button> = []
      for (let offset = 0; offset < value.length; offset++) {
        const name: unknown = value[offset]
        if (!isButton(name)) return invalid(`${path}.${field}[${offset}]`, `expected one of ${buttonNames.join(", ")}`)
        names.push(name)
      }
      return Result.success(names)
    }
    const pressed = buttonsAt(press, "press")
    if (!pressed.ok) return pressed
    const released = buttonsAt(release, "release")
    if (!released.ok) return released
    entries.push({
      frame,
      ...(position === undefined ? {} : { move: position }),
      ...(pressed.value === undefined ? {} : { press: pressed.value }),
      ...(released.value === undefined ? {} : { release: released.value })
    })
  }
  return Result.success(entries)
}

/**
 * Why loaded data is not a rebinding for the bindings. `path` points at the
 * offending value, for example `fire[1]`.
 */
export type InvalidRebinding = ButtonsInternal.InvalidRebinding

/**
 * Validates untrusted data, such as saved settings parsed from JSON, as new
 * buttons for `bindings`: an object with exactly the same action names, each
 * mapped to a non-empty array of button names. Pass the result to
 * {@link Actions.rebind}; on failure, keep the defaults.
 *
 * @example
 * ```ts
 * const saved = Pointer.parseRebinding(bindings, JSON.parse(stored))
 * if (saved.ok) mouse.rebind(saved.value)
 * ```
 */
export const parseRebinding = <const B extends Bindings>(
  bindings: B,
  data: unknown
): Result.Result<Rebinding<B>, InvalidRebinding> =>
  // The checked names and buttons are exactly `Rebinding<B>`.
  ButtonsInternal.parseButtonRebinding(buttonNames, bindings, data) as Result.Result<Rebinding<B>, InvalidRebinding>
