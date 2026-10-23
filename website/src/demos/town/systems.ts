// The town's rules. Each system declares exactly what it reads and writes;
// the schedule (schedules.ts) decides when each runs.
import { Clock } from "@typeonce/ritmo"
import * as Random from "@typeonce/ritmo-math/Random"

import { cellInFront, cellPosition, directions, isOpenGround, opposite, playerStart, sameCell, signs, TILE_SIZE, villagers } from "./map.ts"
import type { Cell, Direction } from "./map.ts"
import {
  BUMP,
  Dialogue,
  Facing,
  Game,
  Input,
  Look,
  LOOK_AROUND,
  Mode,
  PACE_REST,
  Patrol,
  Player,
  Position,
  Rng,
  Signpost,
  Solid,
  Stride,
  Talkable,
  Tile,
  Time,
  TURN,
  TYPE,
  Villager,
  WALK
} from "./schema.ts"
import type { Foot, StrideValue } from "./schema.ts"

// ── Setup ───────────────────────────────────────────────────────────────

const standing: StrideValue = { kind: "still", foot: "left", rested: true }

/** Puts the player, the villagers, and the signs on the map. */
export const SpawnTown = Game.System(
  "Town/SpawnTown",
  { commands: Game.System.commands(Game.System.spawns(Player, Villager, Patrol, Signpost)) },
  ({ commands }) => {
    commands.spawn(Game.Command.spawn(
      Game.Command.entry(Player, {}),
      Game.Command.entry(Tile, playerStart.cell),
      Game.Command.entry(Position, cellPosition(playerStart.cell)),
      Game.Command.entry(Facing, playerStart.facing),
      Game.Command.entry(Look, { character: playerStart.character }),
      Game.Command.entry(Stride, standing),
      Game.Command.entry(Solid, {})
    ))
    for (const villager of villagers) {
      const draft = Game.Command.spawn(
        Game.Command.entry(Villager, {}),
        Game.Command.entry(Tile, villager.cell),
        Game.Command.entry(Position, cellPosition(villager.cell)),
        Game.Command.entry(Facing, villager.facing),
        Game.Command.entry(Look, { character: villager.character }),
        Game.Command.entry(Talkable, { speaker: villager.speaker, pages: villager.pages }),
        Game.Command.entry(Solid, {})
      )
      if ("route" in villager) {
        commands.spawn(Game.Command.extend(
          draft,
          Game.Command.entry(Patrol, { ends: villager.route, heading: 1, rest: 0 }),
          Game.Command.entry(Stride, standing)
        ))
      } else {
        commands.spawn(draft)
      }
    }
    for (const sign of signs) {
      commands.spawn(Game.Command.spawn(
        Game.Command.entry(Signpost, {}),
        Game.Command.entry(Tile, sign.cell),
        Game.Command.entry(Position, cellPosition(sign.cell)),
        Game.Command.entry(Talkable, { speaker: "Sign", pages: sign.pages }),
        Game.Command.entry(Solid, {})
      ))
    }
  }
)

// ── Walking ─────────────────────────────────────────────────────────────

/** One read-write slot of an actor's data: a query write cell. */
interface Slot<T> {
  get(): T
  set(value: T): void
}

/** The data every walking actor has: the player and the pacing villagers. */
interface Mover {
  readonly tile: Slot<Cell>
  readonly position: Slot<{ readonly x: number; readonly y: number }>
  readonly facing: Slot<Direction>
  readonly stride: Slot<StrideValue>
}

/** Whether a solid actor stands on `cell`, or is still leaving it mid-step. */
const occupies = (blocker: { readonly tile: Cell; readonly stride: StrideValue | undefined }, cell: Cell): boolean =>
  sameCell(blocker.tile, cell) || (blocker.stride?.kind === "walk" && sameCell(blocker.stride.from, cell))

type DirectionActions = { readonly [K in "up" | "down" | "left" | "right"]: { readonly held: boolean; readonly pressed: boolean } }

/**
 * The direction the player holds (or tapped within this step): the one they
 * face if held, so walking straight never flickers, else the first held.
 */
const heldDirection = (input: { readonly actions: DirectionActions }, facing: Direction): Direction | undefined => {
  const down = (action: { readonly held: boolean; readonly pressed: boolean }) => action.held || action.pressed
  const held = {
    Down: down(input.actions.down),
    Up: down(input.actions.up),
    Left: down(input.actions.left),
    Right: down(input.actions.right)
  } satisfies Record<Direction, boolean>
  return held[facing] ? facing : directions.find((direction) => held[direction])
}

const otherFoot = (foot: Foot): Foot => foot === "left" ? "right" : "left"

/** The pixel position `elapsed` steps into a walk from `from` to `to`: whole pixels, exact on both tiles. */
const walkPosition = (from: Cell, to: Cell, elapsed: number) => {
  const moved = Math.round((TILE_SIZE * elapsed) / Clock.steps(WALK))
  const start = cellPosition(from)
  return { x: start.x + (to.col - from.col) * moved, y: start.y + (to.row - from.row) * moved }
}

