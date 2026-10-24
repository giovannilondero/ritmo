import { Descriptor, Result, Schema } from "@typeonce/ritmo"
import * as Codecs from "../test/codecs.ts"
import type { Handle } from "@typeonce/ritmo/Entity"
import { describe, expect, it } from "tstyche"

describe("Result", () => {
  it("keeps value and error types through narrowing, match, and all", () => {
    const parsed = Result.success(1) as Result.Result<number, "NaN">
    if (parsed.ok) expect(parsed.value).type.toBe<number>()
    else expect(parsed.error).type.toBe<"NaN">()
    expect(Result.match(parsed, { onSuccess: (value) => value > 0, onFailure: (error) => error })).type.toBe<boolean | "NaN">()

    const name = Result.success("a") as Result.Result<string, "Empty">
    expect(Result.all([parsed, name])).type.toBe<Result.Result<readonly [number, string], "NaN" | "Empty">>()
    expect(Result.all({ parsed, name })).type.toBe<Result.Result<{ readonly parsed: number; readonly name: string }, "NaN" | "Empty">>()
  })
})

describe("Codecs", () => {
  const Root = Schema.defineRoot("Values")
  const Health = Descriptor.Component<number>()("Values/Health")

  it("infers the decoded type of each test codec", () => {
    expect(Codecs.literal("idle", "run")).type.toBe<Codecs.TestCodec<"idle" | "run">>()
    expect(Codecs.nullable(Codecs.number)).type.toBe<Codecs.TestCodec<number | null>>()
    expect(Codecs.array(Codecs.string)).type.toBe<Codecs.TestCodec<ReadonlyArray<string>>>()
    expect(Codecs.struct({ level: Codecs.integer, tags: Codecs.array(Codecs.string) })).type.toBe<
      Codecs.TestCodec<{ readonly level: number; readonly tags: ReadonlyArray<string> }>
    >()
    expect(Codecs.handle(Root, Health)).type.toBe<Codecs.TestCodec<Handle<typeof Root, typeof Health>>>()
  })

  it("makes constructed descriptors whose values follow the schema and raw input its saved form", () => {
    const Stats = Descriptor.ConstructedComponent(Codecs.struct({ level: Codecs.integer }))("Values/Stats")
    expect<Descriptor.Descriptor.Value<typeof Stats>>().type.toBe<{ readonly level: number }>()
    expect<Descriptor.Descriptor.Raw<typeof Stats>>().type.toBe<{ readonly level: number }>()
    expect<Descriptor.Descriptor.ConstructionError<typeof Stats>>().type.toBe<Descriptor.SchemaIssues>()

    const Inventory = Descriptor.ConstructedResource(Codecs.map(Codecs.integer))("Values/Inventory")
    expect<Descriptor.Descriptor.Value<typeof Inventory>>().type.toBe<ReadonlyMap<string, number>>()
    expect<Descriptor.Descriptor.Raw<typeof Inventory>>().type.toBe<ReadonlyArray<readonly [string, number]>>()
  })

  it("rejects schemas Ritmo cannot save with", () => {
    const parsed = {} as Descriptor.StandardSchema<string, number>
    // @ts-expect-error give it an `encode` schema back to the saved form
    Descriptor.ConstructedComponent(parsed)
    const backwards = { ...parsed, encode: {} as Descriptor.StandardSchema<number, boolean> }
    // @ts-expect-error its encode does not return the saved form the schema decodes
    Descriptor.ConstructedComponent(backwards)
    const dated = {} as Descriptor.StandardSchema<Date, Date>
    // @ts-expect-error the saved form of this schema is not plain data
    Descriptor.ConstructedResource(dated)
    const constructor = { result: (raw: unknown) => Result.success(raw) }
    // @ts-expect-error Property '"~standard"' is missing
    Descriptor.ConstructedComponent(constructor)
    const roundTrip = { ...parsed, encode: {} as Descriptor.StandardSchema<number, string> }
    expect(Descriptor.ConstructedComponent(roundTrip)("Values/Parsed")).type.toBe<
      Descriptor.ConstructedDescriptor<"component", "Values/Parsed", number, string, Descriptor.SchemaIssues>
    >()
  })

  it("rejects test codecs that cannot be built", () => {
    // @ts-expect-error Expected at least 1 arguments, but got 0
    Codecs.literal()
    // @ts-expect-error Type 'number' is not assignable to type 'TestCodec<any>'
    Codecs.struct({ level: 1 })
  })
})

describe("Descriptor values", () => {
  it("infers the descriptor of a typed value", () => {
    const Health = Descriptor.Component<number>()("Values/TypedHealth")
    expect(Health).type.toBe<Descriptor.Descriptor<"component", "Values/TypedHealth", number>>()
    expect(Descriptor.Resource<unknown>()("Values/Blob")).type.toBe<Descriptor.Descriptor<"resource", "Values/Blob", unknown>>()
  })

  it("rejects any and never as a value", () => {
    // @ts-expect-error a component value cannot be `any`
    Descriptor.Component<any>()("Values/Anything")
    // @ts-expect-error a component value cannot be `never`
    Descriptor.Component<never>()("Values/Gone")
    // @ts-expect-error a component value cannot be `any`
    Descriptor.TransientComponent<any>()("Values/AnyTrail")
    // @ts-expect-error a resource value cannot be `any`
    Descriptor.Resource<any>()("Values/AnyScore")
    // @ts-expect-error a resource value cannot be `never`
    Descriptor.TransientResource<never>()("Values/NoTime")
    // @ts-expect-error an event value cannot be `any`
    Descriptor.Event<any>()("Values/AnyHit")
    // @ts-expect-error a service value cannot be `any`
    Descriptor.Service<any>()("Values/AnyLogger")
  })
})
