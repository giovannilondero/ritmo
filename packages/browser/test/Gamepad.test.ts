import { describe, expect, it } from "vitest"

import { Gamepad } from "@typeonce/ritmo-browser"

const released = { held: false, pressed: false, released: true }
const idle = { held: false, pressed: false, released: false }

/** A pad whose buttons and axes the test sets, read by index as the standard mapping. */
const makePad = (index = 0, id = `pad ${index}`) => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))
  const axes = [0, 0, 0, 0]
  const pad = { id, index, connected: true, mapping: "standard", buttons, axes }
  const at = (name: Gamepad.Button) => Gamepad.buttonNames.indexOf(name)
  return {
    pad,
    down: (name: Gamepad.Button) => (buttons[at(name)] = { pressed: true, value: 1 }),
    up: (name: Gamepad.Button) => (buttons[at(name)] = { pressed: false, value: 0 }),
    pull: (name: "leftTrigger" | "rightTrigger", value: number) => (buttons[at(name)] = { pressed: value > 0.1, value }),
    tilt: (stick: "left" | "right", x: number, y: number) => {
      const first = stick === "left" ? 0 : 2
      axes[first] = x
      axes[first + 1] = y
    }
  }
}

/** A window whose pads the test sets and whose animation frames the test runs with `frame()`. */
const makeHost = (...pads: Array<ReturnType<typeof makePad>>) => {
  const connected: Array<Gamepad.PadReading | null> = pads.map(({ pad }) => pad)
  const frames = new Map<number, (timestamp: number) => void>()
  let next = 0
  const host: Gamepad.GamepadHost = {
    navigator: { getGamepads: () => connected },
    requestAnimationFrame: (callback) => {
      next += 1
      frames.set(next, callback)
      return next
    },
    cancelAnimationFrame: (handle) => {
      frames.delete(handle)
    }
  }
  const frame = () => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(0)
  }
  return { host, connected, frame, scheduled: () => frames.size }
}

const bindings = { attack: ["west"], dash: ["south", "rightBumper"], ultimate: ["rightTrigger"] } as const

