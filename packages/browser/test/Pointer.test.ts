import { describe, expect, it } from "vitest"

import { Pointer } from "@typeonce/ritmo-browser"

const makeTarget = (rect = { left: 10, top: 20 }) => {
  const listeners = new Map<string, Set<(event?: any) => void>>()
  const captured: Array<number> = []
  const add = (type: string, listener: (event?: any) => void) => {
    const set = listeners.get(type) ?? new Set()
    set.add(listener)
    listeners.set(type, set)
  }
  const remove = (type: string, listener: (event?: any) => void) => {
    listeners.get(type)?.delete(listener)
  }
  const target: Pointer.PointerTarget = {
    addEventListener: add,
    removeEventListener: remove,
    getBoundingClientRect: () => rect,
    setPointerCapture: (id) => captured.push(id),
    releasePointerCapture: (id) => captured.splice(captured.indexOf(id), 1)
  }
  const blurHost: Pointer.BlurHost = { addEventListener: add, removeEventListener: remove }
  let prevented = 0
  const dispatch = (type: string, clientX: number, clientY: number, button = 0) => {
    for (const listener of listeners.get(type) ?? []) {
      listener({ clientX, clientY, button, pointerId: 1, preventDefault: () => prevented++ })
    }
  }
  return {
    target,
    blurHost,
    captured,
    prevented: () => prevented,
    move: (x: number, y: number) => dispatch("pointermove", x, y),
    down: (x: number, y: number, button = 0) => dispatch("pointerdown", x, y, button),
    up: (x: number, y: number, button = 0) => dispatch("pointerup", x, y, button),
    leave: () => dispatch("pointerleave", 0, 0),
    contextMenu: () => dispatch("contextmenu", 0, 0),
    blur: () => {
      for (const listener of listeners.get("blur") ?? []) listener()
    },
    listenerCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0)
  }
}

const bindings = { fire: ["primary"], aim: ["secondary", "back"] } as const

describe("Pointer.actions", () => {
  it("reports element-relative positions, whether the pointer is over the element, and movement as use", () => {
    const fake = makeTarget()
    const pointer = Pointer.actions(fake.target, fake.blurHost, bindings)

    expect(pointer.snapshot()).toEqual(Pointer.idle(bindings))
    fake.move(110, 70)
    expect(pointer.snapshot()).toMatchObject({ position: { x: 100, y: 50 }, over: true, used: true })
    expect(pointer.snapshot().used).toBe(false)
    fake.move(110, 70)
    expect(pointer.snapshot().used).toBe(false)
    fake.leave()
    expect(pointer.snapshot()).toMatchObject({ position: { x: 100, y: 50 }, over: false, used: false })
  })

  it("reports bound actions and raw buttons, keeping clicks shorter than a frame", () => {
    const fake = makeTarget()
    const pointer = Pointer.actions(fake.target, fake.blurHost, bindings)

    fake.down(10, 20)
    const pressed = pointer.snapshot()
    expect(pressed.actions.fire).toEqual({ held: true, pressed: true, released: false })
    expect(pressed.buttons.primary).toEqual({ held: true, pressed: true, released: false })
    expect(pressed.used).toBe(true)
    expect(pointer.snapshot().actions.fire).toEqual({ held: true, pressed: false, released: false })
    fake.up(10, 20)
    const released = pointer.snapshot()
    expect(released.actions.fire).toEqual({ held: false, pressed: false, released: true })
    expect(released.used).toBe(false)

    fake.down(10, 20, 2)
    fake.up(10, 20, 2)
    const click = pointer.snapshot()
    expect(click.actions.aim).toEqual({ held: false, pressed: true, released: true })
    expect(click.buttons.secondary).toEqual({ held: false, pressed: true, released: true })
    expect(click.actions.fire).toEqual({ held: false, pressed: false, released: false })
  })

  it("reads the side buttons", () => {
    const fake = makeTarget()
    const pointer = Pointer.actions(fake.target, fake.blurHost, bindings)
    fake.down(10, 20, 3)
    const back = pointer.snapshot()
    expect(back.buttons.back.held).toBe(true)
    expect(back.actions.aim.held).toBe(true)
    fake.down(10, 20, 4)
    expect(pointer.snapshot().buttons.forward.pressed).toBe(true)
  })

  it("rebinds the same actions, releasing an action held only through a button it lost", () => {
    const fake = makeTarget()
    const pointer = Pointer.actions(fake.target, fake.blurHost, bindings)
    fake.down(10, 20)
    pointer.snapshot()
    pointer.rebind({ fire: ["middle"], aim: ["primary"] })
    const after = pointer.snapshot()
    expect(after.actions.fire).toEqual({ held: false, pressed: false, released: true })
    // The held button holds its new action only once pressed again.
    expect(after.actions.aim.held).toBe(false)
    fake.down(10, 20, 1)
    expect(pointer.snapshot().actions.fire.pressed).toBe(true)
  })

  it("captures the pointer while a button is held and releases buttons on blur", () => {
    const fake = makeTarget()
    const pointer = Pointer.actions(fake.target, fake.blurHost, bindings)

    fake.down(10, 20)
    expect(fake.captured).toEqual([1])
    fake.up(10, 20)
    expect(fake.captured).toEqual([])

    fake.down(10, 20)
    pointer.snapshot()
    fake.blur()
    const blurred = pointer.snapshot()
    expect(blurred.actions.fire).toEqual({ held: false, pressed: false, released: true })
    expect(blurred.used).toBe(false)
  })

  it("suppresses the context menu by default and removes every listener on dispose", () => {
    const fake = makeTarget()
    const pointer = Pointer.actions(fake.target, fake.blurHost, bindings)
    fake.contextMenu()
    expect(fake.prevented()).toBe(1)
    pointer.dispose()
    expect(fake.listenerCount()).toBe(0)

    const allowed = Pointer.actions(fake.target, fake.blurHost, bindings, { preventContextMenu: false })
    fake.contextMenu()
    expect(fake.prevented()).toBe(1)
    allowed.dispose()
  })

  it("tracks the position and raw buttons alone with no bindings", () => {
    const fake = makeTarget()
    const pointer = Pointer.actions(fake.target, fake.blurHost, {})
    fake.down(10, 20, 1)
    expect(pointer.snapshot()).toMatchObject({ actions: {}, position: { x: 0, y: 0 }, used: true })
  })
})

