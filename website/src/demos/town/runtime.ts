// The town's starting world, and the headless simulation the check drives.
import type { HostClock } from "@typeonce/ritmo"
import { Clock } from "@typeonce/ritmo"
import { Gamepad, Keyboard, Touch } from "@typeonce/ritmo-browser"
import * as Random from "@typeonce/ritmo-math/Random"

import { Game, leftKeys, makePlayers, Mode, padBindings, Players, PlayersInput, rightKeys, step, touchButtons } from "./schema.ts"
import { setupSchedule, updateSchedule } from "./schedules.ts"

/** Every resource's first value; the same for the browser and the check. */
export const initialResources = () => ({
  Time: Clock.start(step),
  Rng: Random.seed(0x7017),
  Input: Players.idle({ left: Keyboard.idle(leftKeys), right: Keyboard.idle(rightKeys), pads: Gamepad.idle(padBindings), touch: Touch.idle({ buttons: touchButtons }) }),
  Dialogue: null
} as const)

export const initialMachines = () => Game.Runtime.machines(Game.Runtime.machine(Mode, "Exploring"))

/**
 * The town without a page: scripted devices, the debug handle on, and the
 * two schedules. `check.ts` drives it; the browser host builds the same
 * world with live devices and the render services.
 */
export const createTownSimulation = (devices: {
  /** WASD: the first to press a key joins as p1. */
  readonly left: Keyboard.Actions<typeof leftKeys>
  /** Arrows; idle when the check plays alone. */
  readonly right?: Keyboard.Actions<typeof rightKeys>
  readonly hostClock: HostClock.HostClock
}) => {
  const made = Game.Runtime.make({
    services: Game.Runtime.services(Game.Runtime.service(PlayersInput, makePlayers({
      left: devices.left,
      right: devices.right ?? Keyboard.scripted(rightKeys, []),
      pads: Gamepad.scriptedPads(padBindings, []),
      touch: Touch.scripted({ buttons: touchButtons }, [])
    }))),
    resources: initialResources(),
    machines: initialMachines(),
    debug: { hostClock: devices.hostClock }
  })
  if (made.ok) made.value.debug.nameSchedules({ setup: setupSchedule, update: updateSchedule })
  return made
}