describe("Gamepad.actions", () => {
  it("reports held state and press edges per snapshot", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings)

    pad.down("west")
    expect(input.snapshot().actions.attack).toEqual({ held: true, pressed: true, released: false })
    expect(input.snapshot().actions.attack).toEqual({ held: true, pressed: false, released: false })
    pad.up("west")
    expect(input.snapshot().actions.attack).toEqual(released)
    expect(input.snapshot().actions.dash).toEqual(idle)
  })

  it("holds an action while any of its buttons is down", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings)

    pad.down("south")
    pad.down("rightBumper")
    input.snapshot()
    pad.up("south")
    expect(input.snapshot().actions.dash).toEqual({ held: true, pressed: false, released: false })
    pad.up("rightBumper")
    expect(input.snapshot().actions.dash).toEqual(released)
  })

  it("keeps a tap that starts and ends between two snapshots, read on an animation frame", () => {
    const pad = makePad()
    const host = makeHost(pad)
    const input = Gamepad.actions(host.host, bindings)

    pad.down("west")
    host.frame()
    pad.up("west")

    expect(input.snapshot().actions.attack).toEqual({ held: false, pressed: true, released: true })
  })

  it("reports every button by name, whatever the bindings", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings)

    pad.down("dpadDown")
    const snapshot = input.snapshot()
    expect(snapshot.buttons.dpadDown).toEqual({ held: true, pressed: true, released: false })
    expect(snapshot.buttons.start).toEqual(idle)
  })

  it("removes the stick dead zone and rescales the rest", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings, { deadZone: 0.2 })

    pad.tilt("left", 0.1, -0.1)
    expect(input.snapshot().left).toEqual({ x: 0, y: 0 })
    pad.tilt("left", 0, 0.6)
    expect(input.snapshot().left.y).toBeCloseTo(0.5)
    pad.tilt("right", 1, 1)
    const right = input.snapshot().right
    expect(Math.hypot(right.x, right.y)).toBeCloseTo(1)
  })

  it("holds a trigger past the threshold and reports how far it is pulled", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings, { triggerThreshold: 0.6 })

    pad.pull("rightTrigger", 0.4)
    let snapshot = input.snapshot()
    expect(snapshot.actions.ultimate.held).toBe(false)
    expect(snapshot.rightTrigger).toBeCloseTo(0.4)
    pad.pull("rightTrigger", 0.8)
    snapshot = input.snapshot()
    expect(snapshot.actions.ultimate).toEqual({ held: true, pressed: true, released: false })
  })

  it("reports no pad until one connects, and releases everything when it disconnects", () => {
    const pad = makePad()
    const { host, connected } = makeHost()
    const input = Gamepad.actions(host, bindings)

    expect(input.snapshot()).toEqual(Gamepad.idle(bindings))
    connected.push(pad.pad)
    pad.down("west")
    expect(input.snapshot()).toMatchObject({ connected: true, id: "pad 0", actions: { attack: { held: true, pressed: true } } })
    connected.length = 0
    expect(input.snapshot()).toMatchObject({ connected: false, id: null, actions: { attack: released } })
  })

  it("follows the pad used last", () => {
    const first = makePad(0)
    const second = makePad(1)
    const input = Gamepad.actions(makeHost(first, second).host, bindings)

    first.down("west")
    expect(input.snapshot().id).toBe("pad 0")
    first.up("west")
    second.tilt("left", 1, 0)
    const snapshot = input.snapshot()
    expect(snapshot.id).toBe("pad 1")
    expect(snapshot.left.x).toBeCloseTo(1)
    // While the followed pad is in use, another one does not take over.
    first.down("south")
    expect(input.snapshot().id).toBe("pad 1")
  })

  it("does not take resting trigger axes for use", () => {
    const first = makePad(0)
    const second = makePad(1)
    second.pad.axes.push(-1, -1)
    const input = Gamepad.actions(makeHost(first, second).host, bindings)

    first.down("west")
    input.snapshot()
    first.up("west")
    expect(input.snapshot().id).toBe("pad 0")
  })

  it("treats a host that throws as having no pads", () => {
    const { host } = makeHost()
    const input = Gamepad.actions({ ...host, navigator: { getGamepads: () => { throw new Error("blocked") } } }, bindings)
    expect(input.snapshot().connected).toBe(false)
  })

  it("rebinds actions, releasing one held only through buttons it lost", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings)

    pad.down("west")
    input.snapshot()
    input.rebind({ attack: ["north"], dash: ["west"], ultimate: ["rightTrigger"] })
    const snapshot = input.snapshot()
    expect(snapshot.actions.attack).toEqual(released)
    // West is still down, but dash waits for a fresh press of it.
    expect(snapshot.actions.dash).toEqual(idle)
    pad.down("north")
    expect(input.snapshot().actions.attack).toEqual({ held: true, pressed: true, released: false })
    pad.up("west")
    expect(input.snapshot().actions.dash).toEqual(idle)
    pad.down("west")
    expect(input.snapshot().actions.dash).toEqual({ held: true, pressed: true, released: false })
  })

  it("does not hold a newly bound action through the button that was pressed to bind it", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings)

    pad.down("north")
    const waiting = input.snapshot()
    expect(waiting.buttons.north.pressed).toBe(true)
    input.rebind({ attack: ["north"], dash: ["south"], ultimate: ["rightTrigger"] })
    expect(input.snapshot().actions.attack).toEqual(idle)
    pad.up("north")
    expect(input.snapshot().actions.attack).toEqual(idle)
  })

  it("keeps an action held through a button it kept", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings)

    pad.down("south")
    input.snapshot()
    input.rebind({ attack: ["west"], dash: ["south"], ultimate: ["north"] })
    expect(input.snapshot().actions.dash).toEqual({ held: true, pressed: false, released: false })
    pad.up("south")
    expect(input.snapshot().actions.dash).toEqual(released)
  })

  it("ignores actions a rebinding adds at runtime", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings)
    const next = { attack: ["west"], dash: ["south"], ultimate: ["rightTrigger"], extra: ["north"] } as const

    // The types reject it; the runtime ignores it too, for untyped callers.
    // @ts-expect-error is not an action of these bindings
    input.rebind(next)
    expect(Object.keys(input.snapshot().actions)).toEqual(["attack", "dash", "ultimate"])
  })

  it("reads on every animation frame until dispose, which cancels the frame", () => {
    const pad = makePad()
    const host = makeHost(pad)
    const input = Gamepad.actions(host.host, bindings)

    expect(host.scheduled()).toBe(1)
    host.frame()
    host.frame()
    expect(host.scheduled()).toBe(1)
    input.dispose()
    expect(host.scheduled()).toBe(0)
  })

  it("stops reading after dispose", () => {
    const pad = makePad()
    const input = Gamepad.actions(makeHost(pad).host, bindings)

    pad.down("west")
    input.snapshot()
    input.dispose()
    expect(input.snapshot().actions.attack).toEqual(released)
    expect(input.snapshot().connected).toBe(false)
  })
})