describe("Pointer.parseRebinding", () => {
  it("accepts exactly the actions of the bindings, each with known buttons", () => {
    expect(Pointer.parseRebinding(bindings, { fire: ["forward"], aim: ["primary"] })).toEqual({
      ok: true,
      value: { fire: ["forward"], aim: ["primary"] }
    })
    expect(Pointer.parseRebinding(bindings, { fire: ["left"], aim: ["primary"] })).toMatchObject({ ok: false, error: { path: "fire[0]" } })
    expect(Pointer.parseRebinding(bindings, { fire: ["primary"] })).toMatchObject({ ok: false, error: { path: "aim" } })
    expect(Pointer.parseRebinding(bindings, { fire: ["primary"], aim: ["primary"], jump: ["primary"] })).toMatchObject({ ok: false, error: { path: "jump" } })
  })
})

describe("Pointer timelines", () => {
  it("plays moves, presses, and releases by snapshot index through the bindings", () => {
    const pointer = Pointer.scripted(bindings, [
      { frame: 0, move: { x: 5, y: 6 }, press: ["primary"] },
      { frame: 2, release: ["primary"] },
      { frame: 3, move: { x: 7, y: 8 }, press: ["secondary"], release: ["secondary"] }
    ])
    const snapshots = [0, 1, 2, 3].map(() => pointer.snapshot())

    expect(snapshots.map((snapshot) => snapshot.position)).toEqual([{ x: 5, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 6 }, { x: 7, y: 8 }])
    expect(snapshots.map((snapshot) => snapshot.actions.fire.held)).toEqual([true, true, false, false])
    expect(snapshots.map((snapshot) => snapshot.used)).toEqual([true, true, false, true])
    expect(snapshots[2]!.actions.fire.released).toBe(true)
    expect(snapshots[3]!.actions.aim).toEqual({ held: false, pressed: true, released: true })
    expect(pointer.frames()).toBe(4)
  })

  it("records a live session into a timeline that replays to the same snapshots", () => {
    const fake = makeTarget({ left: 0, top: 0 })
    const recorder = Pointer.recording(Pointer.actions(fake.target, fake.blurHost, bindings))
    const live: Array<Pointer.Snapshot<typeof bindings>> = []
    fake.move(3, 4)
    live.push(recorder.snapshot())
    live.push(recorder.snapshot())
    fake.down(5, 6)
    live.push(recorder.snapshot())
    fake.up(5, 6)
    live.push(recorder.snapshot())

    const parsed = Pointer.parseTimeline(JSON.parse(JSON.stringify(recorder.timeline())))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const replay = Pointer.scripted(bindings, parsed.value)
    const replayed = live.map(() => replay.snapshot())
    expect(replayed.map(({ over: _, ...rest }) => rest)).toEqual(live.map(({ over: _, ...rest }) => rest))
    recorder.dispose()
    expect(fake.listenerCount()).toBe(0)
  })

  it("rejects malformed timelines with a path", () => {
    expect(Pointer.parseTimeline([{ frame: 0, move: { x: "1", y: 2 } }])).toEqual({
      ok: false,
      error: { _tag: "InvalidTimeline", path: "[0].move.x", message: "expected a finite number" }
    })
    expect(Pointer.parseTimeline([{ frame: 1, press: ["left"] }])).toMatchObject({
      ok: false,
      error: { path: "[0].press[0]" }
    })
  })
})
