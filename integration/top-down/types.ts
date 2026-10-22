import type { Gamepad, Keyboard } from "@typeonce/ritmo-browser"
import type * as Vector2Value from "@typeonce/ritmo-math/Vector2"

export type Vector2 = Vector2Value.Vector2
export const inputBindings = {
  up: ["ArrowUp", "w"],
  down: ["ArrowDown", "s"],
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
  interact: ["e", " "]
} as const
export type InputStateValue = Keyboard.Snapshot<typeof inputBindings>
export type KeyboardInput = Keyboard.Actions<typeof inputBindings>
/** The same actions on a controller: the d-pad walks (the left stick too, see `normalizeMovement`), south interacts. */
export const padBindings = {
  up: ["dpadUp"],
  down: ["dpadDown"],
  left: ["dpadLeft"],
  right: ["dpadRight"],
  interact: ["south"]
} as const
export type GamepadInput = Gamepad.Actions<typeof padBindings>
/** What one fixed update needs from the host: the step length. */
export type FrameContextValue = {
  readonly deltaSeconds: number
}
