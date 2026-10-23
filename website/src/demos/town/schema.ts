// What the town's world holds: the components, resources, the input
// service, and the one game-wide mode. Headless: no page or renderer here.
import { Clock, Descriptor, Schema } from "@typeonce/ritmo"
import type { Gamepad, InputCapture, Keyboard, Touch } from "@typeonce/ritmo-browser"
import { Controls } from "@typeonce/ritmo-browser"
import * as Random from "@typeonce/ritmo-math/Random"

import { directions } from "./map.ts"
import type { Cell, Character, Page } from "./map.ts"

/** One fixed update: 60 per second, shared by the clock and the host loop. */
export const step = Clock.hz(60)

/** A tile per 16 steps: one pixel per step, as on the handhelds. */
export const WALK = Clock.durationOfSteps(step, 16)
/** Turning to a new direction from rest waits this long before walking, so a tap only turns. */
export const TURN = Clock.durationOfSteps(step, 6)
/** Walking into something plays the step in place this long. */
export const BUMP = Clock.durationOfSteps(step, 20)
/** One more letter of dialogue every 2 steps. */
export const TYPE = Clock.durationOfSteps(step, 2)
/** How often a villager standing still may look somewhere else. */
export const LOOK_AROUND = Clock.duration(step, 1.5)
/** A pacing villager waits between this many steps and twice as many at each end of the route, drawn from `Rng`. */
export const PACE_REST = Clock.duration(step, 1)

// ── Input ───────────────────────────────────────────────────────────────

/** The town's actions, bound on every device below. */
export const Actions = Controls.actions(["up", "down", "left", "right", "action"])

export const keyBindings = {
  up: ["ArrowUp", "w"],
  down: ["ArrowDown", "s"],
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
  action: [" ", "Enter", "z"]
} as const

/** The d-pad walks, south (A on Xbox) talks. */
export const padBindings = {
  up: ["dpadUp"],
  down: ["dpadDown"],
  left: ["dpadLeft"],
  right: ["dpadRight"],
  action: ["south"]
} as const

/** On a touch screen: an on-screen d-pad of four buttons and an A button. */
export const touchButtons = ["up", "down", "left", "right", "action"] as const

/** The one input source: every device merged, built the same way in the browser and in the check. */
export const makeControls = (devices: {
  readonly keyboard: Keyboard.Actions<typeof keyBindings>
  readonly gamepad: Gamepad.Actions<typeof padBindings>
  readonly touch: Touch.Touch<(typeof touchButtons)[number]>
}) => Actions.merge(devices)

export const ControlsInput = Descriptor.Service<ReturnType<typeof makeControls>>()("Town/Controls")

// ── Components ──────────────────────────────────────────────────────────

/** The tile an actor stands on. A walking actor already holds the tile it walks to. */
export const Tile = Descriptor.Component<Cell>()("Town/Tile")
/** Where an actor is drawn: the top-left pixel, between tiles while walking. */
export const Position = Descriptor.Component<{ x: number; y: number }>()("Town/Position")
export const Facing = Descriptor.EntityState("Town/Facing", directions)
/** The character sheet an actor is drawn with. */
export const Look = Descriptor.Component<{ character: Character }>()("Town/Look")
/** Facing it and pressing the action button opens these pages. */
export const Talkable = Descriptor.Component<{ speaker: string; pages: ReadonlyArray<Page> }>()("Town/Talkable")
/** Nobody can step onto its tile. */
export const Solid = Descriptor.Tag("Town/Solid")
export const Player = Descriptor.Tag("Town/Player")
export const Villager = Descriptor.Tag("Town/Villager")
export const Signpost = Descriptor.Tag("Town/Signpost")

/**
 * A villager who paces between two tiles of one row or column: `heading`
 * is the end walked to, and `rest` the steps left to wait before moving on.
 */
export const Patrol = Descriptor.Component<{ ends: readonly [Cell, Cell]; heading: 0 | 1; rest: number }>()("Town/Patrol")

/** Which foot the next step lands on, for the walk animation. */
export type Foot = "left" | "right"

/**
 * What an actor's legs are doing. Every phase counts its own steps of the
 * clock (`elapsed`, from 1) up to its duration.
 *
 * - `still`: standing on `Tile`. `rested` is false right after a step, so a
 *   new direction turns and walks without the turning pause.
 * - `turn`: turned from rest; walks after `TURN` if the direction is held.
 * - `walk`: moving from `from` to `Tile`.
 * - `bump`: stepping in place against something solid.
 */
export type StrideValue =
  | { readonly kind: "still"; readonly foot: Foot; readonly rested: boolean }
  | { readonly kind: "turn"; readonly foot: Foot; readonly elapsed: number }
  | { readonly kind: "walk"; readonly foot: Foot; readonly elapsed: number; readonly from: Cell }
  | { readonly kind: "bump"; readonly foot: Foot; readonly elapsed: number }

export const Stride = Descriptor.Component<StrideValue>()("Town/Stride")

// ── Resources ───────────────────────────────────────────────────────────

export const Time = Clock.resource("Town/Time", step)
/** The villagers' look-around and pacing draws come from here, so a run replays exactly. */
export const Rng = Descriptor.ConstructedResource(Random)("Town/Rng")
/** Captured from the controls at the start of each update; never saved. */
export const Input = Descriptor.TransientResource<InputCapture.SnapshotOf<typeof ControlsInput>>()("Town/Input")

/**
 * The conversation on screen: who speaks, their pages, the page shown, and
 * how many of its letters have typed out. `null` while nobody talks.
 */
export type DialogueValue = {
  readonly speaker: string
  readonly pages: ReadonlyArray<Page>
  readonly page: number
  readonly typed: number
} | null

export const Dialogue = Descriptor.Resource<DialogueValue>()("Town/Dialogue")

export const Game = Schema.bind(
  Schema.fragment({
    components: { Tile, Position, Facing, Look, Talkable, Solid, Player, Villager, Signpost, Stride, Patrol },
    // What each kind of entity always has: spawning a villager without
    // pages to say does not compile.
    requires: [
      Schema.requires(Player, Tile, Position, Facing, Look, Stride, Solid),
      Schema.requires(Villager, Tile, Position, Facing, Look, Talkable, Solid),
      Schema.requires(Patrol, Villager, Stride),
      Schema.requires(Signpost, Tile, Position, Talkable, Solid)
    ],
    resources: { Time, Rng, Input, Dialogue }
  }),
  Schema.defineRoot("Town")
)

/**
 * The game-wide mode. Walking, looking around, and starting a talk run only
 * while `Exploring`; while `Talking`, only the dialogue box listens, so the
 * world holds still.
 */
export const Mode = Game.StateMachine("Town/Mode", ["Exploring", "Talking"])
