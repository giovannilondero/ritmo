import { Descriptor, Schema } from "@typeonce/ritmo"
import type * as Brand from "@typeonce/ritmo/Brand"
import type * as Entity from "@typeonce/ritmo/Entity"
import * as Codecs from "../test/codecs.ts"
import { describe, expect, it } from "tstyche"

type Meters = Brand.Branded<number, "Columns/Meters">

const Health = Descriptor.Component<number>()("Columns/Health", { columns: "number" })
const Lane = Descriptor.Component<0 | 1 | 2>()("Columns/Lane", { columns: "number", immutable: true })
const Distance = Descriptor.Component<Meters>()("Columns/Distance", { columns: "number" })
const Speed = Descriptor.ConstructedComponent(Codecs.number)("Columns/Speed", { columns: "number" })
const Frame = Descriptor.TransientComponent<number>()("Columns/Frame", { columns: "number" })
const Position = Descriptor.Component<{ readonly x: number; readonly y: number }>()("Columns/Position")

const Game = Schema.bind(Schema.fragment({ components: { Health, Lane, Distance, Speed, Frame, Position } }))

describe("number columns", () => {
  it("keep the descriptor's type: columns change storage only", () => {
    expect(Health).type.toBe<Descriptor.Descriptor<"component", "Columns/Health", number>>()
    expect(Lane).type.toBe<Descriptor.Descriptor<"component", "Columns/Lane", 0 | 1 | 2> & Descriptor.Immutable>()
    expect(Speed).type.toBe<Descriptor.ConstructedDescriptor<"component", "Columns/Speed", number, number, Descriptor.SchemaIssues>>()
    expect(Frame).type.toBe<Descriptor.TransientDescriptor<"component", "Columns/Frame", number>>()
  })

  it("read and write numbers, typed by the value", () => {
    Game.System("Columns/Move", {
      queries: {
        movers: Game.Query({
          selection: { health: Game.Query.write(Health), distance: Game.Query.read(Distance), lane: Game.Query.read(Lane) }
        })
      }
    }, ({ queries }) => {
      for (const { data } of queries.movers.each()) {
        expect(data.health.get()).type.toBe<number>()
        expect(data.distance.get()).type.toBe<Meters>()
        expect(data.lane.get()).type.toBe<0 | 1 | 2>()
        data.health.set(data.health.get() - 1)
        // @ts-expect-error Argument of type 'string' is not assignable to parameter of type 'number'
        data.health.set("full")
      }
    })
  })

  it("are required for a number value, naming the option", () => {
    // @ts-expect-error Columns/Plain holds a number: add { columns:
    Descriptor.Component<number>()("Columns/Plain")
    // @ts-expect-error Columns/Branded holds a number: add { columns:
    Descriptor.Component<Meters>()("Columns/Branded")
    // @ts-expect-error Columns/Index holds a number: add { columns:
    Descriptor.Component<0 | 1>()("Columns/Index")
    // @ts-expect-error Columns/Target holds a number: add { columns:
    Descriptor.Component<Entity.EntityId<typeof Game.schema>>()("Columns/Target")
    // @ts-expect-error Columns/Kept holds a number: add { columns:
    Descriptor.Component<number>()("Columns/Kept", { immutable: true })
    // @ts-expect-error Columns/Parsed holds a number: add { columns:
    Descriptor.ConstructedComponent(Codecs.integer)("Columns/Parsed")
    // @ts-expect-error Columns/Cached holds a number: add { columns:
    Descriptor.TransientComponent<number>()("Columns/Cached")
  })

  it("are rejected for any other value", () => {
    // @ts-expect-error Columns/Name does not hold a number: only components whose value is a number take { columns:
    Descriptor.Component<string>()("Columns/Name", { columns: "number" })
    // @ts-expect-error Columns/Point does not hold a number
    Descriptor.Component<{ readonly x: number }>()("Columns/Point", { columns: "number" })
    // @ts-expect-error Columns/Maybe does not hold a number
    Descriptor.Component<number | undefined>()("Columns/Maybe", { columns: "number" })
    // @ts-expect-error Columns/Label does not hold a number
    Descriptor.ConstructedComponent(Codecs.string)("Columns/Label", { columns: "number" })
  })

  it("take only \"number\"", () => {
    // @ts-expect-error Type 'string[]' is not assignable to type '"number"'
    Descriptor.Component<{ readonly x: number }>()("Columns/Fields", { columns: ["x"] })
  })
})
