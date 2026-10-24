import { Descriptor, Schema } from "@typeonce/ritmo"
import * as Codecs from "../test/codecs.ts"
import { describe, expect, it } from "tstyche"

const Hp = Descriptor.Component<number>()("Entries/Hp")
const Name = Descriptor.Component<string>()("Entries/Name")
const Phase = Descriptor.EntityState("Entries/Phase", { ready: {}, windup: Codecs.struct({ frames: Codecs.integer }) })
const Stranger = Descriptor.Component<number>()("Entries/Stranger")

const Game = Schema.bind(Schema.fragment({ components: { Hp, Name, Phase } }))

describe("spawn and insert entries", () => {
  it("accept each descriptor with its own value", () => {
    expect(Game.Command.spawn([Hp, 1], [Name, "n"], [Phase, { _tag: "ready" }])).type.not.toRaiseError()
    expect(Game.Command.extend(Game.Command.spawn([Hp, 1]), [Name, "n"])).type.not.toRaiseError()
  })

  it("reject a value that belongs to another component of the schema", () => {
    expect(Game.Command.spawn).type.not.toBeCallableWith([Hp, "x"])
    expect(Game.Command.spawn).type.not.toBeCallableWith([Hp, 1], [Name, 2])
    expect(Game.Command.spawn).type.not.toBeCallableWith([Phase, { _tag: "windup" }])
    expect(Game.Command.extend).type.not.toBeCallableWith(Game.Command.spawn([Hp, 1]), [Name, 3])
  })

  it("reject descriptors outside the schema", () => {
    expect(Game.Command.spawn).type.not.toBeCallableWith([Stranger, 1])
  })
})
