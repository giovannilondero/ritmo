// The browser host for the controls demo: every device on the page merged
// into one source, the fixed-step loop on animation frames, and a 2D canvas.
// The button prompts follow the device the player used last. With
// `settings`, a panel rebinds the keyboard and the gamepad and keeps the
// bindings in the browser. With `replay`, the last seconds of play are
// recorded, and a button replays them headless in the page and shows what a
// debug session says about them.
import * as FixedLoop from "@typeonce/ritmo/FixedLoop"
import { BrowserHostClock, BrowserTickSource, Gamepad, Keyboard, Pointer, Touch } from "@typeonce/ritmo-browser"

import { ARENA, createDebugSimulation, keyBindings, makeControls, mouseBindings, padBindings, RADIUS, ReadLab, setupSchedule, step, updateSchedule } from "./sim.ts"
import type { Lab } from "./sim.ts"

const palette = {
  background: "#0e1013",
  floor: "#16191e",
  grid: "#1f2329",
  edge: "#3a3f48",
  ink: "#f3f1ec",
  muted: "#8a8f98",
  accent: "#ff5a36"
} as const

// ── Button names for prompts ────────────────────────────────────────────

/** A key as printed on the keycap. */
const keyLabel = (key: Keyboard.KeyBinding): string => {
  if (typeof key !== "string") return key.code.replace(/^Key|^Digit/, "")
  const named: Record<string, string> = { " ": "Space", Escape: "Esc", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Enter: "Enter", Shift: "Shift", Tab: "Tab" }
  return named[key] ?? (key.length === 1 ? key.toUpperCase() : key)
}

type Maker = "xbox" | "playstation" | "nintendo"

/** The maker of a pad, from its id: the browser names it there (Sony is vendor 054c, Nintendo 057e). */
const makerOf = (id: string | null): Maker => {
  const name = (id ?? "").toLowerCase()
  if (name.includes("054c") || name.includes("playstation") || name.includes("dualsense") || name.includes("dualshock")) return "playstation"
  if (name.includes("057e") || name.includes("nintendo") || name.includes("pro controller")) return "nintendo"
  return "xbox"
}

const faceButtons: Record<Maker, Record<"south" | "east" | "west" | "north" | "start" | "select", string>> = {
  xbox: { south: "Ⓐ", east: "Ⓑ", west: "Ⓧ", north: "Ⓨ", start: "Menu", select: "View" },
  playstation: { south: "✕", east: "○", west: "□", north: "△", start: "Options", select: "Create" },
  // Bindings name the place, not the letter: the bottom button is B on a Nintendo pad.
  nintendo: { south: "Ⓑ", east: "Ⓐ", west: "Ⓨ", north: "Ⓧ", start: "+", select: "−" }
}

const otherButtons: Record<string, string> = {
  leftBumper: "LB", rightBumper: "RB", leftTrigger: "LT", rightTrigger: "RT", leftStick: "L3", rightStick: "R3",
  dpadUp: "D-pad ↑", dpadDown: "D-pad ↓", dpadLeft: "D-pad ←", dpadRight: "D-pad →", home: "Home"
}

/** A pad button as printed on the player's pad. */
const buttonLabel = (button: Gamepad.Button, maker: Maker): string => {
  const face: Record<string, string> = faceButtons[maker]
  return face[button] ?? otherButtons[button] ?? button
}

// ── Bindings, as the settings panel edits them ──────────────────────────

type KeyRebinding = Keyboard.Rebinding<typeof keyBindings>
type PadRebinding = Gamepad.Rebinding<typeof padBindings>
/** The actions the panel rebinds; movement stays on the arrows, WASD, and the stick. */
const rebindable = ["dash", "pause"] as const
type Rebindable = (typeof rebindable)[number]

const STORAGE_KEY = "ritmo.demo.controls.bindings"

