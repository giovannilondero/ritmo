import * as Result from "@typeonce/ritmo/Result"
import type * as Scalar from "../Scalar.ts"
import { codecOf } from "./codec.ts"

// A branded number's constructors, guard, and codec, from its check.
const refine = <Value extends number>(
  validate: (raw: number) => Result.Result<Value, Scalar.Error>,
  expected: string
): Scalar.Constructor<Value> => ({
  result: validate,
  option: (raw) => {
    const result = validate(raw)
    return result.ok ? result.value : null
  },
  is: (raw): raw is Value => typeof raw === "number" && validate(raw).ok,
  codec: codecOf<number, Value>((raw) => typeof raw === "number" ? validate(raw) : Result.failure(raw), expected)
})

export const Finite = refine<Scalar.Finite>((value) =>
  Number.isFinite(value)
    ? Result.success(value as Scalar.Finite)
    : Result.failure({
        tag: "Scalar/NotFinite",
        value
      }),
  "a finite number"
)

export const NonNegative = refine<Scalar.NonNegative>((value) => {
  const finite = Finite.result(value)
  if (!finite.ok) {
    return finite
  }

  return value >= 0
    ? Result.success(value as Scalar.NonNegative)
    : Result.failure({
        tag: "Scalar/Negative",
        value
      })
}, "a finite number, 0 or more")

export const Positive = refine<Scalar.Positive>((value) => {
  const finite = Finite.result(value)
  if (!finite.ok) {
    return finite
  }

  return value > 0
    ? Result.success(value as Scalar.Positive)
    : Result.failure({
        tag: "Scalar/NonPositive",
        value
      })
}, "a finite number above 0")

export const clamp = (value: number, min: number, max: number): Scalar.Finite =>
  Math.min(Math.max(value, min), max) as Scalar.Finite

export const lerp = (start: number, end: number, amount: number): Scalar.Finite =>
  (start + (end - start) * amount) as Scalar.Finite

export const approach = (
  current: Scalar.Finite,
  target: Scalar.Finite,
  maxDelta: Scalar.NonNegative
): Scalar.Finite => {
  if (current < target) {
    return Math.min(current + maxDelta, target) as Scalar.Finite
  }

  return Math.max(current - maxDelta, target) as Scalar.Finite
}

export const inverseLerp = (
  start: number,
  end: number,
  value: number
): Result.Result<Scalar.Finite, Scalar.InterpolationError> => {
  if (start === end) {
    return Result.failure({
      tag: "Scalar/ZeroRange",
      start,
      end
    })
  }

  return Result.success(((value - start) / (end - start)) as Scalar.Finite)
}

export const remap = (
  value: number,
  inputStart: number,
  inputEnd: number,
  outputStart: number,
  outputEnd: number
): Result.Result<Scalar.Finite, Scalar.InterpolationError> => {
  const amount = inverseLerp(inputStart, inputEnd, value)
  if (!amount.ok) {
    return amount
  }

  return Result.success(lerp(outputStart, outputEnd, amount.value))
}
