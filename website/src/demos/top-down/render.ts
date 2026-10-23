// What the top-down game looks like: one render system per kind of entity,
// mirroring the simulation into Pixi graphics. The simulation itself is the
// tested, headless one in integration/top-down; nothing here changes it.
import { Descriptor } from "@typeonce/ritmo"
import { RenderSync } from "@typeonce/ritmo-render"
import type { NodeRegistry } from "@typeonce/ritmo-render"
import { Collectable, Collider, Game, Player, Position, Velocity, Wall } from "@typeonce/ritmo-integration-top-down/schema.ts"
import { Graphics } from "pixi.js"

import { colors } from "./colors.ts"

export const PlayerNodes = Descriptor.Service<NodeRegistry.NodeRegistry<Graphics>>()("TopDown/PlayerNodes")
export const WallNodes = Descriptor.Service<NodeRegistry.NodeRegistry<Graphics>>()("TopDown/WallNodes")
export const PickupNodes = Descriptor.Service<NodeRegistry.NodeRegistry<Graphics>>()("TopDown/PickupNodes")

// Walls never move: sized once from their collider.
const RenderWalls = RenderSync.system(Game, {
  name: "TopDown/RenderWalls",
  renderable: Wall,
  transform: Position,
  registry: WallNodes,
  select: { collider: Game.Query.read(Collider) },
  create: ({ data }) => {
    const { width, height } = data.collider.get()
    return new Graphics().rect(-width / 2, -height / 2, width, height).fill(colors.wall)
  },
  apply: (node, { transform }) => node.position.set(transform.x, transform.y)
})

// Pickups are the changing cell of the brand: a small Tick square. Collecting
// one despawns it, and the registry destroys its node.
const RenderPickups = RenderSync.system(Game, {
  name: "TopDown/RenderPickups",
  renderable: Collectable,
  transform: Position,
  registry: PickupNodes,
  create: () => new Graphics().rect(-14, -14, 28, 28).fill(colors.pickup).rect(-24, -24, 48, 48).stroke({ color: colors.pickup, width: 2, alpha: 0.35 }),
  apply: (node, { transform }) => node.position.set(transform.x, transform.y)
})

// The player: a paper block with a notch on the side it last moved towards.
const RenderPlayer = RenderSync.system(Game, {
  name: "TopDown/RenderPlayer",
  renderable: Player,
  transform: Position,
  registry: PlayerNodes,
  select: { collider: Game.Query.read(Collider), velocity: Game.Query.read(Velocity) },
  create: ({ data }) => {
    const { width, height } = data.collider.get()
    return new Graphics()
      .rect(-width / 2, -height / 2, width, height)
      .fill(colors.player)
      .rect(width / 2 - 8, -6, 8, 12)
      .fill(colors.pickup)
  },
  apply: (node, { transform, data }) => {
    node.position.set(transform.x, transform.y)
    const velocity = data.velocity.get()
    if (velocity.x !== 0 || velocity.y !== 0) node.rotation = Math.atan2(velocity.y, velocity.x)
  }
})

/** Ticked once per drawn frame, after the fixed updates. */
export const renderSchedule = Game.Schedule(RenderWalls, RenderPickups, RenderPlayer)