/** Bindings saved by an earlier visit, each checked against the bindings the demo has; anything invalid is dropped. */
const loadSaved = (): { readonly keyboard?: KeyRebinding; readonly gamepad?: PadRebinding } => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const data: unknown = JSON.parse(raw)
    if (typeof data !== "object" || data === null) return {}
    const saved = data as { readonly keyboard?: unknown; readonly gamepad?: unknown }
    const keyboard = Keyboard.parseRebinding(keyBindings, saved.keyboard)
    const gamepad = Gamepad.parseRebinding(padBindings, saved.gamepad)
    return { ...(keyboard.ok ? { keyboard: keyboard.value } : {}), ...(gamepad.ok ? { gamepad: gamepad.value } : {}) }
  } catch {
    return {}
  }
}

const save = (bindings: { readonly keyboard: KeyRebinding; readonly gamepad: PadRebinding }): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
  } catch {
    // Storage can be off (a private window): the bindings last until the page closes.
  }
}

const clearSaved = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing was saved.
  }
}

// ── Drawing ─────────────────────────────────────────────────────────────

const touchLayout = ({ width, height }: Touch.Size): Touch.Layout<"dash", "move"> => ({
  sticks: { move: { region: { left: 0, top: 0, width: width * 0.6, height }, radius: 56 } },
  buttons: { dash: { center: { x: width - 84, y: height - 84 }, radius: 42 } }
})

const drawTouch = (context: CanvasRenderingContext2D, view: Touch.View<"dash", "move">) => {
  const stick = view.sticks.move
  if (stick !== null) {
    context.beginPath()
    context.arc(stick.origin.x, stick.origin.y, view.layout.sticks.move.radius, 0, Math.PI * 2)
    context.fillStyle = "rgba(14, 16, 19, 0.45)"
    context.fill()
    context.strokeStyle = "rgba(243, 241, 236, 0.4)"
    context.lineWidth = 2
    context.stroke()
    context.beginPath()
    context.arc(stick.knob.x, stick.knob.y, 22, 0, Math.PI * 2)
    context.fillStyle = "rgba(243, 241, 236, 0.7)"
    context.fill()
  }
  const dash = view.layout.buttons.dash
  context.beginPath()
  context.arc(dash.center.x, dash.center.y, dash.radius, 0, Math.PI * 2)
  context.fillStyle = view.buttons.dash.held ? "rgba(255, 90, 54, 0.55)" : "rgba(14, 16, 19, 0.45)"
  context.fill()
  context.strokeStyle = "rgba(243, 241, 236, 0.5)"
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = palette.ink
  context.font = "600 13px 'JetBrains Mono', monospace"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText("DASH", dash.center.x, dash.center.y)
}

/** The move vector in a ring: wherever it comes from, the dot never leaves the ring. */
const drawMeter = (context: CanvasRenderingContext2D, move: { readonly x: number; readonly y: number }, x: number, y: number) => {
  const radius = 34
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fillStyle = "rgba(14, 16, 19, 0.8)"
  context.fill()
  context.strokeStyle = palette.edge
  context.lineWidth = 1.5
  context.stroke()
  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x + move.x * radius, y + move.y * radius)
  context.strokeStyle = palette.accent
  context.lineWidth = 2
  context.stroke()
  context.beginPath()
  context.arc(x + move.x * radius, y + move.y * radius, 5, 0, Math.PI * 2)
  context.fillStyle = palette.accent
  context.fill()
  context.fillStyle = palette.muted
  context.font = "11px 'JetBrains Mono', monospace"
  context.textAlign = "left"
  context.textBaseline = "middle"
  context.fillText(`move ${Math.hypot(move.x, move.y).toFixed(2)}`, x + radius + 10, y)
}

// ── The page ────────────────────────────────────────────────────────────

export interface Options {
  /** Shows the controls panel, which rebinds the keyboard and the gamepad. */
  readonly settings?: boolean
  /** Records the last seconds of play, and replays them on a button. */
  readonly replay?: boolean
}

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ""): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

/**
 * Starts the demo in `host` and returns the function that stops it. The
 * arena is scaled to fit the host, whatever its size.
 */
