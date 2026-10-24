---
"@typeonce/ritmo-devtools": minor
---

**Replays follow `runtime.snapshot()` returning a `Result`.** `Replay.Target`'s and `ReplaySession`'s `snapshot` return `Result<WorldSnapshot, SnapshotError>`, the recorder skips a tick whose world an `encode` rejects, and `extract` fails with the new `SnapshotFailed` when its start cannot be saved. **Breaking** for a custom `Replay.Target`: return the runtime's `snapshot()` result as it is.
