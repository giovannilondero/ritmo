import type * as Result from "@typeonce/ritmo/Result"

/** The snapshot a test expects to succeed: a failed one fails the test with its error. */
export const worldOf = <T>(snapshot: Result.Result<T, unknown>): T => {
  if (!snapshot.ok) throw new Error(`runtime.snapshot() failed: ${JSON.stringify(snapshot.error)}`)
  return snapshot.value
}
