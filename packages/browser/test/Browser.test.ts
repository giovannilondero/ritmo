import { describe, expect, it } from "vitest"

import { BrowserTickSource, packageTag } from "@typeonce/ritmo-browser"

describe("@typeonce/ritmo-browser", () => {
  it("resolves through the workspace package entrypoint", () => {
    expect(packageTag).toBe("browser")
  })
})

describe("BrowserTickSource.make", () => {
  const fakeWindow = () => {
    const pending = new Map<number, (timestamp: number) => void>()
    let next = 0
    return {
      pending,
      host: {
        requestAnimationFrame: (callback: (timestamp: number) => void) => {
          next += 1
          pending.set(next, callback)
          return next
        },
        cancelAnimationFrame: (handle: number) => {
          pending.delete(handle)
        }
      },
      frame(timestamp: number) {
        const callbacks = [...pending.values()]
        pending.clear()
        for (const callback of callbacks) callback(timestamp)
      }
    }
  }

  it("reports zero for the first frame, then the time since the previous one", () => {
    const browser = fakeWindow()
    const deltas: Array<number> = []
    BrowserTickSource.make(browser.host).subscribe((tick) => deltas.push(tick.deltaMS))

    browser.frame(1000)
    browser.frame(1016)
    browser.frame(1050)

    expect(deltas).toEqual([0, 16, 34])
  })

  it("cancels the pending frame on stop and ignores a second stop", () => {
    const browser = fakeWindow()
    const deltas: Array<number> = []
    const subscription = BrowserTickSource.make(browser.host).subscribe((tick) => deltas.push(tick.deltaMS))

    browser.frame(0)
    subscription.stop()
    subscription.stop()
    browser.frame(16)

    expect(browser.pending.size).toBe(0)
    expect(deltas).toEqual([0])
  })

  it("schedules no further frame when stopped from inside a tick", () => {
    const browser = fakeWindow()
    let ticks = 0
    const subscription = BrowserTickSource.make(browser.host).subscribe(() => {
      ticks += 1
      subscription.stop()
    })

    browser.frame(0)
    browser.frame(16)

    expect(ticks).toBe(1)
    expect(browser.pending.size).toBe(0)
  })
})
