/**
 * Two peers of the shooter, each with its own runtime, screen, and session,
 * over memory links with latency, jitter, and loss, played frame by frame on
 * one test clock; and the reference every peer must agree with: one runtime
 * ticked with the input each seat's session recorded.
 */
import { HostClock } from "@typeonce/ritmo"
import { MemoryNetworkLink, Netcode } from "@typeonce/ritmo-netcode"

import { draw, idle, makeRuntime, playerInput, setup, simulate, step, type GameRuntime, type PlayerInput, type Screen } from "./game.ts"

export interface Peer {
  readonly runtime: GameRuntime
  readonly screen: Screen
  readonly session: Netcode.Session<PlayerInput, unknown>
  /** The input this seat's session recorded, by tick. */
  readonly recorded: Map<number, PlayerInput>
}

export interface MatchOptions {
  readonly mode: "rollback" | "lockstep"
  /** Each seat's input on each frame. */
  readonly script: readonly [ReadonlyArray<PlayerInput>, ReadonlyArray<PlayerInput>]
  readonly latencyMS: number
  readonly jitterMS: number
  readonly loss?: number
  /** Idle frames after the script, so every guess settles. */
  readonly tail?: number
  /** Frames on which seat 0 asks for a resync. */
  readonly resyncAt?: ReadonlyArray<number>
}

const stepMS = step.dt * 1000

const fail = (what: string, error: unknown): never => {
  throw new Error(`${what}: ${JSON.stringify(error)}`)
}

export const match = (options: MatchOptions): readonly [Peer, Peer] => {
  const hostClock = HostClock.test()
  const links = MemoryNetworkLink.make({ peers: 2, hostClock, seed: 11, latencyMS: options.latencyMS, jitterMS: options.jitterMS, loss: options.loss ?? 0 })
  if (!links.ok) return fail("links", links.error)
  const peer = (seat: 0 | 1): Peer => {
    const seats = Netcode.seats(playerInput, { count: 2, idle })
    if (!seats.ok) return fail("seats", seats.error)
    const { runtime, screen } = makeRuntime(seats.value.source)
    // Only seat 0 sets up: seat 1 starts from its save.
    if (seat === 0 && !runtime.tick(setup).ok) fail("setup", seat)
    const shared = { simulate, seats: seats.value, seat, links: [links.value[seat]!], hostClock, step }
    const session = options.mode === "rollback" ? Netcode.rollback(runtime, shared) : Netcode.lockstep(runtime, shared)
    if (!session.ok) return fail("session", session.error)
    return { runtime, screen, session: session.value, recorded: new Map() }
  }
  const peers = [peer(0), peer(1)] as const
  const frames = options.script[0].length + (options.tail ?? 120)
  for (let frame = 0; frame < frames; frame++) {
    if (options.resyncAt?.includes(frame) === true) peers[0].session.resync()
    for (const [seat, { runtime, session, recorded }] of peers.entries()) {
      const local = options.script[seat]![frame] ?? idle
      const advanced = session.advance(local)
      if (!advanced.ok) fail(`seat ${seat}, frame ${frame}`, advanced.error)
      else if (advanced.value._tag !== "Waiting" && advanced.value.input !== undefined) recorded.set(advanced.value.input, local)
      // The screen draws every frame, outside the simulation: it never rewinds.
      if (!runtime.tick(draw).ok) fail("draw", seat)
    }
    if (!hostClock.adjust(stepMS).ok) fail("clock", frame)
  }
  return peers
}

/**
 * One runtime that knew every input: seat 0's setup, the save both peers
 * started from, then each tick with the input each seat's session recorded,
 * drawn after every tick. Without resyncs, every peer must end on its world.
 */
export const truth = (peers: readonly [Peer, Peer], ticks: number) => {
  let current: ReadonlyArray<PlayerInput> = [idle, idle]
  const { runtime, screen } = makeRuntime({ snapshot: () => current })
  if (!runtime.tick(setup).ok) fail("setup", "truth")
  const saved = runtime.snapshot()
  if (!saved.ok || !runtime.restore(JSON.parse(JSON.stringify(saved.value))).ok) fail("start", "truth")
  for (let tick = 0; tick < ticks; tick++) {
    current = [peers[0].recorded.get(tick) ?? idle, peers[1].recorded.get(tick) ?? idle]
    if (!runtime.tick(simulate).ok) fail("tick", tick)
    if (!runtime.tick(draw).ok) fail("draw", tick)
  }
  return { runtime, screen }
}

