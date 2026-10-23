# A rule or mechanic

1. Find the systems, components, and resources the behaviour touches. Extend a system when the behaviour is a variant of what it already does; add one only for behaviour no system covers.
2. Name the data before the logic: what the system reads and writes, and where each value lives (see [`state-and-upgrades.md`](state-and-upgrades.md)). Declare exactly that access in the system spec.
3. When the player triggers it, add or extend a typed intent (a host event sent with `runtime.send(...)`, or the input resource) and validate it in the system, never in UI code.
   - Input is actions, never keys: add the action to the game's `Controls.actions({ buttons, vectors })` (a button for jump, a vector for movement), bind it on every device (or mark the device with `lacking`; a game with one device only binds it there), and read `input.actions.<name>` or `input.vectors.<name>` from the resource `InputCapture.system` writes. Never call a source's `snapshot()` in a system: it drains the source. In a local multiplayer game (`Controls.players`), read each player's slot (`input.p1.actions.<name>`).
4. Place the system in its schedule. The `Schedule` module header explains markers and `thisTick` reads.
5. Write a headless test: script the input (`Keyboard.scripted`, `Gamepad.scripted`, `Gamepad.scriptedPads` for several pads, or the same intents the UI sends), run the schedule, and assert the outcome a player would see.
6. When the mechanic uses time or randomness, add a `Determinism.check` over a scripted run.

**Done when** the headless test passes and the game's check passes.
