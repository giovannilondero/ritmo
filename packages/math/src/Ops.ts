/**
 * Math functions that return the same bits on every JavaScript engine and
 * CPU, so a simulation replays exactly on any device.
 *
 * The spec lets engines approximate `Math.sin`, `cos`, `tan`, `asin`, `acos`,
 * `atan`, `atan2`, `exp`, `tanh`, `pow`, `hypot`, and `a ** b`, and they do:
 * Chrome, Safari, macOS, and Linux disagree in the last bit, and a
 * simulation grows that bit into a different run. Use these in simulation
 * code instead; each is a pure-JavaScript port of fdlibm (musl libm) built
 * only from operations every engine rounds exactly.
 *
 * Keep using `Math.abs`, `sign`, `min`, `max`, `floor`, `ceil`, `round`,
 * `trunc`, `sqrt`, `imul`, `fround`, `+ - * /`, and `x ** 2`: they are
 * already exact everywhere. Use `Random` for randomness and `Clock` for time.
 * Code that only draws (rendering, effects) can use `Math` freely.
 *
 * @example
 * ```ts
 * // Inside a system: aim, then move along the heading.
 * const heading = Ops.atan2(target.y - position.y, target.x - position.x)
 * const step = { x: Ops.cos(heading) * speed * dt, y: Ops.sin(heading) * speed * dt }
 * const damping = Ops.exp(-friction * dt)
 * ```
 *
 * @module Ops
 * @docGroup helpers
 *
 * @categoryDescription Trigonometry
 * Sine, cosine, tangent, and their inverses, in radians.
 *
 * @categoryDescription Exponentials
 * Exponential, hyperbolic tangent, and powers.
 *
 * @categoryDescription Lengths
 * Euclidean length without overflow.
 */

import * as fdlibm from "./internal/fdlibm.ts"

/**
 * Sine of `x` radians. Same bits on every engine (within 1 ulp of the exact
 * value); use instead of `Math.sin` in simulation code.
 *
 * @category Trigonometry
 */
export const sin: (x: number) => number = fdlibm.sin

/**
 * Cosine of `x` radians. Same bits on every engine (within 1 ulp of the
 * exact value); use instead of `Math.cos` in simulation code.
 *
 * @category Trigonometry
 */
export const cos: (x: number) => number = fdlibm.cos

/**
 * Tangent of `x` radians. Same bits on every engine (within 1 ulp of the
 * exact value); use instead of `Math.tan` in simulation code.
 *
 * @category Trigonometry
 */
export const tan: (x: number) => number = fdlibm.tan

/**
 * Arcsine of `x` in radians, in [-π/2, π/2]; NaN outside [-1, 1]. Same bits
 * on every engine; use instead of `Math.asin` in simulation code.
 *
 * @category Trigonometry
 */
export const asin: (x: number) => number = fdlibm.asin

/**
 * Arccosine of `x` in radians, in [0, π]; NaN outside [-1, 1]. Same bits on
 * every engine; use instead of `Math.acos` in simulation code.
 *
 * @category Trigonometry
 */
export const acos: (x: number) => number = fdlibm.acos

/**
 * Arctangent of `x` in radians, in (-π/2, π/2). Same bits on every engine;
 * use instead of `Math.atan` in simulation code. For the angle of a vector,
 * use `atan2`.
 *
 * @category Trigonometry
 */
export const atan: (x: number) => number = fdlibm.atan

/**
 * The angle of the vector (x, y) in radians, in [-π, π] (note the argument
 * order: `y` first, like `Math.atan2`). Same bits on every engine; use
 * instead of `Math.atan2` in simulation code.
 *
 * @category Trigonometry
 */
export const atan2: (y: number, x: number) => number = fdlibm.atan2

/**
 * e raised to `x`. Same bits on every engine (within 1 ulp of the exact
 * value); use instead of `Math.exp` in simulation code, for example for
 * frame-rate independent damping `exp(-rate * dt)`.
 *
 * @category Exponentials
 */
export const exp: (x: number) => number = fdlibm.exp

/**
 * Hyperbolic tangent of `x`, in [-1, 1]. Same bits on every engine (within 2
 * ulp of the exact value, like the native one); use instead of `Math.tanh` in
 * simulation code.
 *
 * @category Exponentials
 */
export const tanh: (x: number) => number = fdlibm.tanh

/**
 * `base` raised to `exponent`, with the results of `base ** exponent` for
 * every special case (NaN, zeros, infinities, negative bases). Same bits on
 * every engine (within 1 ulp of the exact value); use instead of `Math.pow`
 * and `**` in simulation code. `x * x` and `x ** 2` are already exact.
 *
 * @category Exponentials
 */
export const pow: (base: number, exponent: number) => number = fdlibm.pow

/**
 * The length of the vector (x, y), `sqrt(x² + y²)` without overflow or
 * underflow. Same bits on every engine (within 1 ulp of the exact value);
 * use instead of `Math.hypot` in simulation code. Takes exactly two numbers;
 * for vectors use `Vec2.length` and `Vec2.distance`.
 *
 * @category Lengths
 */
export const hypot: (x: number, y: number) => number = fdlibm.hypot
