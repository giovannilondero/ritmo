import { Descriptor, Schema } from "@typeonce/ritmo"
import { Controls, Gamepad, InputCapture, Keyboard, Touch } from "@typeonce/ritmo-browser"
import { describe, expect, it } from "tstyche"

declare const host: Keyboard.KeyboardHost & Gamepad.GamepadHost
declare const touch: Touch.Touch<"jump">

const keyBindings = { jump: [" "], pause: ["Escape"] } as const
const padBindings = { jump: ["south"], pause: ["start"] } as const
const Actions = Controls.actions(["jump", "pause"])

const keyboard = Keyboard.actions(host, keyBindings)
const gamepad = Gamepad.actions(host, padBindings)

describe("Controls", () => {
  it("types merged actions by the declared names", () => {
    const input = Actions.merge({ keyboard, gamepad }).snapshot()
    expect(input.actions.jump).type.toBe<Keyboard.ActionState>()
    expect(input.available.pause).type.toBe<boolean>()
    expect(Actions.names).type.toBe<ReadonlyArray<"jump" | "pause">>()
    // @ts-expect-error Property 'junp' does not exist
    input.actions.junp
  })

  it("keys devices, lastUsed, and rebind by the merge names", () => {
    const controls = Actions.merge({ keyboard, gamepad, touch: Actions.lacking(touch, ["pause"]) })
    const input = controls.snapshot()
    expect(input.devices.gamepad).type.toBe<Gamepad.Snapshot<typeof padBindings>>()
    expect(input.devices.keyboard).type.toBe<Keyboard.Snapshot<typeof keyBindings>>()
    expect(input.devices.touch).type.toBe<Touch.Snapshot<"jump">>()
    expect(input.lastUsed).type.toBe<"keyboard" | "gamepad" | "touch" | null>()
    expect(controls.rebind.gamepad).type.toBeCallableWith({ jump: ["east"], pause: ["start"] })
    expect(controls.rebind.keyboard).type.toBeCallableWith({ jump: [Keyboard.code("KeyJ")], pause: ["Escape"] })
    expect(controls.rebind.keyboard).type.not.toBeCallableWith({ jump: ["j"] })
    // @ts-expect-error Property 'mouse' does not exist
    input.devices.mouse
    // @ts-expect-error Property 'touch' does not exist
    controls.rebind.touch
  })

  it("does not let a device report an action it lacks", () => {
    const input = Actions.merge({ keyboard, touch: Actions.lacking(touch, ["pause"]) }).snapshot()
    expect(input.devices.touch.actions.jump.aim).type.toBe<Touch.Vector | null>()
    // @ts-expect-error Property 'pause' does not exist
    input.devices.touch.actions.pause
  })

  it("requires every device to bind every action, or to name what it lacks", () => {
    // @ts-expect-error touch has no action pause: bind it on touch, or pass lacking(touch, [...]) from the action set
    Actions.merge({ keyboard, touch })
    const typo = Gamepad.actions(host, { jmup: ["south"], pause: ["start"] })
    // @ts-expect-error gamepad binds jmup, which is not one of the actions
    Actions.merge({ keyboard, gamepad: typo })
  })

  it("requires lacking to name exactly the missing actions", () => {
    expect(Actions.lacking(touch, ["pause"])).type.toBe<Controls.Lacking<Touch.Touch<"jump">, "pause">>()
    // @ts-expect-error This device also lacks pause: bind it, or list it here
    Actions.lacking(touch, [])
    // @ts-expect-error Type '"paus"' is not assignable to type '"pause"'
    Actions.lacking(touch, ["paus"])
    // @ts-expect-error Type '"jump"' is not assignable to type '"pause"'
    Actions.lacking(touch, ["pause", "jump"])
    // @ts-expect-error This device binds every action: pass it to merge without lacking
    Actions.lacking(keyboard, [])
    const typo = Gamepad.actions(host, { jmup: ["south"] })
    // @ts-expect-error This device binds jmup, which is not one of the actions
    Actions.lacking(typo, ["pause"])
  })

  it("requires some device to bind every action", () => {
    const keysWithoutPause = Keyboard.actions(host, { jump: [" "] })
    // @ts-expect-error no device binds pause: bind it on one device, or remove it from Controls.actions
    Actions.merge({ keyboard: Actions.lacking(keysWithoutPause, ["pause"]), touch: Actions.lacking(touch, ["pause"]) })
  })

  it("captures into a resource declared from the service, initialized with idle", () => {
    const makeControls = (devices: {
      readonly keyboard: Keyboard.Actions<typeof keyBindings>
      readonly gamepad: Gamepad.Actions<typeof padBindings>
    }) => Actions.merge(devices)
    const ControlsInput = Descriptor.Service<ReturnType<typeof makeControls>>()("ControlsTypes/Controls")
    const Input = Descriptor.TransientResource<InputCapture.SnapshotOf<typeof ControlsInput>>()("ControlsTypes/Input")
    const Game = Schema.bind(Schema.fragment({ resources: { Input } }))
    const Capture = InputCapture.system(Game, { name: "ControlsTypes/Capture", source: ControlsInput, resource: Input })
    const runtime = Game.Runtime.make({
      services: Game.Runtime.services(Game.Runtime.service(ControlsInput, makeControls({ keyboard, gamepad }))),
      resources: { Input: Actions.idle({ keyboard: Keyboard.idle(keyBindings), gamepad: Gamepad.idle(padBindings) }) }
    }).value
    expect(runtime.tick(Game.Schedule(Capture)).ok).type.toBe<boolean>()
    Game.Runtime.make({
      services: Game.Runtime.services(Game.Runtime.service(ControlsInput, makeControls({ keyboard, gamepad }))),
      // @ts-expect-error Property 'gamepad' is missing
      resources: { Input: Actions.idle({ keyboard: Keyboard.idle(keyBindings) }) }
    })
  })

  it("rejects snapshot() through a plain service, and keeps the other methods", () => {
    const makeControls = (devices: { readonly keyboard: Keyboard.Actions<typeof keyBindings> }) => Actions.merge(devices)
    const ControlsInput = Descriptor.Service<ReturnType<typeof makeControls>>()("ControlsTypes/Plain")
    const Game = Schema.bind(Schema.fragment({}))
    Game.System("ControlsTypes/Settings", { services: { controls: Game.System.service(ControlsInput) } }, ({ services }) => {
      expect(services.controls.rebind.keyboard({ jump: ["w"], pause: ["p"] })).type.toBe<void>()
      // @ts-expect-error snapshot() drains ControlsTypes/Plain: declare it with Game.System.consumeService, or read the resource its capture writes
      services.controls.snapshot()
    })
    Game.System("ControlsTypes/Drain", { services: { controls: Game.System.consumeService(ControlsInput) } }, ({ services }) => {
      expect(services.controls.snapshot().actions.jump.pressed).type.toBe<boolean>()
    })
    const KeysInput = Descriptor.Service<Keyboard.Actions<typeof keyBindings>>()("ControlsTypes/Keys")
    Game.System("ControlsTypes/Keys", { services: { keys: Game.System.service(KeysInput) } }, ({ services }) => {
      // @ts-expect-error snapshot() drains ControlsTypes/Keys
      services.keys.snapshot()
    })
  })

  it("declares at least one action", () => {
    // @ts-expect-error Argument of type '[]' is not assignable
    Controls.actions([])
  })
})
