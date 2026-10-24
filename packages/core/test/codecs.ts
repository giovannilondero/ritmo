/**
 * Hand-written Standard Schemas for Ritmo's own tests, benches, and type
 * tests. Not published: games bring a schema library (Zod, Valibot, ArkType,
 * Effect). These exist so the repo proves the codec contract with no library
 * at all, and so a test reads like a game's schema without depending on one.
 */
import type { Codec, StandardSchema } from "@typeonce/ritmo/Descriptor"
import * as Entity from "@typeonce/ritmo/Entity"
import type { Descriptor } from "@typeonce/ritmo/Descriptor"

type Issue = StandardSchema.Issue
type Check<T> = (raw: unknown, path: ReadonlyArray<PropertyKey>) => { readonly value: T } | { readonly issues: ReadonlyArray<Issue> }

/** A codec whose saved form is its value, from a check that knows its path. */
export interface TestCodec<T> extends StandardSchema<T, T> {
  readonly check: Check<T>
}

const make = <T>(check: Check<T>): TestCodec<T> => ({
  check,
  "~standard": { version: 1, vendor: "ritmo-test", validate: (raw) => check(raw, []) }
})

const fail = (message: string, path: ReadonlyArray<PropertyKey>) => ({ issues: [{ message, path }] })

export const primitiveOf = <T>(expected: string, test: (raw: unknown) => raw is T): TestCodec<T> =>
  make((raw, path) => test(raw) ? { value: raw } : fail(`Expected ${expected}`, path))

export const number = primitiveOf("a finite number", (raw): raw is number => typeof raw === "number" && Number.isFinite(raw))
export const integer = primitiveOf("an integer", (raw): raw is number => Number.isSafeInteger(raw))
export const string = primitiveOf("a string", (raw): raw is string => typeof raw === "string")
export const boolean = primitiveOf("a boolean", (raw): raw is boolean => typeof raw === "boolean")

export const literal = <const Values extends readonly [string | number | boolean | null, ...Array<string | number | boolean | null>]>(
  ...values: Values
): TestCodec<Values[number]> =>
  primitiveOf(values.map((value) => JSON.stringify(value)).join(" | "), (raw): raw is Values[number] => values.includes(raw as Values[number]))

export const nullable = <T>(inner: TestCodec<T>): TestCodec<T | null> =>
  make<T | null>((raw, path) => raw === null ? { value: null } : inner.check(raw, path))

export const array = <T>(item: TestCodec<T>): TestCodec<ReadonlyArray<T>> =>
  make((raw, path) => {
    if (!Array.isArray(raw)) return fail("Expected an array", path)
    const values: Array<T> = []
    for (const [index, entry] of raw.entries()) {
      const value = item.check(entry, [...path, index])
      if ("issues" in value) return value
      values.push(value.value)
    }
    return { value: values }
  })

export const struct = <const Fields extends Readonly<Record<string, TestCodec<any>>>>(
  fields: Fields
): TestCodec<{ readonly [K in keyof Fields]: Fields[K] extends TestCodec<infer T> ? T : never }> =>
  make((raw, path) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("Expected an object", path)
    const value: Record<string, unknown> = {}
    for (const [key, field] of Object.entries(fields)) {
      const decoded = field.check((raw as Record<string, unknown>)[key], [...path, key])
      if ("issues" in decoded) return decoded
      value[key] = decoded.value
    }
    return { value: value as { readonly [K in keyof Fields]: Fields[K] extends TestCodec<infer T> ? T : never } }
  })

/** A stored entity handle for schema root `Root`, built from `Entity.isHandle`. */
export const handle = <Root, const Intent extends Descriptor<"component", string, any> | undefined = undefined>(
  root: Root,
  intent?: Intent
): TestCodec<Entity.Handle<Root, Intent>> => {
  const isHandle = Entity.isHandle(root, intent)
  return make((raw, path) => isHandle(raw) ? { value: raw } : fail("Expected an entity handle", path))
}

/**
 * A codec whose value transforms: a `ReadonlyMap` saved as its entries, with
 * the `encode` back to them. The shape of a codec a game gets from Effect's
 * `Schema.ReadonlyMap` or a Zod codec.
 */
export const map = <V>(value: TestCodec<V>): Codec<ReadonlyMap<string, V>, ReadonlyArray<readonly [string, V]>> & {
  readonly encode: StandardSchema<ReadonlyMap<string, V>, ReadonlyArray<readonly [string, V]>>
} => {
  const entries = array(make<readonly [string, V]>((raw, path) => {
    if (!Array.isArray(raw) || raw.length !== 2 || typeof raw[0] !== "string") return fail("Expected a [key, value] entry", path)
    const decoded = value.check(raw[1], [...path, 1])
    return "issues" in decoded ? decoded : { value: [raw[0], decoded.value] as const }
  }))
  return {
    "~standard": {
      version: 1,
      vendor: "ritmo-test",
      validate: (raw) => {
        const decoded = entries.check(raw, [])
        return "issues" in decoded ? decoded : { value: new Map(decoded.value) }
      }
    },
    encode: {
      "~standard": {
        version: 1,
        vendor: "ritmo-test",
        validate: (raw) => raw instanceof Map ? { value: [...raw.entries()] } : fail("Expected a Map", [])
      }
    }
  }
}
