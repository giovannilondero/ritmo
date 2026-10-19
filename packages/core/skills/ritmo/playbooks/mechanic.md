# A rule or mechanic

1. Find the systems, components, and resources the behaviour touches. Extend a system when the behaviour is a variant of what it already does; add one only for behaviour no system covers.
2. Name the data before the logic: what the system reads and writes, and where each value lives (see [`state-and-upgrades.md`](state-and-upgrades.md)). Declare exactly that access in the system spec.
3. When the player triggers it, add or extend a typed intent (a host event sent with `runtime.send(...)`, or the input resource) and validate it in the system, never in UI code.
4. Place the system in its schedule. The `Schedule` module header explains markers and `thisTick` reads.
5. Write a headless test: script the input (`Keyboard.scripted`, or the same intents the UI sends), run the schedule, and assert the outcome a player would see.
6. When the mechanic uses time or randomness, add a `Determinism.check` over a scripted run.

**Done when** the headless test passes and the game's check passes.
