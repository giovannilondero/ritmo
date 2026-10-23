/**
 * A direction and strength, length at most 1, `y` growing down as on
 * screen, the same on every device and in `Controls`: a vector action, a
 * stick's tilt (dead zone removed, zero at rest, 1 at full tilt), or a
 * touch stick, swipe or aim.
 */
export interface Vector {
  readonly x: number
  readonly y: number
}

/** The four directions a digital vector binding names. */
export const directions = ["up", "down", "left", "right"] as const

/** One direction of a vector action; a keyboard timeline names it as `"move.right"`. */
export type Direction = (typeof directions)[number]

export const zero: Vector = { x: 0, y: 0 }

/** The internal action name of one direction of a vector, for timelines and the button trackers. */
export const directionName = (vector: string, direction: Direction): string => `${vector}.${direction}`

/**
 * The vector four held directions give: opposite directions cancel and a
 * diagonal has length 1, so it is not faster than a straight line.
 */
export const digital = (up: boolean, down: boolean, left: boolean, right: boolean): Vector => {
  const x = (right ? 1 : 0) - (left ? 1 : 0)
  const y = (down ? 1 : 0) - (up ? 1 : 0)
  if (x === 0 && y === 0) return zero
  return x !== 0 && y !== 0 ? { x: x * Math.SQRT1_2, y: y * Math.SQRT1_2 } : { x, y }
}

const lengthSquared = (vector: Vector): number => vector.x * vector.x + vector.y * vector.y

/** The longer of two vectors, the first on a tie: how vectors from several sources combine. */
export const longer = (a: Vector, b: Vector): Vector => lengthSquared(b) > lengthSquared(a) ? b : a

/** Whether a binding entry is a vector binding (`Keyboard.vector`, `Gamepad.vector`). */
export const isVectorBinding = (entry: unknown): entry is { readonly _tag: "Vector" } =>
  typeof entry === "object" && entry !== null && !Array.isArray(entry) && (entry as { readonly _tag?: unknown })._tag === "Vector"
