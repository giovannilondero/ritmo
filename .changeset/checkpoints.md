---
"@typeonce/ritmo": minor
"@typeonce/ritmo-devtools": minor
"@typeonce/oxlint-plugin-ritmo": minor
---

**Rewind a runtime in memory, for rollback netcode and client prediction.** `runtime.checkpoint(simulate)` marks the world between ticks, and `runtime.rewind(checkpoint)` puts it back exactly: ticking `simulate` again gives the same results, bit for bit, as a runtime that never rewound (entity ids, values and their change ticks, relations, scopes, resources, machines, queued commands, unread events, and the read positions of `simulate`'s systems). See the `Checkpoint` module, and the skill's new `playbooks/netcode.md`.

```ts
const history = new Map<number, Checkpoint.Checkpoint<typeof Root>>()
history.set(tick, runtime.checkpoint(simulate))
runtime.tick(simulate)

// Real input for an earlier tick differs from the guess: go back and run again.
const rewound = runtime.rewind(history.get(wrongTick)!)
if (!rewound.ok) resync(rewound.error) // Released: older than the window
```

- Taking a checkpoint copies only resources, machines, and queues; the first change to a page of values, an entity, a relation, or a scope after it keeps what it replaced. The runtime keeps the last `checkpoints` (a new option of `Game.Runtime.make`, `Checkpoint.defaultWindow` = 16 by default); an older one, one newer than a checkpoint rewound to, and every one taken before a `restore` fail with `Released`. A checkpoint of another runtime fails with `OtherRuntime`.
- A schedule that would not rewind does not compile, and the error (`__fixCheckpoint__`) names the fix: a service that is neither an input source (`snapshot()`) nor plain data, a system with `local` state (in its state transitions too), or a schedule widened to a schedule type.
- Systems and inspectors outside the rewound schedule, like renderers, see a rewind as ordinary changes. An entity the rewind took away and the ticks after it brought back under the same id is seen as changed, never as despawned and spawned again, so `RenderSync` keeps its node.
- **`runtime.checksum()`**: a fingerprint of what `snapshot()` saves, as 16 hex digits, that does not depend on how the world was built (component order, object key order). Peers compare it to catch a desync; gated like `snapshot`, and returns a `Result`.
- `Schedule.Source<Data>` and `Schedule.IsPlain<T>`: the input-source shape and the plain-data check that replays and checkpoints share. `Schedule.SystemsIn` is exported.

**Devtools:**

- **Breaking: `Replay.Source` and `Replay.IsPlain` moved to core**, as `Schedule.Source` and `Schedule.IsPlain`.

  ```diff
  -const Controls = Descriptor.Service<Replay.Source<Input>>()("Game/Controls")
  +import type * as Schedule from "@typeonce/ritmo/Schedule"
  +const Controls = Descriptor.Service<Schedule.Source<Input>>()("Game/Controls")
  ```

- **Breaking: replay checkpoint hashes are `runtime.checksum()`.** Replays recorded with an earlier version report every checkpoint as diverged; record them again. A runtime passed to `Replay.recorder` or `Replay.session` needs `checksum`, which every runtime with `snapshot` has.

**Lint:** `handle-tick-result` also reports a dropped `runtime.rewind(...)` result: a released checkpoint changes nothing, and the ticks meant to run again would run on top of the present.
