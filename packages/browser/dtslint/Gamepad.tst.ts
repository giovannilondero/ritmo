import { Result } from "@typeonce/ritmo"
import { Gamepad } from "@typeonce/ritmo-browser"
import { describe, expect, it } from "tstyche"

declare const host: Gamepad.GamepadHost

describe("Gamepad", () => {
  it("types snapshot actions by the bound action names", () => {
    const input = Gamepad.actions(host, { attack: ["west"], dash: ["south", "rightBumper"] })
    expect(input.snapshot().actions.attack.pressed).type.toBe<boolean>()
    expect(input.snapshot().buttons.dpadUp.held).type.toBe<boolean>()
    expect(input.snapshot().left).type.toBe<Gamepad.Vector>()
    // @ts-expect-error Property 'jump' does not exist
    input.snapshot().actions.jump
  })

  it("binds only standard mapping buttons, at least one per action", () => {
    // @ts-expect-error Type '"A"' is not assignable to type
    Gamepad.actions(host, { attack: ["A"] })
    // @ts-expect-error Type '[]' is not assignable to type 'readonly [
    Gamepad.actions(host, { attack: [] })
  })

  it("rebinds the same actions only", () => {
    const input = Gamepad.actions(host, { attack: ["west"], dash: ["south"] })
    expect(input.rebind).type.toBeCallableWith({ attack: ["north"], dash: ["east"] })
    expect(input.rebind).type.not.toBeCallableWith({ attack: ["north"] })
    expect(input.rebind).type.not.toBeCallableWith({ attack: ["north"], dash: ["east"], jump: ["south"] })
  })

  it("rejects extra actions even from an object that is not written inline", () => {
    const input = Gamepad.actions(host, { attack: ["west"], dash: ["south"] })
    const next = { attack: ["north"], dash: ["east"], jump: ["south"] } as const
    // @ts-expect-error jump is not an action of these bindings
    input.rebind(next)
    const wide: Record<string, readonly ["north"]> = {}
    expect(input.rebind).type.not.toBeCallableWith(wide)
    let current: Gamepad.Rebinding<{ readonly attack: readonly ["west"]; readonly dash: readonly ["south"] }> = { attack: ["west"], dash: ["south"] }
    current = { ...current, attack: ["north"] }
    expect(input.rebind).type.toBeCallableWith(current)
    expect(Gamepad.recording(input).rebind).type.not.toBeCallableWith(next)
  })

  it("accepts the browser's window as a host", () => {
    expect<Window>().type.toBeAssignableTo<Gamepad.GamepadHost>()
    // @ts-expect-error is missing the following properties from type 'GamepadHost': navigator
    Gamepad.actions(navigator, { attack: ["west"] })
  })

  it("has no poll(): the pads are read on every animation frame", () => {
    // @ts-expect-error Property 'poll' does not exist
    Gamepad.actions(host, { attack: ["west"] }).poll()
  })

  it("narrows stored names with isButton", () => {
    const name: unknown = "south"
    if (Gamepad.isButton(name)) expect(name).type.toBe<Gamepad.Button>()
  })
})

describe("Gamepad.parseRebinding", () => {
  it("parses into a rebinding for the same actions", () => {
    const bindings = { attack: ["west"], dash: ["south"] } as const
    expect(Gamepad.parseRebinding(bindings, null)).type.toBe<
      Result.Result<Gamepad.Rebinding<{ readonly attack: readonly ["west"]; readonly dash: readonly ["south"] }>, Gamepad.InvalidRebinding>
    >()
    const parsed = Gamepad.parseRebinding(bindings, null)
    if (parsed.ok) Gamepad.actions(host, bindings).rebind(parsed.value)
  })

  it("rejects a rebinding parsed for other actions", () => {
    const parsed = Gamepad.parseRebinding({ attack: ["west"] }, null)
    if (parsed.ok) {
      // @ts-expect-error Property 'dash' is missing
      Gamepad.actions(host, { attack: ["west"], dash: ["south"] }).rebind(parsed.value)
    }
  })
})
