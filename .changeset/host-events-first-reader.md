---
"@typeonce/ritmo": patch
---

**An event the host sends with `runtime.send` reaches a reader that has not run yet.** A reader starts holding events on its first run, so until then a sent event was kept for only two `runtime.tick(...)` calls: a request sent before the first fixed step (a menu setting, a title card holding the clock) was dropped when the render schedule ticked first, with `lagged()` reporting nothing. A sent event now waits for the first reader of its stream to run, up to `Runtime.streamCapacity` entries, as the `runtime.send` docs promised. A game that placed its request handlers in `setup` too, only so they listen before the host sends, can keep them in `update` alone.

- **Behaviour:** a run that sent an event before its reader first ran now delivers it. A recorded replay or fingerprint of such a run plays differently: re-record it with the upgrade.
- Events systems emit are unchanged, and so is a second reader that first runs after the first reader read the event: it does not see it.
