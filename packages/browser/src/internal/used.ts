import type { ActionState } from "../Keyboard.ts"

/**
 * Whether any action in a snapshot was pressed or is held: the `used` of a
 * device's snapshot. Releases do not count, since a blur or a disconnect
 * releases everything without the player touching the device.
 */
export const anyUsed = (actions: Readonly<Record<string, ActionState>>): boolean => {
  for (const name in actions) {
    const state = actions[name]!
    if (state.held || state.pressed) return true
  }
  return false
}
