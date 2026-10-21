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

  it("accepts the browser's navigator as a host", () => {
    expect<Navigator>().type.toBeAssignableTo<Gamepad.GamepadHost>()
  })

  it("narrows stored names with isButton", () => {
    const name: unknown = "south"
    if (Gamepad.isButton(name)) expect(name).type.toBe<Gamepad.Button>()
  })
})
