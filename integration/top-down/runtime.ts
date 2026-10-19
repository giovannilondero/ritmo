import { Keyboard } from "@typeonce/ritmo-browser"

import { pickupLayout } from "./content.ts"
import { Facing, Game, Locomotion } from "./schema.ts"
import { inputBindings } from "./types.ts"
import type { FrameContextValue } from "./types.ts"

export const makeEmptyFocusedCollectable = () => ({
  current: null,
  label: null,
  distance: null
} as const)

export const initialResources = (frame: FrameContextValue) => ({
  DeltaTime: frame.deltaSeconds,
  InputState: Keyboard.idle(inputBindings),
  FocusedCollectable: makeEmptyFocusedCollectable(),
  CollectedCount: 0,
  TotalCollectables: pickupLayout.length
} as const)

export const initialMachines = () =>
  Game.Runtime.machines(
    Game.Runtime.machine(Facing, "Down"),
    Game.Runtime.machine(Locomotion, "Idle")
  )