describe("Gamepad.scripted", () => {
  it("plays presses, releases, and sticks by frame", () => {
    const input = Gamepad.scripted(bindings, [
      { frame: 1, press: ["west"], left: { x: 1, y: 0 } },
      { frame: 2, release: ["west"] },
      { frame: 3, press: ["south"], release: ["south"] }
    ])

    expect(input.snapshot().connected).toBe(false)
    let snapshot = input.snapshot()
    expect(snapshot).toMatchObject({ connected: true, left: { x: 1, y: 0 }, actions: { attack: { held: true, pressed: true } } })
    snapshot = input.snapshot()
    expect(snapshot.actions.attack).toEqual(released)
    expect(snapshot.left).toEqual({ x: 1, y: 0 })
    expect(input.snapshot().actions.dash).toEqual({ held: false, pressed: true, released: true })
    expect(input.frames()).toBe(4)
  })

  it("follows the bindings, so a rebind changes what a replay does", () => {
    const input = Gamepad.scripted(bindings, [{ frame: 0, press: ["north"] }])
    input.rebind({ attack: ["north"], dash: ["south"], ultimate: ["rightTrigger"] })
    expect(input.snapshot().actions.attack.pressed).toBe(true)
  })
})

describe("Gamepad.recording", () => {
  it("records a timeline that replays the same snapshots", () => {
    const pad = makePad()
    const live = Gamepad.recording(Gamepad.actions(makeHost(pad).host, bindings))
    const seen: Array<Gamepad.Snapshot<typeof bindings>> = []

    seen.push(live.snapshot())
    pad.down("west")
    pad.tilt("left", 0, 1)
    seen.push(live.snapshot())
    pad.up("west")
    pad.pull("rightTrigger", 1)
    seen.push(live.snapshot())

    const parsed = Gamepad.parseTimeline(JSON.parse(JSON.stringify(live.timeline())))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const replay = Gamepad.scripted(bindings, parsed.value)
    for (const snapshot of seen) {
      const { id: _, ...rest } = replay.snapshot()
      const { id: __, ...expected } = snapshot
      expect(rest).toEqual(expected)
    }
  })
})

describe("Gamepad.recording release and press within one update", () => {
  it("replays a button released and pressed again between two snapshots", () => {
    const pad = makePad()
    const host = makeHost(pad)
    const live = Gamepad.recording(Gamepad.actions(host.host, bindings))
    const seen: Array<Gamepad.Snapshot<typeof bindings>> = []

    pad.down("west")
    seen.push(live.snapshot())
    pad.up("west")
    host.frame()
    pad.down("west")
    host.frame()
    seen.push(live.snapshot())
    expect(seen[1]!.actions.attack).toEqual({ held: true, pressed: true, released: false })
    expect(live.timeline()).toEqual([{ frame: 0, press: ["west"] }, { frame: 1, press: ["west"], release: ["west"] }])

    const replay = Gamepad.scripted(bindings, live.timeline())
    for (const snapshot of seen) expect(replay.snapshot().actions).toEqual(snapshot.actions)
  })

  it("plays a button in both lists as a tap when it was up", () => {
    const replay = Gamepad.scripted(bindings, [{ frame: 0, press: ["west"], release: ["west"] }])
    expect(replay.snapshot().actions.attack).toEqual({ held: false, pressed: true, released: true })
  })
})

