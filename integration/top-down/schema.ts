import { Descriptor, Entity, Schema } from "@typeonce/ritmo"
import * as Size2 from "@typeonce/ritmo-math/Size2"
import * as Vector2 from "@typeonce/ritmo-math/Vector2"

import type {
  FrameContextValue,
  InputStateValue,
  KeyboardInput as KeyboardInputValue
} from "./types.ts"

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
// Captured from the keyboard at the start of each update; never saved.
export const InputState = Descriptor.TransientResource<InputStateValue>()("TopDown/InputState")
export const FocusedCollectable = Descriptor.Resource<FocusedCollectableValue>()("TopDown/FocusedCollectable")
export const CollectedCount = Descriptor.Resource<number>()("TopDown/CollectedCount")
export const TotalCollectables = Descriptor.Resource<number>()("TopDown/TotalCollectables")

export const KeyboardInput = Descriptor.Service<KeyboardInputValue>()("TopDown/KeyboardInput")
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

export const Facing = Game.StateMachine(
  "TopDown/Facing",
  ["Down", "Left", "Right", "Up"]
)

export const Locomotion = Game.StateMachine(
  "TopDown/Locomotion",
  ["Idle", "Walking"]
)
