import { Descriptor, Entity, Schema } from "@typeonce/ritmo"
import type { InputCapture } from "@typeonce/ritmo-browser"
import * as Size2 from "@typeonce/ritmo-math/Size2"
import * as Vector2 from "@typeonce/ritmo-math/Vector2"

import type { ControlsValue, FrameContextValue } from "./types.ts"

export const Root = Schema.defineRoot("TopDown")

export const Position = Descriptor.ConstructedComponent(Vector2)("TopDown/Position")
export const Velocity = Descriptor.ConstructedComponent(Vector2)("TopDown/Velocity")
export const Collider = Descriptor.ConstructedComponent(Size2)("TopDown/Collider")
export const Player = Descriptor.Component<{}>()("TopDown/Player")
export const Wall = Descriptor.Component<{}>()("TopDown/Wall")
export const Collectable = Descriptor.Component<{
  label: string
  radius: number
}>()("TopDown/Collectable")

export type FocusedCollectableValue = {
  current: Entity.Handle<typeof Root, typeof Collectable> | null
  label: string | null
  distance: number | null
}

export const DeltaTime = Descriptor.Resource<number>()("TopDown/DeltaTime")
export const FocusedCollectable = Descriptor.Resource<FocusedCollectableValue>()("TopDown/FocusedCollectable")
export const CollectedCount = Descriptor.Resource<number>()("TopDown/CollectedCount")
export const TotalCollectables = Descriptor.Resource<number>()("TopDown/TotalCollectables")

/** The keyboard and the gamepad merged into one input source. */
export const ControlsInput = Descriptor.Service<ControlsValue>()("TopDown/Controls")
// Captured from the controls at the start of each update; never saved. Its type is exactly what the source produces.
export const InputState = Descriptor.TransientResource<InputCapture.SnapshotOf<typeof ControlsInput>>()("TopDown/InputState")
export const FrameContext = Descriptor.Service<FrameContextValue>()("TopDown/FrameContext")

export const Game = Schema.bind(
  Schema.fragment({
    components: {
      Position,
      Velocity,
      Collider,
      Player,
      Wall,
      Collectable
    },
    // What each kind of entity always has: spawning a player without a
    // collider does not compile, and Game.System.spawns(Player) allows them.
    requires: [
      Schema.requires(Player, Position, Velocity, Collider),
      Schema.requires(Wall, Position, Collider),
      Schema.requires(Collectable, Position, Collider)
    ],
    resources: {
      DeltaTime,
      InputState,
      FocusedCollectable,
      CollectedCount,
      TotalCollectables
    }
  }),
  Root
)

export const schema = Game.schema

export const Facing = Game.StateMachine("TopDown/Facing", { Down: {}, Left: {}, Right: {}, Up: {} }
)

export const Locomotion = Game.StateMachine("TopDown/Locomotion", { Idle: {}, Walking: {} }
)
