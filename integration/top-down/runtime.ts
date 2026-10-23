import { Gamepad, Keyboard, Pointer } from "@typeonce/ritmo-browser"

import { pickupLayout } from "./content.ts"
import { Facing, Game, Locomotion } from "./schema.ts"
import { Actions, inputBindings, mouseBindings, padBindings } from "./types.ts"
import type { FrameContextValue } from "./types.ts"

export const makeEmptyFocusedCollectable = () => ({
  current: null,
  label: null,
  distance: null
} as const)

export const initialResources = (frame: FrameContextValue) => ({
  DeltaTime: frame.deltaSeconds,
  InputState: Actions.idle({ keyboard: Keyboard.idle(inputBindings), mouse: Pointer.idle(mouseBindings), gamepad: Gamepad.idle(padBindings) }),
  FocusedCollectable: makeEmptyFocusedCollectable(),
  CollectedCount: 0,
  TotalCollectables: pickupLayout.length
} as const)

export const initialMachines = () =>
  Game.Runtime.machines(
    Game.Runtime.machine(Facing, "Down"),
    Game.Runtime.machine(Locomotion, "Idle")
  )
