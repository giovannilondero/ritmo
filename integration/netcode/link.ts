/**
 * A fake network between two peers: each message arrives some frames after
 * it was sent, a fixed latency plus a seeded jitter, so later messages can
 * overtake earlier ones. Seeded, so a failing test fails the same way again.
 */
import { Random } from "@typeonce/ritmo-math"

export interface LinkOptions {
  readonly seed: number
  /** Frames every message takes at least. */
  readonly latency: number
  /** Up to this many more frames, drawn per message. */
  readonly jitter: number
}

export interface Link<Message> {
  /** Sends a message during `frame`. */
  readonly send: (frame: number, message: Message) => void
  /** The messages that arrive by `frame`, in the order they arrive. */
  readonly receive: (frame: number) => ReadonlyArray<Message>
  /** Every message still on its way. */
  readonly drain: () => ReadonlyArray<Message>
}

export const makeLink = <Message>(options: LinkOptions): Link<Message> => {
  const random = Random.make(options.seed)
  let flying: Array<{ readonly at: number; readonly message: Message }> = []
  return {
    send: (frame, message) => {
      flying.push({ at: frame + options.latency + random.integer(0, options.jitter + 1), message })
    },
    receive: (frame) => {
      const arrived = flying.filter((entry) => entry.at <= frame).sort((a, b) => a.at - b.at)
      flying = flying.filter((entry) => entry.at > frame)
      return arrived.map((entry) => entry.message)
    },
    drain: () => {
      const all = [...flying].sort((a, b) => a.at - b.at).map((entry) => entry.message)
      flying = []
      return all
    }
  }
}