/**
 * Moves a walk, turn, or bump on by one step of the clock. Returns true
 * while one is under way (a begun step always finishes), false once the
 * actor stands on its tile and may decide what to do next.
 */
const advanceStride = (mover: Mover): boolean => {
  const stride = mover.stride.get()
  if (stride.kind === "still") return false
  const elapsed = stride.elapsed + 1
  if (stride.kind === "walk") {
    mover.position.set(walkPosition(stride.from, mover.tile.get(), elapsed))
    mover.stride.set(elapsed >= Clock.steps(WALK) ? { kind: "still", foot: otherFoot(stride.foot), rested: false } : { ...stride, elapsed })
    return true
  }
  const length = Clock.steps(stride.kind === "turn" ? TURN : BUMP)
  mover.stride.set(elapsed >= length
    ? { kind: "still", foot: stride.kind === "bump" ? otherFoot(stride.foot) : stride.foot, rested: true }
    : { ...stride, elapsed })
  return true
}

/** Starts a step onto the tile in front, taking that tile at once so nothing else can claim it meanwhile. */
const startWalk = (mover: Mover, foot: Foot) => {
  const tile = mover.tile.get()
  const target = cellInFront(tile, mover.facing.get())
  mover.tile.set(target)
  mover.position.set(walkPosition(tile, target, 1))
  mover.stride.set({ kind: "walk", foot, elapsed: 1, from: tile })
}

/**
 * Moves the player tile by tile, one clock step at a time. On a tile, the
 * held direction turns the player (from rest, a tap only turns), steps onto
 * the next tile when it is free, or bumps in place when something solid is
 * there.
 */
export const WalkPlayer = Game.System(
  "Town/WalkPlayer",
  {
    queries: {
      player: Game.Query({
        selection: {
          tile: Game.Query.write(Tile),
          position: Game.Query.write(Position),
          facing: Game.Query.write(Facing),
          stride: Game.Query.write(Stride)
        },
        with: [Player]
      }),
      blockers: Game.Query({ selection: { tile: Game.Query.read(Tile), stride: Game.Query.optional(Stride) }, with: [Solid], without: [Player] })
    },
    resources: {
      time: Game.System.readResource(Time),
      input: Game.System.readResource(Input)
    }
  },
  ({ queries, resources }) => {
    if (resources.time.get().dt === 0) return
    const player = queries.player.single()
    if (!player.ok) return
    const mover: Mover = player.value.data
    if (advanceStride(mover)) return

    const stride = mover.stride.get()
    if (stride.kind !== "still") return
    const direction = heldDirection(resources.input.get(), mover.facing.get())
    if (direction === undefined) {
      if (!stride.rested) mover.stride.set({ ...stride, rested: true })
      return
    }
    if (direction !== mover.facing.get()) {
      mover.facing.set(direction)
      if (stride.rested) {
        mover.stride.set({ kind: "turn", foot: stride.foot, elapsed: 1 })
        return
      }
    }

    const target = cellInFront(mover.tile.get(), direction)
    const taken = queries.blockers.each().some(({ data }) => occupies({ tile: data.tile.get(), stride: data.stride.value() }, target))
    if (!isOpenGround(target) || taken) {
      mover.stride.set({ kind: "bump", foot: stride.foot, elapsed: 1 })
      return
    }
    startWalk(mover, stride.foot)
  }
)

const towards = (from: Cell, to: Cell): Direction =>
  to.col > from.col ? "Right" : to.col < from.col ? "Left" : to.row > from.row ? "Down" : "Up"

/**
 * Walks each pacing villager to the end of its route and back, with a rest
 * of `PACE_REST` to twice that at each end (drawn from `Rng`, so a run
 * replays exactly). When the next tile is taken (the player, a sign,
 * anyone), the villager waits a moment and tries again: it never steps
 * into a solid tile or another actor.
 */
export const PaceVillagers = Game.System(
  "Town/PaceVillagers",
  {
    queries: {
      walkers: Game.Query({
        selection: {
          tile: Game.Query.write(Tile),
          position: Game.Query.write(Position),
          facing: Game.Query.write(Facing),
          stride: Game.Query.write(Stride),
          patrol: Game.Query.write(Patrol)
        }
      }),
      blockers: Game.Query({ selection: { tile: Game.Query.read(Tile), stride: Game.Query.optional(Stride) }, with: [Solid], without: [Patrol] })
    },
    resources: {
      time: Game.System.readResource(Time),
      rng: Game.System.writeResource(Rng)
    }
  },
  ({ queries, resources }) => {
    if (resources.time.get().dt === 0) return
    const random = Random.draw(resources.rng)
    const rest = Clock.steps(PACE_REST)
    for (const { data } of queries.walkers.each()) {
      const mover: Mover = data
      if (advanceStride(mover)) continue
      const patrol = data.patrol.get()
      if (patrol.rest > 0) {
        data.patrol.set({ ...patrol, rest: patrol.rest - 1 })
        continue
      }
      const tile = mover.tile.get()
      const end = patrol.ends[patrol.heading]
      if (sameCell(tile, end)) {
        data.patrol.set({ ends: patrol.ends, heading: patrol.heading === 0 ? 1 : 0, rest: random.integer(rest, rest * 2 + 1) })
        continue
      }
      mover.facing.set(towards(tile, end))
      const target = cellInFront(tile, mover.facing.get())
      const taken = queries.blockers.each().some((blocker) => occupies({ tile: blocker.data.tile.get(), stride: blocker.data.stride.value() }, target))
      if (!isOpenGround(target) || taken) {
        data.patrol.set({ ...patrol, rest: random.integer(rest / 2, rest) })
        continue
      }
      const stride = mover.stride.get()
      startWalk(mover, stride.kind === "still" ? stride.foot : "left")
    }
  }
)

