// The town's starting world, and the headless simulation the check drives.
import type { HostClock } from "@typeonce/ritmo"
import { Clock } from "@typeonce/ritmo"
import { Gamepad, Keyboard, Touch } from "@typeonce/ritmo-browser"
import * as Random from "@typeonce/ritmo-math/Random"

import { Actions, ControlsInput, Game, keyBindings, makeControls, Mode, padBindings, step, touchButtons } from "./schema.ts"
import { setupSchedule, updateSchedule } from "./schedules.ts"

/** Every resource's first value; the same for the browser and the check. */
export const initialResources = () => ({
  Time: Clock.start(step),
  Rng: Random.seed(0x7017),
  Input: Actions.idle({ keyboard: Keyboard.idle(keyBindings), gamepad: Gamepad.idle(padBindings), touch: Touch.idle(touchButtons) }),
  Dialogue: null
} as const)

export const initialMachines = () => Game.Runtime.machines(Game.Runtime.machine(Mode, "Exploring"))

/**
 * The town without a page: scripted devices, the debug handle on, and the
 * two schedules. `check.ts` drives it; the browser host builds the same
 * world with live devices and the render services.
 */
export const createTownSimulation = (devices: {
  readonly keyboard: Keyboard.Actions<typeof keyBindings>
  readonly hostClock: HostClock.HostClock
}) => {
  const made = Game.Runtime.make({
    services: Game.Runtime.services(Game.Runtime.service(ControlsInput, makeControls({
      keyboard: devices.keyboard,
      gamepad: Gamepad.scripted(padBindings, []),
      touch: Touch.scripted(touchButtons, [])
    }))),
    resources: initialResources(),
    machines: initialMachines(),
    debug: { hostClock: devices.hostClock }
  })
  if (made.ok) made.value.debug.nameSchedules({ setup: setupSchedule, update: updateSchedule })
  return made
}
