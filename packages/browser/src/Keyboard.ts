/**
 * Keyboard input as caller-named actions.
 *
 * Games bind actions to keys once and read one snapshot per update. The
 * module owns the browser plumbing every game rewrites: key normalization,
 * `preventDefault` for bound keys, press/release edges that survive taps
 * shorter than one frame, clearing on window blur, and listener cleanup. It
 * does not know about the ECS; `InputCapture.system(...)` copies snapshots
 * from a service into a resource.
 *
 * Bind by character (`"w"`) or by physical key (`Keyboard.code("KeyW")`);
 * see {@link KeyBinding}. A key released while a modifier changed its
 * character (W pressed, then Option, then W released as "∑") still releases
 * its action.
 *
 * Some combinations never reach the page: browsers reserve shortcuts such as
 * Ctrl+W / Cmd+W (close tab), Ctrl+T / Cmd+T, and Cmd+Q, and pages cannot
 * prevent them. Avoid Ctrl and Cmd as held modifiers in games.
 *
 * @module Keyboard
 * @docGroup browser
 *
 * @example
 * ```ts
 * const input = Keyboard.actions(window, {
 *   left: ["ArrowLeft", "a"],
 *   right: ["ArrowRight", "d"],
 *   jump: [" ", "ArrowUp", "w"]
 * })
 *
 * // Once per update:
 * const snapshot = input.snapshot()
 * if (snapshot.jump.pressed) jump()
 *
 * // On teardown:
 * input.dispose()
 * ```
 *
 * For a controls settings screen, `presses(...)` reports every key that
 * goes down (bound or not) so the screen can wait for the key to bind,
 * `rebind(...)` swaps the keys of the same actions, and `parseRebinding(...)`
 * validates bindings saved as JSON.
 *
 * For tests, replays, and headless runs, `scripted(...)` plays a timeline of
 * presses and releases instead of listening to a host, and `recording(...)`
 * wraps live actions to capture the timeline a session produced.
 * `parseTimeline(...)` validates a timeline loaded from JSON.
 *
 * @example
 * ```ts
 * // Browser: record a session, then save `recorder.timeline()` as JSON.
 * const recorder = Keyboard.recording(Keyboard.actions(window, bindings))
 *
 * // Node: replay it frame by frame.
 * const parsed = Keyboard.parseTimeline(bindings, JSON.parse(saved))
 * if (parsed._tag === "Success") {
 *   const replay = Keyboard.scripted(bindings, parsed.success)
 * }
 * ```
 */
import * as Result from "@typeonce/ritmo/Result"

/**
 * The subset of `KeyboardEvent` the module reads. `code` (the physical key)
 * is optional so simple test hosts can omit it; browsers always provide it.
 */
export interface KeyEvent {
  readonly key: string
  readonly code?: string
  readonly repeat: boolean
  preventDefault(): void
}

/**
 * The event target the module listens on, usually `window`.
 */
export interface KeyboardHost {
  addEventListener(type: "keydown" | "keyup", listener: (event: KeyEvent) => void): void
  addEventListener(type: "blur", listener: () => void): void
  removeEventListener(type: "keydown" | "keyup", listener: (event: KeyEvent) => void): void
  removeEventListener(type: "blur", listener: () => void): void
}

/**
 * A key matched by physical position (`KeyboardEvent.code`, for example
 * `"KeyW"`, `"Digit1"`, `"ShiftLeft"`), whatever character it types. Build it
 * with {@link code}.
 */
export interface PhysicalKey {
  readonly code: string
}

/**
 * One key that triggers an action: a `KeyboardEvent.key` value (the
 * character typed; single characters match case-insensitively) or a
 * {@link PhysicalKey}.
 *
 * Character bindings follow the keyboard layout and are what a menu should
 * show. Physical bindings keep a position fixed: WASD stays under the left
 * hand on AZERTY keyboards, and modifiers cannot change the match (with
 * Option held on macOS, W types "∑"; with Shift, 1 types "!").
 */
export type KeyBinding = string | PhysicalKey

/**
 * Action name to the keys that trigger it. Every action needs at least one
 * key.
 */
export type Bindings = Readonly<Record<string, readonly [KeyBinding, ...Array<KeyBinding>]>>

/**
 * A binding to a physical key by its `KeyboardEvent.code`.
 *
 * @example
 * ```ts
 * const bindings = {
 *   up: [Keyboard.code("KeyW")],
 *   jump: [Keyboard.code("Space")]
 * } as const
 * ```
 */
