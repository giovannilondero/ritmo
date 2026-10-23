import * as Result from "@typeonce/ritmo/Result"

import type { ActionState } from "../Keyboard.ts"

const idleState: ActionState = { held: false, pressed: false, released: false }

/** Action name to the buttons that trigger it, for a device with named buttons. */
type ButtonBindings<Button extends string> = Readonly<Record<string, readonly [Button, ...Array<Button>]>>

/**
 * The held buttons, the bound actions, and the edges since the previous
 * take, shared by devices with named buttons (`Gamepad`, `Pointer`) and by
 * their live and scripted forms, so all of them build snapshots the same way.
 */
export const buttonTracker = <Button extends string, B extends ButtonBindings<Button>>(
  buttonNames: ReadonlyArray<Button>,
  initial: B
) => {
  // Fixed at creation: a rebind swaps buttons, never the actions.
  const names = Object.keys(initial) as Array<keyof B & string>
  let bindings: Readonly<Record<keyof B, ReadonlyArray<Button>>> = initial
  const actionsByButton = new Map<Button, Array<keyof B & string>>()
  const index = (): void => {
    actionsByButton.clear()
    for (const name of names) {
      for (const button of bindings[name]) {
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
  const isHeld = (name: keyof B & string): boolean => bindings[name].some((button) => holding.get(button)?.has(name) === true)
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
    rebind(next: Readonly<Record<keyof B, ReadonlyArray<Button>>>) {
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
    /** The buttons and actions since the previous take; starts a new press/release window. */
    take(): { readonly actions: Record<keyof B, ActionState>; readonly buttons: Record<Button, ActionState> } {
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
      return { actions, buttons }
    }
  }
}

/** Every button idle, by name. */
export const idleButtons = <Button extends string>(buttonNames: ReadonlyArray<Button>): Record<Button, ActionState> => {
  const buttons = {} as Record<Button, ActionState>
  for (const name of buttonNames) buttons[name] = idleState
  return buttons
}

/** Every action of `bindings` idle. */
export const idleActions = <B extends object>(bindings: B): Record<keyof B, ActionState> => {
  const actions = {} as Record<keyof B, ActionState>
  for (const name of Object.keys(bindings) as Array<keyof B>) actions[name] = idleState
  return actions
}

/** Why loaded data is not a rebinding; the devices export it under their own name. */
export interface InvalidRebinding {
  readonly _tag: "InvalidRebinding"
  readonly path: string
  readonly message: string
}

/**
 * Validates `data` as new buttons for exactly the actions of `bindings`:
 * an object with the same action names, each a non-empty array of button
 * names.
 */
export const parseButtonRebinding = <Button extends string>(
  buttonNames: ReadonlyArray<Button>,
  bindings: object,
  data: unknown
): Result.Result<Readonly<Record<string, ReadonlyArray<Button>>>, InvalidRebinding> => {
  const invalid = (path: string, message: string) => Result.failure<InvalidRebinding>({ _tag: "InvalidRebinding", path, message })
  if (typeof data !== "object" || data === null || Array.isArray(data)) return invalid("", "expected an object of action names")
  const fields = data as Readonly<Record<string, unknown>>
  const names = Object.keys(bindings)
  for (const name of Object.keys(fields)) {
    if (!names.includes(name)) return invalid(name, `unknown action, expected one of ${names.join(", ")}`)
  }
  const known: ReadonlySet<string> = new Set(buttonNames)
  const rebinding: Record<string, ReadonlyArray<Button>> = {}
  for (const name of names) {
    const value = fields[name]
    if (!Array.isArray(value) || value.length === 0) return invalid(name, "expected a non-empty array of button names")
    for (let offset = 0; offset < value.length; offset++) {
      if (!known.has(value[offset])) return invalid(`${name}[${offset}]`, `expected one of ${buttonNames.join(", ")}`)
    }
    rebinding[name] = [...value]
  }
  return Result.success(rebinding)
}
