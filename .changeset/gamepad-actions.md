---
"@typeonce/ritmo-browser": minor
---

**`Gamepad` reads controllers as named actions, and keyboard and gamepad bindings can change at runtime.**

- **`Gamepad.actions(navigator, bindings, options)`** binds actions to buttons named by the browser's standard mapping (`"south"`, `"west"`, `"rightTrigger"`, `"dpadUp"`, `"start"`...). Each snapshot has `actions` (as `Keyboard`'s), every `buttons` state by name whatever the bindings (for menu navigation and for a settings screen waiting for the button to bind), the `left` and `right` sticks with a radial dead zone (`y` grows down, as `Touch`'s stick), how far each trigger is pulled, and the followed pad's `id`. It follows the pad used last and releases everything held when that pad disconnects. Call `poll()` each animation frame so taps shorter than an update count. `Gamepad.idle`, `scripted`, `recording`, `parseTimeline`, and `isButton` match the other devices; timelines name buttons, so a replay follows the bindings.
- **`rebind(bindings)`** on `Keyboard.actions(...)` and `Gamepad.actions(...)` binds the same actions to new keys or buttons, for players who remap their controls. An action held only through a key it lost reports `released`. Scripted keyboard actions ignore it (their timeline names actions).
- **Breaking for hand-written sources:** `Keyboard.Actions` now requires `rebind`. An object implementing it by hand adds `rebind() {}`.
