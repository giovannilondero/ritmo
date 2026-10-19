import {
  Collider,
  Collectable,
  Game,
  Player,
  Position,
  Velocity,
  Wall
} from "./schema.ts"

export const PlayerMovementQuery = Game.Query({
  selection: {
    position: Game.Query.write(Position),
    velocity: Game.Query.write(Velocity),
    collider: Game.Query.read(Collider),
    player: Game.Query.read(Player)
  }
})

export const PlayerVelocityQuery = Game.Query({
  selection: {
    velocity: Game.Query.read(Velocity),
    player: Game.Query.read(Player)
  }
})

export const PlayerPositionQuery = Game.Query({
  selection: {
    position: Game.Query.read(Position),
    player: Game.Query.read(Player)
  }
})

export const WallCollisionQuery = Game.Query({
  selection: {
    position: Game.Query.read(Position),
    collider: Game.Query.read(Collider),
    wall: Game.Query.read(Wall)
  }
})

export const CollectableQuery = Game.Query({
  selection: {
    position: Game.Query.read(Position),
    collider: Game.Query.read(Collider),
    collectable: Game.Query.read(Collectable)
  }
})
