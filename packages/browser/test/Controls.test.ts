import { describe, expect, it } from "vitest"

import { Descriptor, HostClock, Schema } from "@typeonce/ritmo"
import { Controls, Gamepad, InputCapture, Keyboard, Touch } from "@typeonce/ritmo-browser"

const idle = { held: false, pressed: false, released: false }
const keyBindings = { jump: [" "], pause: ["Escape"] } as const
const padBindings = { jump: ["south"], pause: ["start"] } as const
const Actions = Controls.actions(["jump", "pause"])

const merged = (keys: Keyboard.Timeline<typeof keyBindings>, pad: Gamepad.Timeline) =>
  Actions.merge({ keyboard: Keyboard.scripted(keyBindings, keys), gamepad: Gamepad.scripted(padBindings, pad) })

describe("Controls", () => {
  it("merges an action like one device with every binding", () => {
    const controls = merged(
      [{ frame: 0, press: ["jump"] }, { frame: 2, release: ["jump"] }, { frame: 4, press: ["jump"], release: ["jump"] }],
      [{ frame: 1, press: ["south"] }, { frame: 3, release: ["south"] }]
    )
    const jump = () => controls.snapshot().actions.jump
    expect(jump()).toEqual({ held: true, pressed: true, released: false }) // Space down
    expect(jump()).toEqual({ held: true, pressed: true, released: false }) // South down while Space is held: a second press
    expect(jump()).toEqual({ held: true, pressed: false, released: false }) // Space up, South still holds it
    expect(jump()).toEqual({ held: false, pressed: false, released: true }) // South up: nothing holds it
    expect(jump()).toEqual({ held: false, pressed: true, released: true }) // a tap inside one window
    expect(jump()).toEqual(idle)
  })

  it("hands an action from one device to another without a release", () => {
    const controls = merged([{ frame: 0, press: ["jump"] }, { frame: 1, release: ["jump"] }], [{ frame: 1, press: ["south"] }])
    controls.snapshot()
    expect(controls.snapshot().actions.jump).toEqual({ held: true, pressed: true, released: false })
  })

  it("keeps an action held through another device's disconnect", () => {
    const controls = merged([{ frame: 0, press: ["jump"] }], [{ frame: 0, press: ["south"] }, { frame: 1, connected: false }])
    controls.snapshot()
    expect(controls.snapshot().actions.jump).toEqual({ held: true, pressed: false, released: false })
  })

  it("keeps each device's own snapshot under its merge name", () => {
    const controls = merged([], [{ frame: 0, left: { x: 1, y: 0 }, press: ["east"] }])
    const input = controls.snapshot()
    expect(input.devices.gamepad.left).toEqual({ x: 1, y: 0 })
    expect(input.devices.gamepad.buttons.east.pressed).toBe(true)
    expect(input.devices.keyboard.actions.jump).toEqual(idle)
  })

  it("follows the device used last, staying on the current one while it is still in use", () => {
    const controls = merged(
      [{ frame: 1, press: ["jump"] }, { frame: 3, release: ["jump"] }],
      [{ frame: 2, left: { x: 0.5, y: 0 } }, { frame: 5, left: { x: 0, y: 0 } }]
    )
    const lastUsed = () => controls.snapshot().lastUsed
    expect(lastUsed()).toBe(null)
    expect(lastUsed()).toBe("keyboard")
    expect(lastUsed()).toBe("keyboard") // both in use: stays on the current one
    expect(lastUsed()).toBe("gamepad") // keys released (a release is not use), the stick still tilted
    expect(lastUsed()).toBe("gamepad")
    expect(lastUsed()).toBe("gamepad") // nothing in use: unchanged
  })

  it("reports which actions the last used device has", () => {
    const controls = Actions.merge({
      keyboard: Keyboard.scripted(keyBindings, [{ frame: 2, press: ["pause"] }]),
      touch: Actions.lacking(Touch.scripted(["jump"], [{ frame: 1, press: ["jump"], release: ["jump"] }]), ["pause"])
    })
    expect(controls.snapshot().available).toEqual({ jump: true, pause: true })
    expect(controls.snapshot().available).toEqual({ jump: true, pause: false })
    const input = controls.snapshot()
    expect(input.lastUsed).toBe("keyboard")
    expect(input.available).toEqual({ jump: true, pause: true })
    expect(input.actions.pause.pressed).toBe(true)
  })

  it("forwards rebind to each device and disposes every device", () => {
    const rebinds: Array<unknown> = []
    const disposed: Array<string> = []
    const keyboard = { ...Keyboard.scripted(keyBindings, []), rebind: (next: unknown) => rebinds.push(next), dispose: () => disposed.push("keyboard") }
    const touch = { ...Touch.scripted(["jump"], []), dispose: () => disposed.push("touch") }
    const controls = Actions.merge({ keyboard, touch: Actions.lacking(touch, ["pause"]) })
    controls.rebind.keyboard({ jump: ["j"], pause: ["p"] })
    expect(rebinds).toEqual([{ jump: ["j"], pause: ["p"] }])
    expect(Object.keys(controls.rebind)).toEqual(["keyboard"])
    controls.dispose()
    expect(disposed).toEqual(["keyboard", "touch"])
  })

  it("starts from an idle snapshot with every action available", () => {
    expect(Actions.idle({ keyboard: Keyboard.idle(keyBindings) })).toEqual({
      actions: { jump: idle, pause: idle },
      available: { jump: true, pause: true },
      devices: { keyboard: { actions: { jump: idle, pause: idle }, used: false } },
      lastUsed: null
    })
  })

  it("lists every gap and every second capture in describe()", () => {
    const makeControls = (devices: { readonly keyboard: Keyboard.Actions<typeof keyBindings>; readonly touch: Touch.Touch<"jump"> }) =>
      Actions.merge({ keyboard: devices.keyboard, touch: Actions.lacking(devices.touch, ["pause"]) })
    const ControlsInput = Descriptor.Service<ReturnType<typeof makeControls>>()("ControlsTest/Controls")
    const Input = Descriptor.TransientResource<InputCapture.SnapshotOf<typeof ControlsInput>>()("ControlsTest/Input")
    const Game = Schema.bind(Schema.fragment({ resources: { Input } }))
    const Capture = InputCapture.system(Game, { name: "ControlsTest/Capture", source: ControlsInput, resource: Input })
    const CaptureAgain = InputCapture.system(Game, { name: "ControlsTest/CaptureAgain", source: ControlsInput, resource: Input })
    const runtime = Game.Runtime.make({
      services: Game.Runtime.services(Game.Runtime.service(ControlsInput, makeControls({
        keyboard: Keyboard.scripted(keyBindings, []),
        touch: Touch.scripted(["jump"], [])
      }))),
      resources: { Input: Actions.idle({ keyboard: Keyboard.idle(keyBindings), touch: Touch.idle(["jump"]) }) },
      debug: { hostClock: HostClock.test() }
    }).value
    runtime.debug.nameSchedules({ fixed: Game.Schedule(Capture), render: Game.Schedule(CaptureAgain) })
    const lints = runtime.debug.describe().lints.filter((lint) => lint.code === "service-lint" || lint.code === "service-consumed-twice")
    expect(lints).toEqual([
      {
        severity: "warning",
        code: "service-consumed-twice",
        subject: "ControlsTest/Controls",
        message: "ControlsTest/Controls is consumed by ControlsTest/Capture (fixed#0) and ControlsTest/CaptureAgain (render#0): each run takes what arrived since the previous one, so each sees only what the others left (an input press reaches one of them)",
        fix: "consume ControlsTest/Controls in one system placed once (InputCapture.system for an input source), write what it takes to a resource, and read the resource everywhere else"
      },
      {
        severity: "info",
        code: "service-lint",
        subject: "ControlsTest/Controls",
        message: "touch lacks pause, so while touch is the last used device the player cannot pause",
        fix: "fine if the game offers pause another way while touch is in use (read available.pause from the input); otherwise bind pause on touch"
      }
    ])
  })

  it("reads use from each device: presses and holds, sticks and swipes, never a release", () => {
    const keys = Keyboard.scripted(keyBindings, [{ frame: 0, press: ["jump"] }, { frame: 2, release: ["jump"] }])
    expect([keys.snapshot().used, keys.snapshot().used, keys.snapshot().used]).toEqual([true, true, false])

    const pad = Gamepad.scripted(padBindings, [{ frame: 0, left: { x: 0.5, y: 0 } }, { frame: 1, press: ["east"] }, { frame: 2, connected: false }])
    expect([pad.snapshot().used, pad.snapshot().used, pad.snapshot().used]).toEqual([true, true, false])

    const touch = Touch.scripted(["jump"], [{ frame: 0, stick: { x: 1, y: 0 } }, { frame: 1, stick: null, swipe: { x: 4, y: 0 } }, { frame: 2, press: ["jump"], release: ["jump"] }])
    expect([touch.snapshot().used, touch.snapshot().used, touch.snapshot().used, touch.snapshot().used]).toEqual([true, true, true, false])
  })

  it("does not switch to a device that only released everything", () => {
    const controls = merged([{ frame: 1, press: ["jump"] }], [{ frame: 0, press: ["south"] }, { frame: 1, connected: false }])
    expect(controls.snapshot().lastUsed).toBe("gamepad")
    expect(controls.snapshot().lastUsed).toBe("keyboard")
  })
})
