// The world read as plain data, for the page, the renderer, and the check.
import { Dialogue, Facing, Game, Mode, Player, Position, Seat, Stride, Tile } from "./schema.ts"
import type { SeatValue } from "./schema.ts"

/** The dialogue box: who speaks, the letters typed so far, and whether more follows. */
export interface DialogueView {
  readonly speaker: string
  readonly text: string
  /** The whole page has typed out. */
  readonly complete: boolean
  /** Another page follows this one. */
  readonly more: boolean
}

/** What the screen shows besides the map: the mode, the dialogue box while talking, and who plays. */
export const ReadScreen = Game.Inspector("Town/ReadScreen", {
  machines: { mode: Game.System.machine(Mode) },
  resources: { dialogue: Game.System.readResource(Dialogue) },
  queries: { players: Game.Query({ selection: { seat: Game.Query.read(Seat) }, with: [Player] }) }
}, ({ machines, resources, queries }) => {
  const dialogue = resources.dialogue.get()
  const page = dialogue?.pages[dialogue.page]
  const box: DialogueView | null = dialogue === null || page === undefined
    ? null
    : {
      speaker: dialogue.speaker,
      text: page.slice(0, dialogue.typed),
      complete: dialogue.typed >= page.length,
      more: dialogue.page + 1 < dialogue.pages.length
    }
  const seats: ReadonlyArray<SeatValue> = queries.players.each().map(({ data }) => data.seat.get())
  return { mode: machines.mode.get(), dialogue: box, seats }
})

/** Each player's tile, pixel position, facing, and stride, by seat; a seat nobody holds is absent. */
export const ReadPlayers = Game.Inspector("Town/ReadPlayers", {
  queries: {
    players: Game.Query({
      selection: {
        seat: Game.Query.read(Seat),
        tile: Game.Query.read(Tile),
        position: Game.Query.read(Position),
        facing: Game.Query.read(Facing),
        stride: Game.Query.read(Stride)
      },
      with: [Player]
    })
  }
}, ({ queries }) => {
  const players: Partial<Record<SeatValue, { tile: { col: number; row: number }; position: { x: number; y: number }; facing: string; stride: string }>> = {}
  for (const { data } of queries.players.each()) {
    players[data.seat.get()] = { tile: data.tile.get(), position: data.position.get(), facing: data.facing.get(), stride: data.stride.get().kind }
  }
  return players
})