/** Every `LOOK_AROUND`, each villager standing in place may face a new direction (a coin flip, then a random direction). */
export const LookAround = Game.System(
  "Town/LookAround",
  {
    queries: {
      villagers: Game.Query({ selection: { facing: Game.Query.write(Facing) }, with: [Villager], without: [Patrol] })
    },
    resources: {
      time: Game.System.readResource(Time),
      rng: Game.System.writeResource(Rng)
    }
  },
  ({ queries, resources }) => {
    if (!Clock.every(resources.time.get(), LOOK_AROUND)) return
    const random = Random.draw(resources.rng)
    for (const { data } of queries.villagers.each()) {
      if (random.next() < 0.5) continue
      const next = random.pick(directions)
      if (next !== undefined) data.facing.set(next)
    }
  }
)

// ── Talking ─────────────────────────────────────────────────────────────

/**
 * The action button, standing still and facing something talkable, opens
 * its pages and switches the mode to `Talking` (at the next
 * `applyStateTransitions()`). A villager turns to face the player.
 */
export const StartTalk = Game.System(
  "Town/StartTalk",
  {
    queries: {
      player: Game.Query({
        selection: { tile: Game.Query.read(Tile), facing: Game.Query.read(Facing), stride: Game.Query.read(Stride) },
        with: [Player]
      }),
      talkables: Game.Query({ selection: { tile: Game.Query.read(Tile), talkable: Game.Query.read(Talkable), stride: Game.Query.optional(Stride) } }),
      listeners: Game.Query({ selection: { facing: Game.Query.write(Facing) }, with: [Villager] })
    },
    resources: {
      input: Game.System.readResource(Input),
      dialogue: Game.System.writeResource(Dialogue)
    },
    nextMachines: { mode: Game.System.nextState(Mode) }
  },
  ({ queries, resources, nextMachines }) => {
    if (!resources.input.get().actions.action.pressed) return
    const player = queries.player.single()
    if (!player.ok || player.value.data.stride.get().kind !== "still") return
    const facing = player.value.data.facing.get()
    const target = cellInFront(player.value.data.tile.get(), facing)
    const found = queries.talkables.each().find((match) => sameCell(match.data.tile.get(), target))
    // Someone mid-step is not there yet: wait until they stand on the tile.
    if (found === undefined || (found.data.stride.value()?.kind ?? "still") !== "still") return

    const { speaker, pages } = found.data.talkable.get()
    resources.dialogue.set({ speaker, pages, page: 0, typed: 0 })
    nextMachines.mode.set("Talking")
    const listener = queries.listeners.get(found.entity.id)
    if (listener.ok) listener.value.data.facing.set(opposite[facing])
  }
)

/** Types the open page out, one letter every `TYPE`. */
export const TypeDialogue = Game.System(
  "Town/TypeDialogue",
  {
    resources: {
      time: Game.System.readResource(Time),
      dialogue: Game.System.writeResource(Dialogue)
    }
  },
  ({ resources }) => {
    const dialogue = resources.dialogue.get()
    if (dialogue === null || !Clock.every(resources.time.get(), TYPE)) return
    const page = dialogue.pages[dialogue.page] ?? ""
    if (dialogue.typed < page.length) resources.dialogue.set({ ...dialogue, typed: dialogue.typed + 1 })
  }
)

/**
 * The action button while talking: shows the rest of a page still typing,
 * else turns to the next page, else closes the dialogue and goes back to
 * `Exploring`.
 */
export const AdvanceDialogue = Game.System(
  "Town/AdvanceDialogue",
  {
    resources: {
      input: Game.System.readResource(Input),
      dialogue: Game.System.writeResource(Dialogue)
    },
    nextMachines: { mode: Game.System.nextState(Mode) }
  },
  ({ resources, nextMachines }) => {
    if (!resources.input.get().actions.action.pressed) return
    const dialogue = resources.dialogue.get()
    const page = dialogue?.pages[dialogue.page]
    if (dialogue !== null && page !== undefined && dialogue.typed < page.length) {
      resources.dialogue.set({ ...dialogue, typed: page.length })
      return
    }
    if (dialogue !== null && dialogue.page + 1 < dialogue.pages.length) {
      resources.dialogue.set({ ...dialogue, page: dialogue.page + 1, typed: 0 })
      return
    }
    resources.dialogue.set(null)
    nextMachines.mode.set("Exploring")
  }
)
