/**
 * What entity states (`Descriptor.EntityState`) and state machines
 * (`Game.StateMachine`) share at runtime: the codec of a tagged state value,
 * and the one frozen value of each state without fields.
 */
import * as Decode from "../Decode.ts"
import * as Result from "../Result.ts"

/** Each state's field codecs, by state name. */
type States = Readonly<Record<string, Readonly<Record<string, Decode.Codec<any>>>>>

/** The shared value of every state without fields, by state name. */
export const emptyStates = (states: States): ReadonlyMap<string, { readonly _tag: string }> =>
  new Map(
    Object.entries(states)
      .filter(([, fields]) => Object.keys(fields).length === 0)
      .map(([state]) => [state, Object.freeze({ _tag: state })])
  )

/**
 * The codec of every value of `states`: its `_tag` names a state, and the
 * rest decodes as that state's fields. A state without fields decodes to its
 * shared frozen value.
 */
export const stateCodec = (states: States): Decode.Codec<{ readonly _tag: string }> => {
  const names = Object.keys(states) as [string, ...Array<string>]
  const tag = Decode.literal(...names)
  const fields = new Map(names.map((name) => [name, Decode.struct(states[name]!)]))
  const empty = emptyStates(states)
  const decode = (raw: unknown): Result.Result<{ readonly _tag: string }, Decode.DecodeError> => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return Result.failure({ _tag: "DecodeError", path: "$", expected: "object", actual: raw })
    }
    const name = tag.decode((raw as { readonly _tag?: unknown })._tag)
    if (!name.ok) return Result.failure({ ...name.error, path: "$._tag" })
    const value = fields.get(name.value)!.decode(raw)
    if (!value.ok) return value
    return Result.success(empty.get(name.value) ?? { _tag: name.value, ...value.value })
  }
  return { decode, result: decode }
}
