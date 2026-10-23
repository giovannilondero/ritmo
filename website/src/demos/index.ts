/**
 * The games embedded in the guide. Each one is served alone at
 * `/play/<id>/` and embedded with `<Game id="..." />`.
 */
export const demos = {
  "top-down": {
    title: "Top-down",
    description: "Walk the rooms and pick up the five parts.",
    controls: "WASD or arrows to walk, E or Space to pick up. A gamepad works too.",
    source: "https://github.com/typeonce-dev/ritmo/tree/main/integration/top-down",
    load: () => import("./top-down/game.ts")
  }
} as const

export type DemoId = keyof typeof demos

/** What every demo module exports: start in a host element, get back the stop. */
export interface Demo {
  readonly mount: (host: HTMLElement) => Promise<() => void>
}
