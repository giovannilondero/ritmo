---
"@typeonce/ritmo-browser": minor
---

**Local multiplayer: players join slots by pressing a button on any pooled device.**

- **`Controls.players(Actions, { slots, join, leave })`** declares the players: the slots (the most at once, in join order), the button action that joins (or `"any"` for any button), and the one that leaves while joining is open. A misspelled or vector action, no slot, and a slot named `joining` do not compile.
- **`Players.pool(devices)`** builds one input source from devices nobody holds yet. Pressing join on one gives it the first free slot; that snapshot reports `event: "joined"` with the player's input idle, so the press does nothing else (joining with the jump button does not jump). One device holds one slot; slots keep their names when another empties, and the next player fills the gap. Each pooled device binds every action (or is passed through `lacking`), and the join action always.
- The snapshot has every slot by name (`input.p2`): `joined`, `device` (what it joined with), `connected`, `event` (`"joined"`, `"left"`, or `null`), and the player's `actions`, `vectors`, and `available`, idle while the slot is empty. A device's own snapshot is behind a check of `device` (`if (input.p2.device === "pads") input.p2.devices.pads.left`). `Players.idle(...)` initializes the resource.
- Systems call `setJoining(open)` (closed at the start: open it on a join screen, or once for drop-in play), `leave(slot)` (a pause menu), and `rebind.<device>` through a plain service. Leaving by button works only while joining is open; otherwise `leave` is an ordinary action.
- **`Gamepad.pads(host, bindings, max)`** reads every pad on its own, for a pool: each pad joins as its own player. An unplugged pad keeps its slot (`connected: false`) and returns to it when it comes back. `Gamepad.scriptedPads(bindings, timelines)` drives one timeline per pad in tests.
- `describe()` lints two keyboard devices that bind the same key, a device taken by two sources (a merge and a pool), and joining never opened.
