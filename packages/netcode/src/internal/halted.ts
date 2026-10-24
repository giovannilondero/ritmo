import type { Halted, SessionError } from "../Netcode.ts"

/** Whether a session error only stops the session until `resync()`. */
export const isHalted = <TickError>(error: SessionError<TickError>): error is Halted<TickError> =>
  error._tag === "Desynced" || error._tag === "CheckpointLost" || error._tag === "TickFailed"
