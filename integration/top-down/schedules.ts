import {
  CaptureFrameContextSystem,
  CaptureInputSystem,
  CollectFocusedCollectableSystem,
  MovePlayerSystem,
  PlanPlayerVelocitySystem,
  ResolveFacingSystem,
  ResolveLocomotionSystem,
  SetupWorldSystem,
  UpdateFocusedCollectableSystem
} from "./systems/index.ts"
import { Game } from "./schema.ts"

/** Spawns the player, the walls, and the pickups. */
export const setupWorldSchedule = Game.Schedule(
  SetupWorldSystem,
  Game.Schedule.applyDeferred()
)

/** One fixed update. It needs only the keyboard and the frame context, so it runs headless (see `simulation.ts`). */
export const simulationSchedule = Game.Schedule(
  CaptureFrameContextSystem,
  CaptureInputSystem,
  PlanPlayerVelocitySystem,
  MovePlayerSystem,
  UpdateFocusedCollectableSystem,
  CollectFocusedCollectableSystem,
  ResolveFacingSystem,
  ResolveLocomotionSystem,
  Game.Schedule.applyDeferred(),
  Game.Schedule.applyStateTransitions()
)
