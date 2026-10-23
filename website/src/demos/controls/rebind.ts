// The controls demo with its controls panel open to players: rebind the
// keyboard and the gamepad, and the bindings are kept in the browser.
import { mountControls } from "./game.ts"

export const mount = (host: HTMLElement): Promise<() => void> => mountControls(host, { settings: true })
