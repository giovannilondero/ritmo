// The browser host for the top-down game: the page's keyboard and gamepad,
// the fixed-step loop on animation frames, and a Pixi canvas. The rules come
// unchanged from integration/top-down, the same schedules its tests run.
import { Clock } from "@typeonce/ritmo"
import * as FixedLoop from "@typeonce/ritmo/FixedLoop"
import { BrowserTickSource, Gamepad, Keyboard, Pointer } from "@typeonce/ritmo-browser"
import { PixiNodeRegistry } from "@typeonce/ritmo-pixi"
import { WORLD_HEIGHT, WORLD_WIDTH } from "@typeonce/ritmo-integration-top-down/constants.ts"
import { initialMachines, initialResources } from "@typeonce/ritmo-integration-top-down/runtime.ts"
import { setupWorldSchedule, simulationSchedule } from "@typeonce/ritmo-integration-top-down/schedules.ts"
import { CollectedCount, ControlsInput, FocusedCollectable, FrameContext, Game, TotalCollectables } from "@typeonce/ritmo-integration-top-down/schema.ts"
import { inputBindings, makeControls, mouseBindings, padBindings } from "@typeonce/ritmo-integration-top-down/types.ts"
import { Application, Container, Graphics } from "pixi.js"
import type { Container as ContainerType } from "pixi.js"

import { colors } from "./colors.ts"
import { PickupNodes, PlayerNodes, renderSchedule, WallNodes } from "./render.ts"

const step = Clock.hz(60)

/** What the page shows over the canvas, read from the world after each frame. */
export interface Hud {
  readonly collected: number
  readonly total: number
  readonly focused: string | null
}

const ReadHud = Game.Inspector("TopDown/ReadHud", {
  resources: {
    collected: Game.System.readResource(CollectedCount),
    total: Game.System.readResource(TotalCollectables),
    focused: Game.System.readResource(FocusedCollectable)
  }
}, ({ resources }): Hud => ({
  collected: resources.collected.get(),
  total: resources.total.get(),
  focused: resources.focused.get().label
}))

const layer = (parent: ContainerType): Container<Graphics> => {
  const child = new Container<Graphics>()
  parent.addChild(child)
  return child
}

const drawFloor = (): Graphics => {
  const floor = new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(colors.floor)
  for (let x = 100; x < WORLD_WIDTH; x += 100) floor.moveTo(x, 0).lineTo(x, WORLD_HEIGHT)
  for (let y = 100; y < WORLD_HEIGHT; y += 100) floor.moveTo(0, y).lineTo(WORLD_WIDTH, y)
  return floor.stroke({ color: colors.grid, width: 2 })
}

/** The readout over the canvas: parts found, and what is in reach. */
const makeHud = (host: HTMLElement) => {
  const hud = document.createElement("div")
  hud.className = "hud"
  const count = document.createElement("span")
  const focus = document.createElement("span")
  focus.className = "accent"
  hud.append(count, focus)
  host.append(hud)
  return (state: Hud) => {
    const done = state.collected === state.total
    count.textContent = done ? `All ${state.total} parts found` : `${state.collected} / ${state.total} parts`
    focus.textContent = state.focused === null || done ? "" : `E: pick up ${state.focused}`
  }
}

/**
 * Starts the game in `host` and returns the function that stops it. The
 * world is scaled to fit the host, whatever its size.
 */
export const mount = async (host: HTMLElement): Promise<() => void> => {
  const onHud = makeHud(host)
  const app = new Application()
  await app.init({ resizeTo: host, background: colors.background, antialias: true, autoDensity: true, resolution: window.devicePixelRatio })
  host.append(app.canvas)

  const world = new Container()
  app.stage.addChild(world)
  world.addChild(drawFloor())
  const walls = layer(world)
  const pickups = layer(world)
  const players = layer(world)

  const fit = () => {
    const scale = Math.min(app.screen.width / WORLD_WIDTH, app.screen.height / WORLD_HEIGHT)
    world.scale.set(scale)
    world.position.set((app.screen.width - WORLD_WIDTH * scale) / 2, (app.screen.height - WORLD_HEIGHT * scale) / 2)
  }
  fit()
  app.renderer.on("resize", fit)

  const keyboard = Keyboard.actions(window, inputBindings)
  const mouse = Pointer.actions(app.canvas, window, mouseBindings)
  const gamepad = Gamepad.actions(window, padBindings)
  const frame = { deltaSeconds: step.dt }

  const made = Game.Runtime.make({
    services: Game.Runtime.services(
      Game.Runtime.service(ControlsInput, makeControls({ keyboard, mouse, gamepad })),
      Game.Runtime.service(FrameContext, frame),
      Game.Runtime.service(WallNodes, PixiNodeRegistry.make(walls)),
      Game.Runtime.service(PickupNodes, PixiNodeRegistry.make(pickups)),
      Game.Runtime.service(PlayerNodes, PixiNodeRegistry.make(players))
    ),
    resources: initialResources(frame),
    machines: initialMachines()
  })

  const dispose = () => {
    keyboard.dispose()
    mouse.dispose()
    gamepad.dispose()
    app.destroy(true, { children: true })
  }

  if (!made.ok) {
    dispose()
    throw new Error("The top-down runtime could not start.")
  }
  const runtime = made.value
  const setup = runtime.tick(setupWorldSchedule)
  if (!setup.ok) console.error(setup.error)

  const loop = FixedLoop.start({
    source: BrowserTickSource.make(window),
    step,
    maxFrameSeconds: 0.25,
    maxStepsPerFrame: 5,
    update: () => runtime.tick(simulationSchedule),
    render: () => {
      const drawn = runtime.tick(renderSchedule)
      if (!drawn.ok) console.error(drawn.error)
      onHud(runtime.inspect(ReadHud))
    },
    onFailure: (failure) => console.error(failure)
  })

  return () => {
    if (loop.ok) loop.value.stop()
    dispose()
  }
}