describe("Gamepad timelines and disconnects", () => {
  it("records a disconnect and a reconnect, and replays them", () => {
    const pad = makePad()
    const host = makeHost(pad)
    const live = Gamepad.recording(Gamepad.actions(host.host, bindings))
    const seen: Array<Gamepad.Snapshot<typeof bindings>> = []

    pad.down("west")
    pad.tilt("left", 1, 0)
    seen.push(live.snapshot())
    host.connected.length = 0
    seen.push(live.snapshot())
    seen.push(live.snapshot())
    host.connected.push(pad.pad)
    seen.push(live.snapshot())
    expect(seen.map((snapshot) => snapshot.connected)).toEqual([true, false, false, true])
    expect(live.timeline()[1]).toMatchObject({ frame: 1, release: ["west"], connected: false })
    expect(live.timeline()[2]).toMatchObject({ frame: 3, press: ["west"], connected: true })

    const parsed = Gamepad.parseTimeline(JSON.parse(JSON.stringify(live.timeline())))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const replay = Gamepad.scripted(bindings, parsed.value)
    for (const snapshot of seen) {
      const replayed = replay.snapshot()
      expect(replayed.actions).toEqual(snapshot.actions)
      expect(replayed.buttons).toEqual(snapshot.buttons)
      expect(replayed.left).toEqual(snapshot.left)
      expect(replayed.connected).toBe(snapshot.connected)
    }
  })

  it("releases everything and zeroes the sticks when a scripted pad disconnects", () => {
    const replay = Gamepad.scripted(bindings, [
      { frame: 0, press: ["west"], left: { x: 1, y: 0 }, rightTrigger: 1 },
      { frame: 1, connected: false }
    ])
    replay.snapshot()
    expect(replay.snapshot()).toEqual({ ...Gamepad.idle(bindings), actions: { ...Gamepad.idle(bindings).actions, attack: released }, buttons: { ...Gamepad.idle(bindings).buttons, west: released } })
  })

  it("rejects a connected flag that is not a boolean", () => {
    expect(Gamepad.parseTimeline([{ frame: 0, connected: "yes" }])).toMatchObject({ ok: false, error: { path: "[0].connected" } })
  })
})

describe("Gamepad.parseRebinding", () => {
  it("accepts the same actions bound to button names", () => {
    const parsed = Gamepad.parseRebinding(bindings, JSON.parse('{"attack":["north"],"dash":["south","east"],"ultimate":["leftTrigger"]}'))
    expect(parsed).toMatchObject({ ok: true, value: { attack: ["north"], dash: ["south", "east"], ultimate: ["leftTrigger"] } })
  })

  it("names the offending value", () => {
    const fail = (data: unknown) => {
      const parsed = Gamepad.parseRebinding(bindings, data)
      return parsed.ok ? null : parsed.error.path
    }
    expect(fail([])).toBe("")
    expect(fail({ attack: ["north"], dash: ["south"] })).toBe("ultimate")
    expect(fail({ attack: ["north"], dash: ["south"], ultimate: [], })).toBe("ultimate")
    expect(fail({ attack: ["north", "A"], dash: ["south"], ultimate: ["east"] })).toBe("attack[1]")
    expect(fail({ attack: ["north"], dash: ["south"], ultimate: ["east"], jump: ["west"] })).toBe("jump")
  })
})

describe("Gamepad.parseTimeline", () => {
  it("names the offending value", () => {
    expect(Gamepad.parseTimeline([{ frame: 0, press: ["jump"] }])).toMatchObject({ ok: false, error: { path: "[0].press[0]" } })
    expect(Gamepad.parseTimeline([{ frame: -1 }])).toMatchObject({ ok: false, error: { path: "[0].frame" } })
    expect(Gamepad.parseTimeline([{ frame: 0, left: { x: 2, y: 0 } }])).toMatchObject({ ok: false, error: { path: "[0].left" } })
    expect(Gamepad.parseTimeline([{ frame: 0, rightTrigger: 2 }])).toMatchObject({ ok: false, error: { path: "[0].rightTrigger" } })
    expect(Gamepad.parseTimeline({})).toMatchObject({ ok: false, error: { path: "" } })
  })
})

describe("Gamepad.isButton", () => {
  it("accepts standard mapping names only", () => {
    expect(Gamepad.isButton("south")).toBe(true)
    expect(Gamepad.isButton("A")).toBe(false)
  })
})