export const code = <const Code extends string>(code: Code): PhysicalKey & { readonly code: Code } => ({ code })

/**
 * One action's state in a snapshot.
 */
export interface ActionState {
  /** At least one bound key is down now. */
  readonly held: boolean
  /** A bound key went down since the previous snapshot, even if already released. */
  readonly pressed: boolean
  /** A bound key went up since the previous snapshot and none is held now. */
  readonly released: boolean
}

export type Snapshot<B extends Bindings> = {
  readonly [Action in keyof B]: ActionState
}

/**
 * New keys for the same actions, for {@link Actions.rebind}. Load saved
 * ones with {@link parseRebinding}.
 */
export type Rebinding<B extends Bindings> = { readonly [Action in keyof B]: readonly [KeyBinding, ...Array<KeyBinding>] }

/**
 * Rejects actions a rebinding names that the bindings do not have, so
 * {@link Actions.rebind} takes exactly the actions it was made with.
 */
export type OnlyActionsOf<R, B extends Bindings> = {
  readonly [Name in Exclude<keyof R, keyof B>]: `${Name & string} is not an action of these bindings`
}

export interface Actions<B extends Bindings> {
  /**
   * Returns every action's state and starts a new press/release window.
   */
  snapshot(): Snapshot<B>
  /**
   * Binds the same actions to new keys, from the next snapshot, for a
   * settings screen where players remap controls (capture the key to bind
   * with {@link presses}). An action held only through keys it lost reports
   * `released`. A key held across the rebind holds a newly bound action only
   * once it is pressed again, so an action never turns held without a
   * press. It takes exactly the actions the source was made with.
   */
  rebind<const R extends Rebinding<B>>(bindings: R & OnlyActionsOf<R, B>): void
  /**
   * Removes the event listeners.
   */
  dispose(): void
}

export interface ActionsOptions {
  /**
   * Call `preventDefault()` for bound keys, so arrows and space do not scroll
   * the page. Defaults to `true`.
   */
  readonly preventDefault?: boolean
}

/**
 * A snapshot with every action idle, for initializing an input resource
 * before the first capture.
 */
export const idle = <const B extends Bindings>(bindings: B): Snapshot<B> => {
  const snapshot = {} as Record<keyof B, ActionState>
  for (const name of Object.keys(bindings) as Array<keyof B>) {
    snapshot[name] = { held: false, pressed: false, released: false }
  }
  return snapshot
}

const normalize = (key: string): string => key.length === 1 ? key.toLowerCase() : key

/** One internal lookup token per binding: characters and physical codes never collide. */
const keyToken = (key: string): string => `key:${normalize(key)}`
const codeToken = (code: string): string => `code:${code}`
const bindingToken = (binding: KeyBinding): string => typeof binding === "string" ? keyToken(binding) : codeToken(binding.code)

/**
 * Starts tracking bound keys on `host`.
 */
