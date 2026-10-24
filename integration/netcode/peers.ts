/**
 * Two ways to play the game over a network, and the ground truth they must
 * agree with.
 *
 * - Lockstep: a peer runs a tick only once it has both seats' input for it.
 *   Always right, but waits on the slowest message.
 * - Rollback: a peer runs every tick at once with a guess for the other
 *   seat, keeps where each tick started, and when real input contradicts a
 *   guess, goes back to that tick and runs again up to the present.
 *
 * How a rollback peer goes back is pluggable, so the same peer can be run
 * with checkpoints (the right tool) and with saves (`snapshot` / `restore`,
 * which reset reader positions and so change what the next tick does).
 */
import { draw, makeRuntime, simulate, type GameRuntime, type PlayerInput, type Screen, type Seats } from "./game.ts"
import { makeLink, type LinkOptions } from "./link.ts"
import { makeTimeline } from "./timeline.ts"

/** Each seat's input for every tick, as its player pressed it. */
export type Script = readonly [ReadonlyArray<PlayerInput>, ReadonlyArray<PlayerInput>]

/** Keeps where a tick starts, and goes back there. */
export interface Rewinder<Mark> {
  readonly take: (runtime: GameRuntime) => Mark
  readonly back: (runtime: GameRuntime, mark: Mark) => void
}

const fail = (what: string, error: unknown): never => {
  throw new Error(`${what}: ${JSON.stringify(error)}`)
}

export const checkpoints: Rewinder<ReturnType<GameRuntime["checkpoint"]>> = {
  take: (runtime) => runtime.checkpoint(simulate),
  back: (runtime, mark) => {
    const rewound = runtime.rewind(mark)
    if (!rewound.ok) fail("rewind", rewound.error)
  }
}

export const saves: Rewinder<unknown> = {
  take: (runtime) => {
    const saved = runtime.snapshot()
    return saved.ok ? saved.value : fail("snapshot", saved.error)
  },
  back: (runtime, mark) => {
    const restored = runtime.restore(mark)
    if (!restored.ok) fail("restore", restored.error)
  }
}

/** One peer of a game: its runtime, the screen it draws, and how many ticks it ran again. */
export interface Peer {
  readonly runtime: GameRuntime
  readonly screen: Screen
  /** Ticks run again after a rollback. */
  readonly ticksAgain: number
}

const seatsFor = (seat: 0 | 1, local: PlayerInput, remote: PlayerInput): Seats => seat === 0 ? [local, remote] : [remote, local]

const tickOk = (runtime: GameRuntime, schedule: typeof simulate) => {
  const ticked = runtime.tick(schedule)
  if (!ticked.ok) fail("tick", ticked.error)
}

const drawOk = (runtime: GameRuntime) => {
  const ticked = runtime.tick(draw)
  if (!ticked.ok) fail("draw", ticked.error)
}

/** Runs the whole script on one runtime with every input known: what every peer must end up with. */
export const truth = (script: Script, prepare: (runtime: GameRuntime) => void = () => {}): Peer => {
  const { runtime, source, screen } = makeRuntime()
  prepare(runtime)
  for (let tick = 0; tick < script[0].length; tick++) {
    source.current = [script[0][tick]!, script[1][tick]!]
    tickOk(runtime, simulate)
    drawOk(runtime)
  }
  return { runtime, screen, ticksAgain: 0 }
}

interface Message {
  readonly tick: number
  readonly input: PlayerInput
}

interface Side {
  readonly frame: (frame: number, arrived: ReadonlyArray<Message>) => void
  readonly finish: (arrived: ReadonlyArray<Message>) => void
  readonly peer: () => Peer
}

const lockstepSide = (seat: 0 | 1, script: Script, prepare: (runtime: GameRuntime) => void): Side => {
  const { runtime, source, screen } = makeRuntime()
  prepare(runtime)
  const timeline = makeTimeline()
  const ticks = script[seat].length
  let next = 0
  const runReady = (upTo: number) => {
    while (next <= upTo && next < ticks && timeline.known(next)) {
      source.current = seatsFor(seat, script[seat][next]!, timeline.use(next))
      tickOk(runtime, simulate)
      next++
    }
    drawOk(runtime)
  }
  return {
    frame: (frame, arrived) => {
      for (const message of arrived) timeline.confirm(message.tick, message.input)
      runReady(frame)
    },
    finish: (arrived) => {
      for (const message of arrived) timeline.confirm(message.tick, message.input)
      runReady(ticks)
    },
    peer: () => ({ runtime, screen, ticksAgain: 0 })
  }
}

const rollbackSide = <Mark>(seat: 0 | 1, script: Script, rewinder: Rewinder<Mark>, prepare: (runtime: GameRuntime) => void): Side => {
  const { runtime, source, screen } = makeRuntime()
  prepare(runtime)
  const timeline = makeTimeline()
  const history = new Map<number, Mark>()
  const ticks = script[seat].length
  let next = 0
  let ticksAgain = 0

  const run = () => {
    history.set(next, rewinder.take(runtime))
    source.current = seatsFor(seat, script[seat][next]!, timeline.use(next))
    tickOk(runtime, simulate)
    next++
  }
  const correct = (arrived: ReadonlyArray<Message>) => {
    for (const message of arrived) timeline.confirm(message.tick, message.input)
    const wrong = timeline.takeWrong()
    if (wrong === undefined || wrong >= next) return
    const present = next
    rewinder.back(runtime, history.get(wrong)!)
    next = wrong
    while (next < present) run()
    ticksAgain += present - wrong
  }
  return {
    frame: (frame, arrived) => {
      correct(arrived)
      if (frame < ticks) run()
      drawOk(runtime)
    },
    finish: (arrived) => {
      correct(arrived)
      drawOk(runtime)
    },
    peer: () => ({ runtime, screen, ticksAgain })
  }
}

export type Mode =
  | { readonly _tag: "Lockstep" }
  | { readonly _tag: "Rollback"; readonly rewinder: Rewinder<any> }

export interface MatchOptions {
  readonly script: Script
  readonly mode: Mode
  /** One link per direction: seat 0 to seat 1, and back. */
  readonly links: readonly [LinkOptions, LinkOptions]
  /** Brings each runtime to the shared start (spawns the players, or restores a save). */
  readonly prepare: (runtime: GameRuntime, seat: 0 | 1) => void
}

/** Plays the script on two peers connected by fake links, frame by frame, then lets every message arrive. */
export const match = (options: MatchOptions): readonly [Peer, Peer] => {
  const { script, mode } = options
  const side = (seat: 0 | 1) =>
    mode._tag === "Lockstep"
      ? lockstepSide(seat, script, (runtime) => options.prepare(runtime, seat))
      : rollbackSide(seat, script, mode.rewinder, (runtime) => options.prepare(runtime, seat))
  const sides = [side(0), side(1)] as const
  // Seat 0 sends on links[0] to seat 1; seat 1 sends on links[1] to seat 0.
  const links = [makeLink<Message>(options.links[0]), makeLink<Message>(options.links[1])] as const
  for (let frame = 0; frame < script[0].length; frame++) {
    links[0].send(frame, { tick: frame, input: script[0][frame]! })
    links[1].send(frame, { tick: frame, input: script[1][frame]! })
    sides[0].frame(frame, links[1].receive(frame))
    sides[1].frame(frame, links[0].receive(frame))
  }
  sides[0].finish(links[1].drain())
  sides[1].finish(links[0].drain())
  return [sides[0].peer(), sides[1].peer()]
}
