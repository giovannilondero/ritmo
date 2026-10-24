import { describe, expect, it } from "vitest"

import { Random } from "@typeonce/ritmo-math"

import { setup, type GameRuntime, type PlayerInput } from "../game.ts"
import type { LinkOptions } from "../link.ts"
import { checkpoints, match, saves, truth, type Peer, type Script } from "../peers.ts"

/** A player who holds a direction for a while, then picks another, and fires now and then. */
const player = (seed: number, ticks: number): ReadonlyArray<PlayerInput> => {
  const random = Random.make(seed)
  const inputs: Array<PlayerInput> = []
  let held: PlayerInput = { dx: 0, dy: 0, fire: false }
  for (let tick = 0; tick < ticks; tick++) {
    if (random.next() < 0.1) {
      const pick = (): -1 | 0 | 1 => random.pick([-1, 0, 1] as const)!
      held = { dx: pick(), dy: pick(), fire: false }
    }
    inputs.push({ ...held, fire: random.next() < 0.3 })
  }
  return inputs
}

const script = (ticks: number): Script => [player(1, ticks), player(2, ticks)]

const slow: readonly [LinkOptions, LinkOptions] = [
  { seed: 11, latency: 3, jitter: 5 },
  { seed: 12, latency: 2, jitter: 6 }
]

const start = (runtime: GameRuntime) => {
  const ticked = runtime.tick(setup)
  if (!ticked.ok) throw new Error("setup failed")
}

/** The whole world's checksum: equal checksums are equal worlds. */
const world = (peer: Peer) => {
  const sum = peer.runtime.checksum()
  if (!sum.ok) throw new Error("checksum failed")
  return sum.value
}

/** What the screen shows: every sprite and where. */
const shown = (peer: Peer) => [...peer.screen.sprites.entries()].map(([entity, sprite]) => [entity, sprite.x, sprite.y])

describe("two peers play the same game over a slow, reordering network", () => {
  const ticks = 600
  const played = script(ticks)
  const expected = truth(played, start)

  it("ends with shots on screen, so the comparisons below have something to compare", () => {
    expect(expected.screen.draws.flatMap((drawn) => drawn.created).length).toBeGreaterThan(20)
    expect(expected.screen.sprites.size).toBeGreaterThan(0)
  })

  it("agrees with the truth in lockstep", () => {
    const peers = match({ script: played, mode: { _tag: "Lockstep" }, links: slow, prepare: start })
    expect(world(peers[0])).toBe(world(expected))
    expect(world(peers[1])).toBe(world(expected))
  })

  it("agrees with the truth when rolling back with checkpoints", () => {
    const peers = match({ script: played, mode: { _tag: "Rollback", rewinder: checkpoints }, links: slow, prepare: start })
    expect(peers[0].ticksAgain).toBeGreaterThan(100)
    expect(peers[1].ticksAgain).toBeGreaterThan(100)
    expect(world(peers[0])).toBe(world(expected))
    expect(world(peers[1])).toBe(world(expected))
  })

  // A rewind that takes a shot away, and ticks that bring it back under the
  // same id, reach the screen as one change: never as a sprite taken down
  // and made again in the same draw.
  it("shows the same screen, and never takes down and remakes a sprite in one draw", () => {
    const peers = match({ script: played, mode: { _tag: "Rollback", rewinder: checkpoints }, links: slow, prepare: start })
    for (const peer of peers) {
      expect(shown(peer)).toEqual(shown(expected))
      for (const drawn of peer.screen.draws) {
        expect(drawn.destroyed.filter((entity) => drawn.created.includes(entity))).toEqual([])
      }
    }
  })

  // A save is not a rewind: restoring one restarts every reader, so Arm sees
  // every flying shot as new and gives it its full range again.
  it.fails("does not agree when rolling back with saves", () => {
    const peers = match({ script: played, mode: { _tag: "Rollback", rewinder: saves }, links: slow, prepare: start })
    expect(world(peers[0])).toBe(world(expected))
  })
})

describe("a player joins a game already running", () => {
  const before = 200
  const after = 30
  const whole = script(before + after)
  const rest: Script = [whole[0].slice(before), whole[1].slice(before)]
  const host = truth([whole[0].slice(0, before), whole[1].slice(0, before)], start)
  const save = host.runtime.snapshot()
  if (!save.ok) throw new Error("snapshot failed")
  const join = (runtime: GameRuntime) => {
    const restored = runtime.restore(save.value)
    if (!restored.ok) throw new Error("restore failed")
  }

  it("agrees when every peer restores the same save at the join tick", () => {
    expect(host.screen.sprites.size).toBeGreaterThan(0)
    const expected = truth(rest, join)
    const peers = match({ script: rest, mode: { _tag: "Rollback", rewinder: checkpoints }, links: slow, prepare: join })
    expect(world(peers[0])).toBe(world(expected))
    expect(world(peers[1])).toBe(world(expected))
  })

  // The same save restarts the joiner's readers but not the host's, so Arm
  // gives the shots in flight their full range again on the joiner only.
  it("does not agree when only the joiner restores, and the host plays on", () => {
    const uninterrupted = truth(whole, start)
    const joined = truth(rest, join)
    expect(world(joined)).not.toBe(world(uninterrupted))
  })
})
