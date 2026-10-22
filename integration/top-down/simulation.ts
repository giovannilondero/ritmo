/**
 * The top-down game without a browser: the simulation schedules on a
 * runtime that needs only a keyboard, a gamepad, and a frame context, with
 * the debug handle attached.
 *
 * Tests, benchmarks, and coding agents drive it directly:
 *
 * ```ts
 * const keyboard = Keyboard.scripted(inputBindings, [{ frame: 0, press: ["right"] }])
 * const gamepad = Gamepad.scripted(padBindings, [])
 * const simulation = createTopDownSimulation({ keyboard, gamepad, hostClock: HostClock.test() })
 * if (simulation.ok) {
 *   simulation.value.runtime.tick(simulation.value.setup)
 *   simulation.value.runtime.tick(simulation.value.update)
 * }
 * ```
 */
import type { HostClock } from "@typeonce/ritmo"
import * as Result from "@typeonce/ritmo/Result"

import { FIXED_STEP_SECONDS } from "./constants.ts"
import { initialMachines, initialResources } from "./runtime.ts"
import { FrameContext, Game, GamepadInput, KeyboardInput } from "./schema.ts"
import { setupWorldSchedule, simulationSchedule } from "./schedules.ts"
import type { FrameContextValue, GamepadInput as GamepadInputValue, KeyboardInput as KeyboardInputValue } from "./types.ts"

export interface TopDownSimulationOptions {
  readonly keyboard: KeyboardInputValue
  /** `Gamepad.actions(window, padBindings)` in a browser, `Gamepad.scripted(padBindings, timeline)` headless. */
  readonly gamepad: GamepadInputValue
  /** Times the debug traces; `HostClock.test()` keeps every timing at 0. Pass the same clock to `Session.make`. */
  readonly hostClock: HostClock.HostClock
  /** Defaults to one fixed step at 60 Hz. */
  readonly frame?: FrameContextValue
}

export const defaultFrameContext: FrameContextValue = {
  deltaSeconds: FIXED_STEP_SECONDS
}

export const createTopDownSimulation = (options: TopDownSimulationOptions) => {
  const frame = options.frame ?? defaultFrameContext
  const made = Game.Runtime.make({
    services: Game.Runtime.services(
      Game.Runtime.service(KeyboardInput, options.keyboard),
      Game.Runtime.service(GamepadInput, options.gamepad),
      Game.Runtime.service(FrameContext, frame)
    ),
    resources: initialResources(frame),
    machines: initialMachines(),
    debug: { hostClock: options.hostClock }
  })
  return Result.match(made, {
    onSuccess: (runtime) => {
      runtime.debug.nameSchedules({ setup: setupWorldSchedule, update: simulationSchedule })
      return Result.success({ runtime, setup: setupWorldSchedule, update: simulationSchedule })
    },
    onFailure: () => Result.failure({ message: "Invalid top-down runtime resources." })
  })
}
