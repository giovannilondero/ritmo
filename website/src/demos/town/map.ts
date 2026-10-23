// The town: a closed 24 x 18 tile map, the buildings and trees on it, and
// who stands where. Plain data shared by the simulation (what blocks a step)
// and the renderer (what each tile looks like); it names no renderer.

/** One tile of the map: its column from the left and row from the top. */
export interface Cell {
  readonly col: number
  readonly row: number
}

/** The four directions an actor faces and steps in. */
export const directions = ["Down", "Up", "Left", "Right"] as const
export type Direction = (typeof directions)[number]

/** One step in each direction, in tiles (rows grow down). */
export const directionStep = {
  Down: { col: 0, row: 1 },
  Up: { col: 0, row: -1 },
  Left: { col: -1, row: 0 },
  Right: { col: 1, row: 0 }
} as const satisfies Record<Direction, Cell>

export const opposite = {
  Down: "Up",
  Up: "Down",
  Left: "Right",
  Right: "Left"
} as const satisfies Record<Direction, Direction>

export const cellInFront = (cell: Cell, facing: Direction): Cell => ({
  col: cell.col + directionStep[facing].col,
  row: cell.row + directionStep[facing].row
})

export const sameCell = (a: Cell, b: Cell): boolean => a.col === b.col && a.row === b.row

/** Pixels per tile side, in the art and in the world. */
export const TILE_SIZE = 16
export const MAP_COLUMNS = 24
export const MAP_ROWS = 18

/** The top-left pixel of a cell. */
export const cellPosition = (cell: Cell): { readonly x: number; readonly y: number } => ({
  x: cell.col * TILE_SIZE,
  y: cell.row * TILE_SIZE
})

/** What covers the ground of one tile. */
export type Ground = "grass" | "path" | "water" | "flowers" | "bush"

/** One character per ground kind in the `groundRows` below. */
export const groundLegend: Readonly<Record<string, Ground>> = {
  ".": "grass",
  "#": "path",
  "~": "water",
  "*": "flowers",
  "o": "bush"
}

/** Ground kinds nobody can step on. */
const solidGround = {
  grass: false,
  path: false,
  water: true,
  flowers: false,
  bush: true
} as const satisfies Record<Ground, boolean>

/**
 * The ground, one character per tile (see `groundLegend`). Trees and the
 * house stand on grass and are listed below; the border is a ring of
 * trees, so the town is closed.
 */
export const groundRows: ReadonlyArray<string> = [
  "........................",
  "........................",
  "...*........***.........",
  "...*....o...***.........",
  "...*....o.......****....",
  ".....#..................",
  "...##################...",
  "...##################...",
  "...........##.......oo..",
  "...........##...........",
  "........**.##..~~~~~~...",
  "........**.##..~~~~~~...",
  "...........##..~~~~~~...",
  "..**.......##..~~~~~~...",
  "..**.########...........",
  "........................",
  "........................",
  "........................"
]

/** The ground of a cell, or `undefined` outside the map. */
export const groundAt = (cell: Cell): Ground | undefined => {
  const row = groundRows[cell.row]
  if (row === undefined || cell.col < 0 || cell.col >= MAP_COLUMNS) return undefined
  const char = row[cell.col]
  return char === undefined ? undefined : groundLegend[char]
}

/** The buildings, each one image of the house tileset; every tile they cover is solid. */
export type BuildingKind = "home"

export const buildingSize = {
  home: { columns: 4, rows: 3 }
} as const satisfies Record<BuildingKind, { readonly columns: number; readonly rows: number }>

export const buildings: ReadonlyArray<{ readonly kind: BuildingKind; readonly cell: Cell }> = [
  { kind: "home", cell: { col: 4, row: 2 } }
]

/** A tree covers 2 x 2 tiles from its top-left cell. */
export const TREE_SIZE = 2

