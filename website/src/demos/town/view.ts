// The world read as plain data, for the page, the renderer, and the check.
import { Dialogue, Facing, Game, Mode, Player, Position, Stride, Tile } from "./schema.ts"

/** The dialogue box: who speaks, the letters typed so far, and whether more follows. */
export interface DialogueView {
  readonly speaker: string
  readonly text: string
  /** The whole page has typed out. */
  readonly complete: boolean
  /** Another page follows this one. */
  readonly more: boolean
}

/** What the screen shows besides the map: the mode, and the dialogue box while talking. */
export const ReadScreen = Game.Inspector("Town/ReadScreen", {
  machines: { mode: Game.System.machine(Mode) },
  resources: { dialogue: Game.System.readResource(Dialogue) }
}, ({ machines, resources }) => {
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
  return { mode: machines.mode.get(), dialogue: box }
})

/** The player's tile, pixel position, facing, and stride, or `undefined` before setup. */
export const ReadPlayer = Game.Inspector("Town/ReadPlayer", {
  queries: {
    player: Game.Query({
      selection: {
        tile: Game.Query.read(Tile),
        position: Game.Query.read(Position),
        facing: Game.Query.read(Facing),
        stride: Game.Query.read(Stride)
      },
      with: [Player]
    })
  }
}, ({ queries }) => {
  const player = queries.player.single()
  if (!player.ok) return undefined
  const { data } = player.value
  return { tile: data.tile.get(), position: data.position.get(), facing: data.facing.get(), stride: data.stride.get().kind }
})
