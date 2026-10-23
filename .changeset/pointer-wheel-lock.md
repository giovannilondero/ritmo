---
"@typeonce/ritmo-browser": minor
---

**`Pointer` reads the wheel and the pointer lock, and `Touch.track` is `Touch.actions`, so every device is built the same way.**

- **The wheel**, read two ways for two jobs. `wheel` is how far it scrolled since the previous snapshot, in CSS pixels (lines and pages are converted), for zoom. The `wheelUp`, `wheelDown`, `wheelLeft`, and `wheelRight` buttons pulse (pressed and released in one window) once per `Pointer.wheelStep` (100 px, one notch), so a stepping action binds them (`nextWeapon: ["wheelDown"]`) and merges with a gamepad bumper in `Controls`. The page does not scroll over the element unless `preventScroll: false`. `PointerTarget` gains the `wheel` listener.
- **Mouse look:** `movement` is the raw motion since the previous snapshot (`movementX`/`movementY`), locked or not. With `lock: document`, a click on the element locks the pointer (the browser grants a lock only inside a click, so the module asks in its own listener); that click is not reported as a press. `locked` turns `false` when the player leaves with Escape, which releases what was held. `used` also counts motion and scrolling.
- Timelines record and replay `wheel`, `movement`, and `locked`. Their `press`/`release` take `Pointer.PhysicalButton`s; wheel pulses come from `wheel`.
- **Breaking: `Touch.track(target, blurHost, layout, options?)` is `Touch.actions(...)`, the `Touch.Touch<B>` type is `Touch.Actions<B>`, and `Touch.TrackOptions` is `Touch.ActionsOptions`,** matching `Keyboard.actions`, `Gamepad.actions`, and `Pointer.actions`. Arguments and behavior are unchanged.
