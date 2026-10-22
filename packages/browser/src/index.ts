/** Browser host integrations kept outside the renderer-agnostic ECS core. */
export * as BrowserHostClock from "./BrowserHostClock.ts"
export * as BrowserTickSource from "./BrowserTickSource.ts"
export * as Gamepad from "./Gamepad.ts"
export * as InputCapture from "./InputCapture.ts"
export * as Keyboard from "./Keyboard.ts"
export * as Pointer from "./Pointer.ts"
export * as Touch from "./Touch.ts"

export const packageTag = "browser" as const
