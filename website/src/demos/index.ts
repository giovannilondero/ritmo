/**
 * The games embedded in the guide. Each one is served alone at
 * `/play/<id>/` and embedded with `<Game id="..." />`.
 */
export const demos = {
  town: {
    title: "Town",
    description: "Walk a tiny town tile by tile, read the signs, and talk to the villagers, alone or with a friend.",
    controls: "Arrows to walk, Enter to talk. A second player joins on WASD (Space talks, Q leaves) or a gamepad (Ⓐ talks, Ⓑ leaves); face each other and talk.",
    source: "https://github.com/typeonce-dev/ritmo/tree/main/website/src/demos/town",
    load: () => import("./town/game.ts")
  },
  "top-down": {
    title: "Top-down",
    description: "Walk the rooms and pick up the five parts.",
    controls: "WASD or arrows to walk, E, Space, or a click to pick up. A gamepad works too.",
    source: "https://github.com/typeonce-dev/ritmo/tree/main/integration/top-down",
    load: () => import("./top-down/game.ts")
  },
  controls: {
    title: "Controls",
    description: "One ball, moved and dashed with whatever you pick up: keyboard, mouse, gamepad, or touch.",
    controls: "WASD or arrows to move, Space or a click to dash, Esc to pause. Pick up a gamepad, or touch the screen, at any time.",
    source: "https://github.com/typeonce-dev/ritmo/tree/main/website/src/demos/controls",
    load: () => import("./controls/game.ts")
  },
  rebind: {
    title: "Controls, rebindable",
    description: "The same ball, with a controls panel that rebinds the keyboard and the gamepad.",
    controls: "Open Controls in the corner, click a binding, then press the new key or pad button.",
    source: "https://github.com/typeonce-dev/ritmo/tree/main/website/src/demos/controls",
    load: () => import("./controls/rebind.ts")
  },
  rollback: {
    title: "Rollback",
    description: "Two peers of one match in one page, joined by a fake network: watch them roll back and agree.",
    controls: "WASD or arrows to move, Space to fire. A bot plays the other seat; pick the latency in the corner.",
    source: "https://github.com/typeonce-dev/ritmo/tree/main/website/src/demos/rollback",
    load: () => import("./rollback/game.ts")
  },
  replay: {
    title: "Controls, recorded",
    description: "The same ball, recording the last ten seconds as a replay you can open on the spot.",
    controls: "Move and dash for a while, then press Replay in the corner.",
    source: "https://github.com/typeonce-dev/ritmo/tree/main/website/src/demos/controls",
    load: () => import("./controls/replay.ts")
  }
} as const

export type DemoId = keyof typeof demos

/** What every demo module exports: start in a host element, get back the stop. */
export interface Demo {
  readonly mount: (host: HTMLElement) => Promise<() => void>
}