export const mountControls = async (host: HTMLElement, options: Options = {}): Promise<() => void> => {
  const canvas = document.createElement("canvas")
  canvas.style.display = "block"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  host.append(canvas)
  const context = canvas.getContext("2d")
  if (context === null) throw new Error("No 2D canvas here.")

  const hud = element("div", "hud")
  const device = element("span", "")
  const prompt = element("span", "accent")
  hud.append(device, prompt)
  host.append(hud)

  const keyboard = Keyboard.actions(window, keyBindings)
  const mouse = Pointer.actions(canvas, window, mouseBindings)
  const gamepad = Gamepad.actions(window, padBindings)
  const touch = Touch.actions(canvas, window, touchLayout)
  const coarse = window.matchMedia("(pointer: coarse)").matches

  const controls = makeControls({ keyboard, mouse, gamepad, touch })
  // The debug handle is on so the replay page can record through it. A
  // shipped game turns it on in development builds only.
  const made = createDebugSimulation(controls, BrowserHostClock.make(window))
  if (!made.ok) {
    controls.dispose()
    throw new Error("The controls demo could not start.")
  }
  const runtime = made.value
  const setup = runtime.tick(setupSchedule)
  if (!setup.ok) console.error(setup.error)
  // Loaded only for the replay page, so the other pages do not ship the devtools.
  const replays = options.replay === true ? (await import("./replays.ts")).recordReplays(runtime, host, () => lab.ball) : undefined

  // The bindings the player has now, starting from any saved ones.
  const saved = options.settings === true ? loadSaved() : {}
  let keys: KeyRebinding = saved.keyboard ?? keyBindings
  let pad: PadRebinding = saved.gamepad ?? padBindings
  if (saved.keyboard !== undefined) controls.rebind.keyboard(saved.keyboard)
  if (saved.gamepad !== undefined) controls.rebind.gamepad(saved.gamepad)

  let lab: Lab = runtime.inspect(ReadLab)
  const panel = options.settings === true ? makePanel() : undefined

  function makePanel() {
    const toggle = element("button", "panel-toggle", "Controls")
    const sheet = element("div", "panel")
    sheet.hidden = true
    const title = element("p", "panel-title", "Controls")
    const table = element("div", "panel-grid")
    const note = element("p", "panel-note", "Click a binding, then press the key or the pad button. Saved in this browser.")
    const reset = element("button", "panel-reset", "Reset to defaults")
    sheet.append(title, table, note, reset)
    host.append(toggle, sheet)

    const presses = Keyboard.presses(window)
    type Waiting = { readonly device: "keyboard"; readonly action: Rebindable } | { readonly device: "gamepad"; readonly action: Rebindable; readonly held: ReadonlySet<Gamepad.Button> }
    let waiting: Waiting | null = null

    const cells = new Map<string, HTMLButtonElement>()
    table.append(element("span", "panel-head", ""), element("span", "panel-head", "Keyboard"), element("span", "panel-head", "Gamepad"))
    for (const action of rebindable) {
      table.append(element("span", "panel-action", action === "dash" ? "Dash" : "Pause"))
      for (const device of ["keyboard", "gamepad"] as const) {
        const cell = element("button", "panel-cell")
        cell.addEventListener("click", () => {
          presses.snapshot()
          waiting = device === "keyboard"
            ? { device, action }
            : { device, action, held: new Set(Gamepad.buttonNames.filter((name) => lab.input.devices.gamepad.buttons[name].held)) }
          refresh()
        })
        cells.set(`${device}.${action}`, cell)
        table.append(cell)
      }
    }

    const refresh = () => {
      const maker = makerOf(lab.input.devices.gamepad.id)
      for (const action of rebindable) {
        const keyCell = cells.get(`keyboard.${action}`)!
        const padCell = cells.get(`gamepad.${action}`)!
        keyCell.textContent = waiting?.device === "keyboard" && waiting.action === action ? "Press a key…" : keys[action].map(keyLabel).join(" / ")
        padCell.textContent = waiting?.device === "gamepad" && waiting.action === action ? "Press a button…" : pad[action].map((button) => buttonLabel(button, maker)).join(" / ")
        keyCell.classList.toggle("waiting", waiting?.device === "keyboard" && waiting.action === action)
        padCell.classList.toggle("waiting", waiting?.device === "gamepad" && waiting.action === action)
      }
    }

    // The new binding replaces the action's own; an action that had it gets the old one, so no action is left without a binding.
    const bindKey = (action: Rebindable, key: Keyboard.KeyBinding) => {
      const other = rebindable.find((name) => name !== action && keys[name].some((bound) => keyLabel(bound) === keyLabel(key)))
      keys = { ...keys, [action]: [key], ...(other === undefined ? {} : { [other]: keys[action] }) }
      controls.rebind.keyboard(keys)
    }
    const bindButton = (action: Rebindable, button: Gamepad.Button) => {
      const other = rebindable.find((name) => name !== action && pad[name].includes(button))
      pad = { ...pad, [action]: [button], ...(other === undefined ? {} : { [other]: pad[action] }) }
      controls.rebind.gamepad(pad)
    }

    toggle.addEventListener("click", () => {
      sheet.hidden = !sheet.hidden
      waiting = null
      refresh()
    })
    reset.addEventListener("click", () => {
      keys = keyBindings
      pad = padBindings
      controls.rebind.keyboard(keys)
      controls.rebind.gamepad(pad)
      clearSaved()
      waiting = null
      refresh()
    })
    refresh()

    return {
      /** Called after each frame: binds the key or button the panel waits for, once it comes. */
      frame: () => {
        if (waiting === null) {
          presses.snapshot()
          return
        }
        const current = waiting
        if (current.device === "keyboard") {
          const press = presses.snapshot()[0]
          if (press === undefined) return
          bindKey(current.action, press.code === null || press.key.length === 1 || press.key === " " ? press.key : Keyboard.code(press.code))
        } else {
          const buttons = lab.input.devices.gamepad.buttons
          const button = Gamepad.buttonNames.find((name) => buttons[name].held && !current.held.has(name))
          if (button === undefined) return
          bindButton(current.action, button)
        }
        waiting = null
        save({ keyboard: keys, gamepad: pad })
        refresh()
      },
      refresh,
      dispose: () => presses.dispose()
    }
  }

  // Sized to the host in device pixels; the arena is fitted inside with a margin.
  let view = { width: 0, height: 0, scale: 1, x: 0, y: 0 }
  const fit = () => {
    const ratio = window.devicePixelRatio
    const width = host.clientWidth
    const height = host.clientHeight
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const margin = 24
    const scale = Math.min((width - margin * 2) / ARENA.width, (height - margin * 2 - 36) / ARENA.height)
    view = { width, height, scale, x: (width - ARENA.width * scale) / 2, y: (height - ARENA.height * scale) / 2 + 14 }
  }
  fit()
  const observer = new ResizeObserver(fit)
  observer.observe(host)

  // The trail is the page's own: the last positions, for drawing only.
  const trail: Array<{ x: number; y: number }> = []
  let lastMaker: Maker = "xbox"

  const describeDevice = (state: Lab): { readonly using: string; readonly hint: string } => {
    const input = state.input
    const used = input.lastUsed ?? (coarse ? "touch" : "desktop")
    const pause = input.available.pause
    if (used === "gamepad") {
      const maker = makerOf(input.devices.gamepad.id)
      const name = { xbox: "Gamepad", playstation: "PlayStation pad", nintendo: "Nintendo pad" }[maker]
      return {
        using: `Playing on: ${name}`,
        hint: `${pad.dash.map((button) => buttonLabel(button, maker)).join("/")} dash · ${pad.pause.map((button) => buttonLabel(button, maker)).join("/")} pause`
      }
    }
    if (used === "touch") return { using: "Playing on: Touch", hint: pause ? "" : "Tap DASH to dash · no pause on touch" }
    return { using: "Playing on: Keyboard & mouse", hint: `${keys.dash.map(keyLabel).join("/")} or click: dash · ${keys.pause.map(keyLabel).join("/")}: pause` }
  }

  const draw = () => {
    const ratio = window.devicePixelRatio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.fillStyle = palette.background
    context.fillRect(0, 0, view.width, view.height)

    context.save()
    context.translate(view.x, view.y)
    context.scale(view.scale, view.scale)
    context.fillStyle = palette.floor
    context.fillRect(0, 0, ARENA.width, ARENA.height)
    context.strokeStyle = palette.grid
    context.lineWidth = 2
    context.beginPath()
    for (let x = 60; x < ARENA.width; x += 60) {
      context.moveTo(x, 0)
      context.lineTo(x, ARENA.height)
    }
    for (let y = 60; y < ARENA.height; y += 60) {
      context.moveTo(0, y)
      context.lineTo(ARENA.width, y)
    }
    context.stroke()
    context.strokeStyle = palette.edge
    context.strokeRect(0, 0, ARENA.width, ARENA.height)

    trail.forEach((point, index) => {
      context.beginPath()
      context.arc(point.x, point.y, RADIUS * (0.25 + (index / trail.length) * 0.5), 0, Math.PI * 2)
      context.fillStyle = `rgba(255, 90, 54, ${(index / trail.length) * 0.25})`
      context.fill()
    })

    const { x, y } = lab.position
    context.beginPath()
    context.arc(x, y, RADIUS, 0, Math.PI * 2)
    context.fillStyle = palette.accent
    context.fill()
    if (lab.ready) {
      context.beginPath()
      context.arc(x, y, RADIUS + 6, 0, Math.PI * 2)
      context.strokeStyle = "rgba(243, 241, 236, 0.35)"
      context.lineWidth = 2
      context.stroke()
    }
    context.beginPath()
    context.moveTo(x + Math.cos(lab.heading) * (RADIUS + 12), y + Math.sin(lab.heading) * (RADIUS + 12))
    context.lineTo(x + Math.cos(lab.heading + 2.5) * (RADIUS - 6), y + Math.sin(lab.heading + 2.5) * (RADIUS - 6))
    context.lineTo(x + Math.cos(lab.heading - 2.5) * (RADIUS - 6), y + Math.sin(lab.heading - 2.5) * (RADIUS - 6))
    context.closePath()
    context.fillStyle = palette.ink
    context.fill()
    context.restore()

    const usingTouch = lab.input.lastUsed === "touch" || (lab.input.lastUsed === null && coarse)
    if (usingTouch) drawTouch(context, touch.view())
    else drawMeter(context, lab.input.vectors.move, view.x + 50, view.y + ARENA.height * view.scale - 50)

    if (lab.paused) {
      context.fillStyle = "rgba(14, 16, 19, 0.6)"
      context.fillRect(0, 0, view.width, view.height)
      context.fillStyle = palette.ink
      context.font = "600 18px 'JetBrains Mono', monospace"
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText("Paused", view.width / 2, view.height / 2)
    }
  }

  const loop = FixedLoop.start({
    source: BrowserTickSource.make(window),
    step,
    maxFrameSeconds: 0.25,
    maxStepsPerFrame: 5,
    update: () => runtime.tick(updateSchedule),
    render: () => {
      const previous = lab
      lab = runtime.inspect(ReadLab)
      if (!lab.paused && (previous.position.x !== lab.position.x || previous.position.y !== lab.position.y)) {
        trail.push(lab.position)
        if (trail.length > 24) trail.shift()
      }
      const shown = describeDevice(lab)
      device.textContent = `${shown.using} · ${lab.dashes} ${lab.dashes === 1 ? "dash" : "dashes"}`
      prompt.textContent = shown.hint
      panel?.frame()
      // A pad of another maker: the panel names its buttons as printed on it.
      const maker = makerOf(lab.input.devices.gamepad.id)
      if (maker !== lastMaker) {
        lastMaker = maker
        panel?.refresh()
      }
      draw()
    },
    onFailure: (failure) => console.error(failure)
  })

  return () => {
    if (loop.ok) loop.value.stop()
    observer.disconnect()
    panel?.dispose()
    replays?.dispose()
    controls.dispose()
  }
}

export const mount = (host: HTMLElement): Promise<() => void> => mountControls(host)
