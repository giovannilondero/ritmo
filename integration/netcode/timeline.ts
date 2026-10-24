/**
 * What a peer knows of the other seat's input: confirmed ticks, and the
 * guesses it ran with for ticks not confirmed yet. The guess for a tick is
 * the latest input confirmed before it (players tend to hold a direction),
 * or idle before any arrives.
 */
import { idle, type PlayerInput } from "./game.ts"

const same = (a: PlayerInput, b: PlayerInput) => a.dx === b.dx && a.dy === b.dy && a.fire === b.fire

export interface Timeline {
  /** Real input for `tick` arrived. */
  readonly confirm: (tick: number, input: PlayerInput) => void
  /** The input to run `tick` with: confirmed, or a guess. Remembers what it gave. */
  readonly use: (tick: number) => PlayerInput
  /**
   * The earliest tick that ran with a guess the confirmed input now
   * contradicts, or `undefined`. Forgets it: the caller ticks again from there.
   */
  readonly takeWrong: () => number | undefined
  /** Whether real input for `tick` arrived. */
  readonly known: (tick: number) => boolean
}

export const makeTimeline = (): Timeline => {
  const confirmed = new Map<number, PlayerInput>()
  const used = new Map<number, PlayerInput>()
  let wrong: number | undefined

  const guess = (tick: number): PlayerInput => {
    for (let at = tick; at >= 0; at--) {
      const known = confirmed.get(at)
      if (known !== undefined) return known
    }
    return idle
  }

  return {
    confirm: (tick, input) => {
      confirmed.set(tick, input)
      // A later confirmation also changes the guesses after it: recheck every tick that ran since.
      for (const [at, ran] of used) {
        if (at < tick || same(ran, guess(at))) continue
        wrong = wrong === undefined ? at : Math.min(wrong, at)
      }
    },
    use: (tick) => {
      const input = guess(tick)
      used.set(tick, input)
      return input
    },
    takeWrong: () => {
      const found = wrong
      wrong = undefined
      return found
    },
    known: (tick) => confirmed.has(tick)
  }
}
