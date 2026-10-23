// The browser host for the town: loads the art, reads the keyboard, a
// gamepad, and on-screen touch buttons, runs the fixed-step loop on
// animation frames, and draws with Pixi at a whole-number pixel scale. The
// rules are the headless ones `check.ts` drives.
import * as FixedLoop from "@typeonce/ritmo/FixedLoop"
import { BrowserTickSource, Gamepad, Keyboard, Touch } from "@typeonce/ritmo-browser"
import { PixiNodeRegistry } from "@typeonce/ritmo-pixi"
import { Application, Container, Graphics, ImageSource, Sprite, Texture } from "pixi.js"

import boyWalk from "./assets/BoyWalk.png"
import dialogBox from "./assets/DialogBox.png"
import inspectorWalk from "./assets/InspectorWalk.png"
import monkWalk from "./assets/MonkWalk.png"
import fontUrl from "./assets/NormalFont.ttf?url"
import oldManWalk from "./assets/OldManWalk.png"
import shadow from "./assets/Shadow.png"
import tilesetElement from "./assets/TilesetElement.png"
import tilesetFloor from "./assets/TilesetFloor.png"
import tilesetFloorDetail from "./assets/TilesetFloorDetail.png"
import tilesetHouse from "./assets/TilesetHouse.png"
import tilesetNature from "./assets/TilesetNature.png"
import tilesetWater from "./assets/TilesetWater.png"
import type { Images } from "./render.ts"
import { ActorNode, ActorNodes, Art, Camera, drawMap, FONT_FAMILY, makeArt, makeCamera, makeDialogBox, PropNodes, renderSchedule, VIEW_HEIGHT, VIEW_WIDTH } from "./render.ts"
import { initialMachines, initialResources } from "./runtime.ts"
import { ControlsInput, Game, keyBindings, makeControls, padBindings, step, touchButtons } from "./schema.ts"
import { setupSchedule, updateSchedule } from "./schedules.ts"
import { ReadScreen } from "./view.ts"

/** Loads one image as a texture sampled by nearest pixel, so pixel art stays sharp when scaled. */
const loadTexture = async (src: string): Promise<Texture> => {
  const image = new Image()
  image.src = src
  await image.decode()
  return new Texture({ source: new ImageSource({ resource: image, scaleMode: "nearest" }) })
}

/** Loads every image of a table, keeping its keys. */
const loadAll = async <K extends string>(sources: Readonly<Record<K, { readonly src: string }>>): Promise<Record<K, Texture>> => {
  const keys = Object.keys(sources) as Array<K>
  const textures = await Promise.all(keys.map((key) => loadTexture(sources[key].src)))
  return Object.fromEntries(keys.map((key, index) => [key, textures[index]])) as Record<K, Texture>
}

const loadImages = async (): Promise<Images> => {
  const [sheets, walk, ui] = await Promise.all([
    loadAll({ floor: tilesetFloor, floorDetail: tilesetFloorDetail, water: tilesetWater, nature: tilesetNature, house: tilesetHouse, element: tilesetElement }),
    loadAll({ boy: boyWalk, oldMan: oldManWalk, inspector: inspectorWalk, monk: monkWalk }),
    loadAll({ shadow, dialogBox })
  ])
  return { sheets, walk, shadow: ui.shadow, dialogBox: ui.dialogBox }
}

/** On a touch screen: a d-pad of four buttons at the bottom left and the A button at the bottom right, in CSS pixels. */
const touchLayout = ({ width, height }: Touch.Size): Touch.Layout<(typeof touchButtons)[number]> => {
  const pad = { x: 96, y: height - 104 }
  const a = { x: width - 84, y: height - 104 }
  return {
    // No stick: the d-pad buttons are the directions.
    stick: { region: { left: 0, top: 0, width: 0, height: 0 }, radius: 1 },
    buttons: {
      up: { center: { x: pad.x, y: pad.y - 46 }, radius: 28 },
      down: { center: { x: pad.x, y: pad.y + 46 }, radius: 28 },
      left: { center: { x: pad.x - 46, y: pad.y }, radius: 28 },
      right: { center: { x: pad.x + 46, y: pad.y }, radius: 28 },
      action: { center: a, radius: 38 }
    }
  }
}