const border: Array<Cell> = []
for (let col = 0; col < MAP_COLUMNS; col += TREE_SIZE) {
  border.push({ col, row: 0 }, { col, row: MAP_ROWS - TREE_SIZE })
}
for (let row = TREE_SIZE; row < MAP_ROWS - TREE_SIZE; row += TREE_SIZE) {
  border.push({ col: 0, row }, { col: MAP_COLUMNS - TREE_SIZE, row })
}

export const trees: ReadonlyArray<Cell> = [
  ...border,
  // A row of trees where a second house could stand.
  { col: 16, row: 2 },
  { col: 18, row: 2 },
  { col: 20, row: 2 },
  // A small grove in the south-west.
  { col: 2, row: 8 },
  { col: 4, row: 10 },
  { col: 2, row: 11 },
  { col: 6, row: 11 },
  { col: 19, row: 14 }
]

const covers = (origin: Cell, columns: number, rows: number, cell: Cell): boolean =>
  cell.col >= origin.col && cell.col < origin.col + columns && cell.row >= origin.row && cell.row < origin.row + rows

/**
 * Whether the map itself lets an actor stand on `cell`: inside the map, on
 * walkable ground, and not under a tree or a building. Actors and signs that
 * block a cell are entities, checked by the simulation.
 */
export const isOpenGround = (cell: Cell): boolean => {
  const ground = groundAt(cell)
  if (ground === undefined || solidGround[ground]) return false
  if (trees.some((tree) => covers(tree, TREE_SIZE, TREE_SIZE, cell))) return false
  return !buildings.some(({ kind, cell: origin }) => covers(origin, buildingSize[kind].columns, buildingSize[kind].rows, cell))
}

// ── Who stands where ────────────────────────────────────────────────────

/** The characters this town's actors are drawn as. */
export type Character = "boy" | "oldMan" | "inspector" | "monk"

/**
 * A page of dialogue: at most two rows of up to 26 letters, split by hand
 * with `\n` so the words never jump between rows while the text types out.
 */
export type Page = string

export const playerStart = {
  cell: { col: 6, row: 5 },
  facing: "Left",
  character: "boy"
} as const satisfies { readonly cell: Cell; readonly facing: Direction; readonly character: Character }

/** Someone to talk to. With a `route`, they pace between its two ends (in one row or one column). */
export interface VillagerSpec {
  readonly cell: Cell
  readonly facing: Direction
  readonly character: Character
  readonly speaker: string
  readonly pages: ReadonlyArray<Page>
  readonly route?: readonly [Cell, Cell]
}

export const villagers = [
  {
    cell: { col: 14, row: 9 },
    facing: "Down",
    character: "oldMan",
    speaker: "Ito",
    pages: [
      "Oh! A new face in Ritmo\nTown. Welcome, welcome!",
      "Nothing here changes until\nthe schedule says so.",
      "Read the signs. I painted\nevery one of them!"
    ]
  },
  {
    cell: { col: 15, row: 8 },
    facing: "Right",
    character: "inspector",
    speaker: "Kit",
    pages: [
      "I inspect the world, but\nI never write to it.",
      "Read-only access. It's\nright there in my spec."
    ],
    route: [{ col: 15, row: 8 }, { col: 19, row: 8 }]
  },
  {
    cell: { col: 4, row: 14 },
    facing: "Right",
    character: "monk",
    speaker: "Sora",
    pages: [
      "I was spawned with every\ncomponent I require.",
      "Forget one, and I would\nnot even compile."
    ]
  }
] as const satisfies ReadonlyArray<VillagerSpec>

/** Something to read. */
export interface SignSpec {
  readonly cell: Cell
  readonly pages: ReadonlyArray<Page>
}

export const signs = [
  {
    // Right in front of the door.
    cell: { col: 5, row: 5 },
    pages: ["YOUR HOUSE", "The door doesn't open.\nIt's a demo after all."]
  },
  {
    cell: { col: 9, row: 8 },
    pages: ["RITMO TOWN", "Population: 4. Each one\nfully typed."]
  },
  {
    cell: { col: 21, row: 10 },
    pages: ["NO FISHING", "Same seed, same inputs,\nsame fish. Every replay."]
  }
] as const satisfies ReadonlyArray<SignSpec>
