---
"@typeonce/ritmo": minor
"@typeonce/ritmo-browser": minor
---

**Draining a service is declared, checked at compile time, and observed at run time.**

- **`System.Consumes<"snapshot">`** marks the methods of a service type that drain it. A system that declares the service with `Game.System.service` sees those methods as a compile error naming the fix (`snapshot() drains Game/Controls: declare it with Game.System.consumeService, or read the resource its capture writes`); `Game.System.consumeService` calls them. Its other methods stay available through `service` (a settings screen can still `rebind`).
- Every input source is marked: `Keyboard.Actions`, `Keyboard.Presses`, `Gamepad.Actions`, `Touch.Touch`, `Pointer.Pointer`, `Controls.Device`, `Controls.Controls`, and `InputCapture.Source`. **Breaking:** a system that called `snapshot()` through `Game.System.service` no longer compiles; read the resource `InputCapture.system` writes instead.
- `Game.System.service` returns `ServiceRead<D, false>` and `consumeService` returns `ServiceRead<D, true>`.
- The `service-consumed-twice` lint also reports what a debug runtime saw: a consumed service whose consumers ran at more than one placement in the session, in unnamed schedules too (`Game/Drain (schedule#2, step 0, unnamed)`). Named schedules are reported once, by the static lint.