export const actions = <const B extends Bindings>(
  host: KeyboardHost,
  initial: B,
  options: ActionsOptions = {}
): Actions<B> => {
  const preventDefault = options.preventDefault ?? true
  // Fixed at creation: a rebind swaps keys, never the actions.
  const names = Object.keys(initial) as Array<keyof B & string>
  let bindings: Rebinding<B> = initial
  const actionsByToken = new Map<string, Array<keyof B & string>>()
  const index = (): void => {
    actionsByToken.clear()
    for (const name of names) {
      for (const binding of bindings[name]!) {
        const token = bindingToken(binding)
        const bound = actionsByToken.get(token)
        if (bound) bound.push(name)
        else actionsByToken.set(token, [name])
      }
    }
  }
  index()

  /**
   * Each held token and the actions it holds: those bound to it when it went
   * down that are still bound to it. A token stays here while held even if a
   * rebind unbound it, so its release is still seen.
   */
  const heldTokens = new Map<string, Set<keyof B & string>>()
  /**
   * The character token each physical key produced when it went down, so its
   * release matches even if a modifier changed the character meanwhile
   * (W pressed, Option pressed, W released as "∑").
   */
  const keyTokenByCode = new Map<string, string>()
  const pressed = new Set<keyof B>()
  const released = new Set<keyof B>()

  const onKeyDown = (event: KeyEvent): void => {
    const tokens = [keyToken(event.key)]
    if (event.code !== undefined) {
      if (!keyTokenByCode.has(event.code)) keyTokenByCode.set(event.code, tokens[0]!)
      tokens.push(codeToken(event.code))
    }
    let handled = false
    for (const token of tokens) {
      const bound = actionsByToken.get(token)
      if (!bound) continue
      handled = true
      if (event.repeat || heldTokens.has(token)) continue
      heldTokens.set(token, new Set(bound))
      for (const name of bound) pressed.add(name)
    }
    if (handled && preventDefault) event.preventDefault()
  }

  const onKeyUp = (event: KeyEvent): void => {
    const tokens = [keyToken(event.key)]
    if (event.code !== undefined) {
      const downAs = keyTokenByCode.get(event.code)
      keyTokenByCode.delete(event.code)
      if (downAs !== undefined) tokens[0] = downAs
      tokens.push(codeToken(event.code))
    }
    for (const token of tokens) {
      const holding = heldTokens.get(token)
      if (!holding) continue
      heldTokens.delete(token)
      for (const name of holding) released.add(name)
    }
  }

  const onBlur = (): void => {
    for (const holding of heldTokens.values()) {
      for (const name of holding) released.add(name)
    }
    heldTokens.clear()
    keyTokenByCode.clear()
  }

  host.addEventListener("keydown", onKeyDown)
  host.addEventListener("keyup", onKeyUp)
  host.addEventListener("blur", onBlur)

  const isHeld = (name: keyof B & string): boolean => {
    for (const binding of bindings[name]!) {
      if (heldTokens.get(bindingToken(binding))?.has(name)) return true
    }
    return false
  }

  return {
    snapshot() {
      const snapshot = {} as Record<keyof B, ActionState>
      for (const name of names) {
        const held = isHeld(name)
        snapshot[name] = {
          held,
          pressed: pressed.has(name),
          released: released.has(name) && !held
        }
      }
      pressed.clear()
      released.clear()
      return snapshot
    },
    rebind(next) {
      const before = names.filter(isHeld)
      bindings = next
      index()
      // A held key keeps only the actions still bound to it; new ones wait for a fresh press.
      for (const [token, holding] of heldTokens) {
        const bound = actionsByToken.get(token) ?? []
        for (const name of holding) if (!bound.includes(name)) holding.delete(name)
      }
      for (const name of before) if (!isHeld(name)) released.add(name)
    },
    dispose() {
      host.removeEventListener("keydown", onKeyDown)
      host.removeEventListener("keyup", onKeyUp)
      host.removeEventListener("blur", onBlur)
    }
  }
}

/** One key that went down, in the two forms a {@link KeyBinding} can name it. */
export interface KeyPress {
  /** The character typed (`KeyboardEvent.key`), for a character binding. */
  readonly key: string
  /** The physical key (`KeyboardEvent.code`), for `Keyboard.code(...)`; `null` when the host gave none. */
  readonly code: string | null
}

/** Every key press on a host, bound or not; see {@link presses}. */
export interface Presses {
  /** The keys that went down since the previous snapshot, in order, without auto-repeats. */
  snapshot(): ReadonlyArray<KeyPress>
  /** Removes the event listener. */
  dispose(): void
}

/**
 * Starts collecting every key press on `host`, whatever the bindings, for a
 * settings screen that waits for the key to bind. Use {@link actions} for
 * gameplay. It never calls `preventDefault()`.
 *
 * @example
 * ```ts
 * const presses = Keyboard.presses(window)
 *
 * // While the settings screen waits for the new jump key:
 * const press = presses.snapshot()[0]
 * if (press !== undefined) {
 *   input.rebind({ ...current, jump: [press.code === null ? press.key : Keyboard.code(press.code)] })
 * }
 * ```
 */
export const presses = (host: KeyboardHost): Presses => {
  let pending: Array<KeyPress> = []
  const onKeyDown = (event: KeyEvent): void => {
    if (event.repeat) return
    pending.push({ key: event.key, code: event.code ?? null })
  }
  host.addEventListener("keydown", onKeyDown)
  return {
    snapshot() {
      const snapshot = pending
      pending = []
      return snapshot
    },
    dispose() {
      host.removeEventListener("keydown", onKeyDown)
    }
  }
}

/**
 * Input changes applied just before one snapshot. `frame` is the snapshot's
 * index, counting from 0 at the first `snapshot()` call. An action in both
 * `press` and `release` changed twice within the frame: a tap shorter than a
 * frame when it was up, a release and a new press when it was held.
 */
