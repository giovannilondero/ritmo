// The controls demo, recording: a button replays the last seconds of play
// headless in the page and shows what a debug session says about them.
import { mountControls } from "./game.ts"

export const mount = (host: HTMLElement): Promise<() => void> => mountControls(host, { replay: true })
