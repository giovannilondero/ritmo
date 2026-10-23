---
"@typeonce/ritmo": minor
---

**Transition reads say when they are empty, and inspectors cannot drain input.**

- **Breaking: `transitions.x.get()` returns `TransitionSnapshot | undefined`.** A system declaring `transitions: { x: Game.System.transition(M) }` reads the transition being applied, which exists only inside the machine's transition schedules (`onEnter` / `onExit` / `onTransition`). Anywhere else the runtime returned `undefined` while the type promised a value. Narrow it, or use `Game.System.readTransitionEvent(M)` from a regular schedule:

  ```diff
  -const { from, to } = transitions.app.get()
  +const transition = transitions.app.get()
  +if (transition === undefined) return
  +const { from, to } = transition
  ```

- **An inspector that declares a drained service does not compile.** `Game.Inspector(..., { services: { input: Game.System.consumeService(Input) } }, ...)` reports `an inspector must not drain a service`: an inspector reading the world (devtools, the host's view) would steal the game's input for that tick. Declare the service with `Game.System.service`, and drain it in one system.