export interface TimelineEntry<B extends Bindings> {
  readonly frame: number
  readonly press?: ReadonlyArray<keyof B & string>
  readonly release?: ReadonlyArray<keyof B & string>
}

/**
 * Input changes by snapshot index. Plain data, so it round-trips through
 * JSON; load it back with `parseTimeline`.
 */
export type Timeline<B extends Bindings> = ReadonlyArray<TimelineEntry<B>>

/**
 * Actions driven by a timeline instead of a host.
 */
export interface Scripted<B extends Bindings> extends Actions<B> {
  /** Number of snapshots taken so far, which is the next frame index. */
  readonly frames: () => number
}

/**
 * Plays `timeline`: before the snapshot at index `frame`, every entry for
 * that frame is applied. Actions stay held from their press until their
 * release, like keys; pressing an action already held is not a new press.
 */
export const scripted = <const B extends Bindings>(bindings: B, timeline: Timeline<B>): Scripted<B> => {
  const names = Object.keys(bindings) as Array<keyof B & string>
  const byFrame = new Map<number, Array<TimelineEntry<B>>>()
  for (const entry of timeline) {
    const entries = byFrame.get(entry.frame)
    if (entries) entries.push(entry)
    else byFrame.set(entry.frame, [entry])
  }
  const held = new Set<keyof B>()
  let frame = 0
  return {
    snapshot() {
      const pressed = new Set<keyof B>()
      const released = new Set<keyof B>()
      for (const entry of byFrame.get(frame) ?? []) {
        const releases = new Set(entry.release ?? [])
        for (const name of entry.press ?? []) {
          if (held.has(name) && releases.has(name)) {
            // Released and pressed again within the frame.
            releases.delete(name)
            released.add(name)
            pressed.add(name)
            continue
          }
          // A press of a held action is not a new press, as with a live
          // keyboard's auto-repeat.
          if (!held.has(name)) pressed.add(name)
          held.add(name)
        }
        for (const name of releases) {
          if (held.delete(name)) released.add(name)
        }
      }
      frame += 1
      const snapshot = {} as Record<keyof B, ActionState>
      for (const name of names) {
        const isHeld = held.has(name)
        snapshot[name] = { held: isHeld, pressed: pressed.has(name), released: released.has(name) && !isHeld }
      }
      return snapshot
    },
    // A timeline names actions, not keys, so new keys change nothing.
    rebind() {},
    dispose() {},
    frames: () => frame
  }
}

/**
 * Live actions that also record the timeline they produce.
 */
export interface Recording<B extends Bindings> extends Actions<B> {
  /** The recorded timeline; `scripted(bindings, timeline)` replays it exactly. */
  readonly timeline: () => Timeline<B>
}

/**
 * Wraps `actions` and records, for every snapshot, the actions pressed and
 * released since the previous one.
 */
export const recording = <B extends Bindings>(actions: Actions<B>): Recording<B> => {
  const entries: Array<TimelineEntry<B>> = []
  let wasHeld = new Set<keyof B & string>()
  let frame = 0
  return {
    snapshot() {
      const snapshot = actions.snapshot()
      const press: Array<keyof B & string> = []
      const release: Array<keyof B & string> = []
      const held = new Set<keyof B & string>()
      for (const name of Object.keys(snapshot) as Array<keyof B & string>) {
        const state = snapshot[name]!
        if (state.held) held.add(name)
        if (state.pressed) press.push(name)
        // A press of an action held at the previous snapshot means it was released in between.
        if (state.released || (state.pressed && wasHeld.has(name))) release.push(name)
      }
      wasHeld = held
      if (press.length > 0 || release.length > 0) {
        entries.push({
          frame,
          ...(press.length > 0 ? { press } : {}),
          ...(release.length > 0 ? { release } : {})
        })
      }
      frame += 1
      return snapshot
    },
    rebind(bindings) {
      actions.rebind(bindings)
    },
    dispose() {
      actions.dispose()
    },
    timeline: () => [...entries]
  }
}

/**
 * Why loaded data is not a timeline for the bindings. `path` points at the
 * offending value, for example `[3].press[0]`.
 */
export interface InvalidTimeline {
  readonly _tag: "InvalidTimeline"
  readonly path: string
  readonly message: string
}

