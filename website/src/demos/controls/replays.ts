// The replay page's part of the controls demo: the last seconds of play are
// kept as a replay, and a button opens it as a fresh headless world in the
// page, plays it, and shows what a debug session says about it. In a game,
// the same file goes to the dev server and is opened in Node instead.
import { HostClock } from "@typeonce/ritmo"
import { Replay } from "@typeonce/ritmo-devtools"

import { ControlsInput, createDebugSimulation, Dashes, Position, setupSchedule, step, updateSchedule } from "./sim.ts"
import type { DebugRuntime } from "./sim.ts"

/** Seconds of play a replay keeps. */
const KEEP = 10

/**
 * The game built for a replay: the same world, with the recorded snapshots
 * in place of the devices. A test clock keeps the text the same on every run.
 */
const makeReplay = (playback: Replay.Playback) => {
  const hostClock = HostClock.test()
  const made = createDebugSimulation(playback.source(ControlsInput), hostClock)
  if (!made.ok) throw new Error("The replay could not build the world.")
  return { runtime: made.value, schedules: { setup: setupSchedule, update: updateSchedule }, hostClock }
}

/** Opens a replay as a fresh world, plays it, and asks about the dashes and the ball. */
const explain = (file: Replay.ReplayFile, ball: number | null): string => {
  const opened = Replay.session(makeReplay, file)
  if (!opened.ok) return `The replay did not open: ${opened.error._tag}`
  const played = opened.value.play()
  const lines = [
    `# ${file.ticks.length} ticks saved, ${(JSON.stringify(file).length / 1024).toFixed(1)} KB of JSON`,
    "",
    "replay.play()",
    played.text,
    "",
    "session.whyResource(Dashes)",
    opened.value.session.whyResource(Dashes, { limit: 3 }).text
  ]
  if (ball !== null) lines.push("", "session.journal({ entity: ball, component: Position, limit: 3 })", opened.value.session.journal({ entity: ball, component: Position, limit: 3 }).text)
  return lines.join("\n")
}

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ""): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

/** Starts recording `runtime`'s updates, and adds the button that replays them. */
export const recordReplays = (runtime: DebugRuntime, host: HTMLElement, ball: () => number | null) => {
  const recorder = Replay.recorder(runtime, {
    schedule: updateSchedule,
    name: "update",
    keep: KEEP,
    step,
    sink: Replay.memorySink(),
    hostClock: HostClock.standard
  })

  const button = element("button", "panel-toggle", `Replay the last ${KEEP} s`)
  const sheet = element("div", "panel replay")
  sheet.hidden = true
  const output = element("pre", "replay-output")
  const close = element("button", "panel-reset", "Close")
  sheet.append(output, close)
  host.append(button, sheet)

  button.addEventListener("click", () => {
    const file = recorder.save(`the last ${KEEP} seconds`)
    output.textContent = explain(file, ball())
    sheet.hidden = false
  })
  close.addEventListener("click", () => {
    sheet.hidden = true
  })

  return { dispose: () => recorder.stop() }
}
