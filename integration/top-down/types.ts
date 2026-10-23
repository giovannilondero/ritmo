import { Controls } from "@typeonce/ritmo-browser"
import type { Gamepad, Keyboard, Pointer } from "@typeonce/ritmo-browser"
import type * as Vector2Value from "@typeonce/ritmo-math/Vector2"

export type Vector2 = Vector2Value.Vector2
/** The game's actions, bound on every device below. */
export const Actions = Controls.actions(["up", "down", "left", "right", "interact"])
export const inputBindings = {
  up: ["ArrowUp", "w"],
  down: ["ArrowDown", "s"],
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
  interact: ["e", " "]
} as const
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
/** A click interacts too; the mouse is grouped with the keyboard, so using both is one device in use. */
export const mouseBindings = { interact: ["primary"] } as const
export type MouseInput = Pointer.Actions<typeof mouseBindings>
/** The one input source: keyboard and mouse as one group, and the gamepad, built the same way in the browser and in tests. */
export const makeControls = (devices: { readonly keyboard: KeyboardInput; readonly mouse: MouseInput; readonly gamepad: GamepadInput }) =>
  Actions.merge({ desktop: Actions.group({ keyboard: devices.keyboard, mouse: devices.mouse }), gamepad: devices.gamepad })
export type ControlsValue = ReturnType<typeof makeControls>
export type InputStateValue = ReturnType<ControlsValue["snapshot"]>
/** What one fixed update needs from the host: the step length. */
export type FrameContextValue = {
  readonly deltaSeconds: number
}
