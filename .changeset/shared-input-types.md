---
"@typeonce/ritmo-browser": minor
---

**One home for the input types every device shares, and a checked pad count.**

- **Breaking: `ActionState` and `Vector` are exported from `Controls` only.** They were declared or re-exported per device (`Keyboard.ActionState`, `Pointer.ActionState`, `Keyboard.Vector`, `Gamepad.Vector`, `Touch.Vector`), all with the same shape. Only the import changes:

  ```diff
  -import type { ActionState } from "@typeonce/ritmo-browser/Keyboard"
  -import type { Vector } from "@typeonce/ritmo-browser/Gamepad"
  +import type { ActionState, Vector } from "@typeonce/ritmo-browser/Controls"
  ```

- **`Gamepad.pads(host, bindings, max)` takes a whole number literal of 1 or more.** `0`, `-2` and `2.5` do not compile (`max must be a whole number of pads, 1 or more`), and neither does a plain `number` (`max must be a number literal`). Correct calls are unchanged.
- `Controls.Pads`, the pool entry `Gamepad.pads(...)` fills, is now marked with `System.Consumes<"snapshot">` like every other input source.
- `Gamepad.scriptedPads` documents how it differs from live pads: every timeline is in the list from the first snapshot with its id, and a pad plugged in later is a timeline whose first entry comes later.
