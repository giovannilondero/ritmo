import { Result } from "@typeonce/ritmo"
import { Keyboard } from "@typeonce/ritmo-browser"
import { describe, expect, it } from "tstyche"

declare const host: Keyboard.KeyboardHost

describe("Keyboard", () => {
  it("types snapshots by the bound action names", () => {
    const input = Keyboard.actions(host, { jump: [" "], left: ["ArrowLeft", "a"] })
    expect(input.snapshot()).type.toBe<Keyboard.Snapshot<{ readonly jump: readonly [" "]; readonly left: readonly ["ArrowLeft", "a"] }>>()
    expect(input.snapshot().jump.pressed).type.toBe<boolean>()
    // @ts-expect-error Property 'crouch' does not exist on type 'Snapshot<{ readonly jump: readonly [" "]; readonly left: readonly
    input.snapshot().crouch
  })

  it("accepts physical-key bindings alongside characters", () => {
    const input = Keyboard.actions(host, { up: [Keyboard.code("KeyW"), "ArrowUp"] })
    expect(input.snapshot().up.held).type.toBe<boolean>()
    // @ts-expect-error Object literal may only specify known properties, and 'key' does not exist in type 'PhysicalKey'.
    Keyboard.actions(host, { up: [{ key: "w" }] })
  })

  it("accepts real KeyboardEvent hosts, which carry `code`", () => {
    expect<Window>().type.toBeAssignableTo<Keyboard.KeyboardHost>()
  })

  it("requires at least one key per action", () => {
    // @ts-expect-error Type '[]' is not assignable to type 'readonly [KeyBinding, ...KeyBinding[]]'.
    Keyboard.actions(host, { jump: [] })
  })
})

describe("Keyboard.rebind", () => {
  it("rebinds the same actions only", () => {
    const input = Keyboard.actions(host, { jump: [" "], left: ["a"] })
    expect(input.rebind).type.toBeCallableWith({ jump: [Keyboard.code("KeyJ")], left: ["ArrowLeft"] })
    expect(input.rebind).type.not.toBeCallableWith({ jump: ["j"] })
  })
})

describe("Keyboard.presses", () => {
  it("returns the keys pressed since the previous snapshot", () => {
    expect(Keyboard.presses(host).snapshot()).type.toBe<ReadonlyArray<Keyboard.KeyPress>>()
    expect(Keyboard.presses(host).snapshot()[0]?.code).type.toBe<string | null | undefined>()
  })
})

describe("Keyboard.parseRebinding", () => {
  it("parses into a rebinding for the same actions", () => {
    const bindings = { jump: [" "], left: ["a"] } as const
    expect(Keyboard.parseRebinding(bindings, null)).type.toBe<
      Result.Result<Keyboard.Rebinding<{ readonly jump: readonly [" "]; readonly left: readonly ["a"] }>, Keyboard.InvalidRebinding>
    >()
    const parsed = Keyboard.parseRebinding(bindings, null)
    if (parsed.ok) Keyboard.actions(host, bindings).rebind(parsed.value)
  })

  it("rejects a rebinding parsed for other actions", () => {
    const parsed = Keyboard.parseRebinding({ jump: [" "] }, null)
    if (parsed.ok) {
      // @ts-expect-error Property 'left' is missing
      Keyboard.actions(host, { jump: [" "], left: ["a"] }).rebind(parsed.value)
    }
  })
})
