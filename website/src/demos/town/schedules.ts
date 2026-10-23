// When each rule runs. One `update` is one fixed step of the clock.
import { Clock } from "@typeonce/ritmo"
import { InputCapture } from "@typeonce/ritmo-browser"

import { Game, Input, Mode, PlayersInput, Time } from "./schema.ts"
import { AdvanceDialogue, JoinPlayers, LookAround, OpenJoining, PaceVillagers, SpawnTown, StartTalk, TypeDialogue, WalkPlayer } from "./systems.ts"

const AdvanceTime = Clock.system(Game, { name: "Town/AdvanceTime", resource: Time })

const CaptureInput = InputCapture.system(Game, { name: "Town/CaptureInput", source: PlayersInput, resource: Input })

/** Puts the villagers on the map and opens joining; ticked once before the first update. */
export const setupSchedule = Game.Schedule(SpawnTown, OpenJoining, Game.Schedule.applyDeferred())

/**
 * One fixed update. The mode chosen this step takes effect at the closing
 * `applyStateTransitions()`, so the press that opens a dialogue is not also
 * read as the press that advances it.
 */
export const updateSchedule = Game.Schedule(
  AdvanceTime,
  CaptureInput,
  // A player who joins this update stands on the map before anyone walks.
  JoinPlayers,
  Game.Schedule.applyDeferred(),
  Game.Schedule.when(
    [Game.Condition.inState(Mode, "Exploring")],
    WalkPlayer,
    PaceVillagers,
    StartTalk,
    LookAround
  ),
  Game.Schedule.when(
    [Game.Condition.inState(Mode, "Talking")],
    AdvanceDialogue,
    TypeDialogue
  ),
  Game.Schedule.applyStateTransitions()
)