/** Draws the touch buttons from the live touch view; reading it consumes nothing. */
const drawTouch = (graphics: Graphics, view: Touch.View<(typeof touchButtons)[number]>) => {
  graphics.clear()
  for (const name of touchButtons) {
    const zone = view.layout.buttons[name]
    const held = view.buttons[name].held
    graphics.circle(zone.center.x, zone.center.y, zone.radius).fill({ color: 0x0e1013, alpha: held ? 0.55 : 0.3 })
      .stroke({ color: 0xf3f1ec, alpha: held ? 0.9 : 0.45, width: 2 })
  }
  const a = view.layout.buttons.action.center
  graphics.circle(a.x, a.y, 9).fill({ color: 0xf3f1ec, alpha: 0.6 })
}

/**
 * Starts the town in `host` and returns the function that stops it. The
 * 240 x 160 screen is scaled by the largest whole number that fits the host.
 */
export const mount = async (host: HTMLElement): Promise<() => void> => {
  const font = new FontFace(FONT_FAMILY, `url(${fontUrl})`)
  const [images] = await Promise.all([loadImages(), font.load()])
  document.fonts.add(font)
  const art = makeArt(images)

  const app = new Application()
  await app.init({ resizeTo: host, background: 0x0e1013, antialias: false, autoDensity: true, resolution: window.devicePixelRatio, roundPixels: true })
  host.append(app.canvas)
  app.canvas.style.imageRendering = "pixelated"

  // The screen: a masked 240 x 160 view of the scrolling world, and the dialogue box over it.
  const screen = new Container()
  const view = new Container()
  view.mask = view.addChild(new Graphics().rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill(0xffffff))
  const world = new Container()
  world.addChild(drawMap(art))
  const props = world.addChild(new Container<Sprite>())
  const actors = world.addChild(new Container<ActorNode>())
  view.addChild(world)
  const dialog = makeDialogBox(art)
  screen.addChild(view, dialog.node)
  app.stage.addChild(screen, dialog.text)

  const showTouch = window.matchMedia("(pointer: coarse)").matches
  const touchGraphics = app.stage.addChild(new Graphics())

  // Whole device pixels per art pixel, the largest that fits, centered.
  const fit = () => {
    const ratio = app.renderer.resolution
    const scale = Math.max(1, Math.floor(Math.min((app.screen.width * ratio) / VIEW_WIDTH, (app.screen.height * ratio) / VIEW_HEIGHT)))
    screen.scale.set(scale / ratio)
    screen.position.set(
      Math.round((app.screen.width * ratio - VIEW_WIDTH * scale) / 2) / ratio,
      Math.round((app.screen.height * ratio - VIEW_HEIGHT * scale) / 2) / ratio
    )
    dialog.layout(scale, ratio, screen.position)
  }
  fit()
  app.renderer.on("resize", fit)
  // The host can grow and shrink without the window resizing (full screen
  // on a container, a layout change): follow the element itself, and the
  // pixel ratio when the window moves to another display.
  const observer = new ResizeObserver(() => {
    if (app.renderer.resolution !== window.devicePixelRatio) app.renderer.resolution = window.devicePixelRatio
    app.resize()
    fit()
  })
  observer.observe(host)

  const touch = Touch.actions(app.canvas, window, touchLayout)
  const controls = makeControls({
    keyboard: Keyboard.actions(window, keyBindings),
    gamepad: Gamepad.actions(window, padBindings),
    touch
  })

  const made = Game.Runtime.make({
    services: Game.Runtime.services(
      Game.Runtime.service(ControlsInput, controls),
      Game.Runtime.service(Art, art),
      Game.Runtime.service(ActorNodes, PixiNodeRegistry.make(actors)),
      Game.Runtime.service(PropNodes, PixiNodeRegistry.make(props)),
      Game.Runtime.service(Camera, makeCamera(world))
    ),
    resources: initialResources(),
    machines: initialMachines()
  })

  const dispose = () => {
    observer.disconnect()
    controls.dispose()
    app.destroy(true, { children: true })
    document.fonts.delete(font)
  }

  if (!made.ok) {
    dispose()
    throw new Error("The town's runtime could not start.")
  }
  const runtime = made.value
  const setup = runtime.tick(setupSchedule)
  if (!setup.ok) console.error(setup.error)

  const loop = FixedLoop.start({
    source: BrowserTickSource.make(window),
    step,
    maxFrameSeconds: 0.25,
    maxStepsPerFrame: 5,
    update: () => runtime.tick(updateSchedule),
    render: () => {
      const drawn = runtime.tick(renderSchedule)
      if (!drawn.ok) console.error(drawn.error)
      dialog.show(runtime.inspect(ReadScreen).dialogue)
      if (showTouch) drawTouch(touchGraphics, touch.view())
    },
    onFailure: (failure) => console.error(failure)
  })

  return () => {
    if (loop.ok) loop.value.stop()
    dispose()
  }
}
