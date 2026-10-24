import { describe, expect, it } from "vitest"
import { NetworkLink, WebRtcNetworkLink, WebSocketNetworkLink } from "@typeonce/ritmo-netcode"

/** A stand-in for a WebSocket or a data channel: the test opens, delivers, and closes it. */
const fake = <State>(initial: State) => {
  const listeners = new Map<string, Array<(event: { readonly data?: unknown; readonly reason?: string }) => void>>()
  const sent: Array<string> = []
  const socket = {
    readyState: initial,
    send: (data: string) => {
      sent.push(data)
    },
    addEventListener: (type: string, listener: (event: { readonly data?: unknown; readonly reason?: string }) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    }
  }
  const emit = (type: string, event: { readonly data?: unknown; readonly reason?: string }) => {
    for (const listener of listeners.get(type) ?? []) listener(event)
  }
  return { socket, sent, emit }
}

describe("WebSocketNetworkLink.make", () => {
  it("sends while open, receives text, and reports the close reason", () => {
    const { socket, sent, emit } = fake(0)
    const link = WebSocketNetworkLink.make(socket)
    link.send("too early")
    socket.readyState = 1
    link.send("hello")
    emit("message", { data: "one" })
    emit("message", { data: new Uint8Array([1]) })
    emit("message", { data: "two" })
    expect(sent).toEqual(["hello"])
    expect(link.receive()).toEqual(["one", "two"])
    expect(link.receive()).toEqual([])
    expect(link.status()).toEqual(NetworkLink.open)
    socket.readyState = 3
    emit("close", { reason: "server restarted" })
    expect(link.status()).toEqual(NetworkLink.closed("server restarted"))
  })
})

describe("WebRtcNetworkLink.make", () => {
  it("sends while open, receives text, and closes with the channel", () => {
    const { socket, sent, emit } = fake<"connecting" | "open" | "closing" | "closed">("connecting")
    const link = WebRtcNetworkLink.make(socket)
    link.send("too early")
    socket.readyState = "open"
    link.send("hello")
    emit("message", { data: "one" })
    expect(sent).toEqual(["hello"])
    expect(link.receive()).toEqual(["one"])
    socket.readyState = "closing"
    expect(link.status()._tag).toBe("Closed")
  })
})