/**
 * Validates untrusted data, such as a parsed JSON file, as a timeline for
 * `bindings`: an array of entries with a non-negative integer `frame` and
 * optional `press`/`release` arrays of bound action names.
 */
export const parseTimeline = <const B extends Bindings>(
  bindings: B,
  data: unknown
): Result.Result<Timeline<B>, InvalidTimeline> => {
  const invalid = (path: string, message: string) => Result.fail<InvalidTimeline>({ _tag: "InvalidTimeline", path, message })
  if (!Array.isArray(data)) return invalid("", "expected an array of entries")
  const entries: Array<TimelineEntry<B>> = []
  for (let index = 0; index < data.length; index++) {
    const entry: unknown = data[index]
    const path = `[${index}]`
    if (typeof entry !== "object" || entry === null) return invalid(path, "expected an object")
    const { frame, press, release } = entry as { readonly frame?: unknown; readonly press?: unknown; readonly release?: unknown }
    if (typeof frame !== "number" || !Number.isInteger(frame) || frame < 0) {
      return invalid(`${path}.frame`, "expected a non-negative integer")
    }
    const actionsAt = (value: unknown, field: string): Result.Result<Array<keyof B & string> | undefined, InvalidTimeline> => {
      if (value === undefined) return Result.succeed(undefined)
      if (!Array.isArray(value)) return invalid(`${path}.${field}`, "expected an array of action names")
      const names: Array<keyof B & string> = []
      for (let offset = 0; offset < value.length; offset++) {
        const name: unknown = value[offset]
        if (typeof name !== "string" || !Object.prototype.hasOwnProperty.call(bindings, name)) {
          return invalid(`${path}.${field}[${offset}]`, `expected one of ${Object.keys(bindings).join(", ")}`)
        }
        names.push(name)
      }
      return Result.succeed(names)
    }
    const pressed = actionsAt(press, "press")
    if (pressed._tag === "Failure") return pressed
    const released = actionsAt(release, "release")
    if (released._tag === "Failure") return released
    entries.push({
      frame,
      ...(pressed.success === undefined ? {} : { press: pressed.success }),
      ...(released.success === undefined ? {} : { release: released.success })
    })
  }
  return Result.succeed(entries)
}

/**
 * Why loaded data is not a rebinding for the bindings. `path` points at the
 * offending value, for example `jump[1]`.
 */
export interface InvalidRebinding {
  readonly _tag: "InvalidRebinding"
  readonly path: string
  readonly message: string
}

/**
 * Validates untrusted data, such as saved settings parsed from JSON, as new
 * keys for `bindings`: an object with exactly the same action names, each
 * mapped to a non-empty array of characters or `{ code }` physical keys.
 * Pass the result to {@link Actions.rebind}; on failure, keep the defaults.
 *
 * @example
 * ```ts
 * const saved = Keyboard.parseRebinding(bindings, JSON.parse(stored))
 * if (saved._tag === "Success") input.rebind(saved.success)
 * ```
 */
export const parseRebinding = <const B extends Bindings>(
  bindings: B,
  data: unknown
): Result.Result<Rebinding<B>, InvalidRebinding> => {
  const invalid = (path: string, message: string) => Result.fail<InvalidRebinding>({ _tag: "InvalidRebinding", path, message })
  if (typeof data !== "object" || data === null || Array.isArray(data)) return invalid("", "expected an object of action names")
  const fields = data as Readonly<Record<string, unknown>>
  const names = Object.keys(bindings)
  for (const name of Object.keys(fields)) {
    if (!names.includes(name)) return invalid(name, `unknown action, expected one of ${names.join(", ")}`)
  }
  const rebinding: Record<string, ReadonlyArray<KeyBinding>> = {}
  for (const name of names) {
    const value = fields[name]
    if (!Array.isArray(value) || value.length === 0) return invalid(name, "expected a non-empty array of keys")
    const keys: Array<KeyBinding> = []
    for (let offset = 0; offset < value.length; offset++) {
      const key: unknown = value[offset]
      if (typeof key === "string" && key.length > 0) keys.push(key)
      else if (typeof key === "object" && key !== null && typeof (key as { readonly code?: unknown }).code === "string" && (key as PhysicalKey).code.length > 0) {
        keys.push({ code: (key as PhysicalKey).code })
      } else return invalid(`${name}[${offset}]`, "expected a key character or { code }")
    }
    rebinding[name] = keys
  }
  return Result.succeed(rebinding as unknown as Rebinding<B>)
}
