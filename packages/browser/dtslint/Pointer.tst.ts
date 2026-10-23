import { Descriptor, Result, Schema } from "@typeonce/ritmo"
import { Pointer } from "@typeonce/ritmo-browser"
import { describe, expect, it } from "tstyche"

declare const canvas: Pointer.PointerTarget
declare const blurHost: Pointer.BlurHost

const bindings = { fire: ["primary"], aim: ["secondary", "back"] } as const

describe("Pointer", () => {
  it("types snapshot actions by the bound action names, with raw buttons and the position", () => {
    const mouse = Pointer.actions(canvas, blurHost, bindings)
    const input = mouse.snapshot()
    expect(input).type.toBe<Pointer.Snapshot<typeof bindings>>()
    expect(input.actions.fire.pressed).type.toBe<boolean>()
    expect(input.buttons.forward.held).type.toBe<boolean>()
    expect(input.position).type.toBe<Pointer.Position>()
    expect(input.used).type.toBe<boolean>()
    // @ts-expect-error Property 'fier' does not exist
    input.actions.fier
    expect(Pointer.buttonNames).type.toBe<readonly ["primary", "middle", "secondary", "back", "forward"]>()
  })

  it("binds only pointer buttons, at least one per action", () => {
    // @ts-expect-error Type '"primay"' is not assignable to type
    Pointer.actions(canvas, blurHost, { fire: ["primay"] })
    // @ts-expect-error Type '[]' is not assignable to type 'readonly [
    Pointer.actions(canvas, blurHost, { fire: [] })
    expect(Pointer.actions(canvas, blurHost, {}).snapshot().actions).type.toBe<{}>()
  })

  it("rebinds the same actions only", () => {
    const mouse = Pointer.actions(canvas, blurHost, bindings)
    expect(mouse.rebind).type.toBeCallableWith({ fire: ["middle"], aim: ["primary"] })
    expect(mouse.rebind).type.not.toBeCallableWith({ fire: ["middle"] })
    // @ts-expect-error jump is not an action of these bindings
    mouse.rebind({ fire: ["middle"], aim: ["primary"], jump: ["back"] })
  })

  it("parses saved bindings and timelines into typed values", () => {
    expect(Pointer.parseRebinding(bindings, {})).type.toBe<Result.Result<Pointer.Rebinding<typeof bindings>, Pointer.InvalidRebinding>>()
    expect(Pointer.parseTimeline([])).type.toBe<Result.Result<Pointer.Timeline, Pointer.InvalidTimeline>>()
  })

  it("idles, scripts, and records with the same bindings", () => {
    expect(Pointer.idle(bindings)).type.toBe<Pointer.Snapshot<typeof bindings>>()
    const scripted = Pointer.scripted(bindings, [{ frame: 0, press: ["back"] }])
    expect(scripted).type.toBe<Pointer.Scripted<typeof bindings>>()
    expect(Pointer.recording(scripted)).type.toBe<Pointer.Recording<typeof bindings>>()
    // @ts-expect-error Type '"left"' is not assignable to type
    Pointer.scripted(bindings, [{ frame: 0, press: ["left"] }])
  })

  it("takes snapshots only through consumeService", () => {
    const MouseInput = Descriptor.Service<Pointer.Actions<typeof bindings>>()("PointerTypes/Mouse")
    const Game = Schema.bind(Schema.fragment({}))
    Game.System("PointerTypes/Settings", { services: { mouse: Game.System.service(MouseInput) } }, ({ services }) => {
      expect(services.mouse.rebind).type.toBeCallableWith({ fire: ["middle"], aim: ["primary"] })
      // @ts-expect-error snapshot() drains PointerTypes/Mouse
      services.mouse.snapshot()
    })
  })
})
