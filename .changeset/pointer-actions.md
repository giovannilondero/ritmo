---
"@typeonce/ritmo-browser": minor
---

**`Pointer` binds actions like `Keyboard` and `Gamepad` and merges into `Controls`, and `Controls.group` makes devices used together count as one.**

- **Breaking: `Pointer.track(target, blurHost, options?)` is `Pointer.actions(target, blurHost, bindings, options?)`.** Bindings map actions to buttons (`{ fire: ["primary"] }`); a misspelled button or an empty list does not compile. Pass `{}` for position and raw buttons only. The `Pointer.Pointer` type is `Pointer.Actions<B>` and `TrackOptions` is `ActionsOptions`.
- **Breaking: the snapshot is `{ actions, vectors, buttons, position, movement, wheel, over, locked, used }`.** Read `input.buttons.primary` (or a bound action) instead of `input.primary`. `used` is a press, a hold, or movement over the element; releases do not count. `movement`, `wheel`, and `locked` come with the wheel and the pointer lock.
- **The `back` and `forward` side buttons** (`PointerEvent.button` 3 and 4) are reported and bindable. `Pointer.buttonNames` and `Pointer.isButton` list and check them.
- `rebind(...)` swaps the buttons of the same actions; `Pointer.parseRebinding(bindings, data)` validates saved ones.
- **Breaking: `Pointer.idle(bindings, position?)` and `Pointer.scripted(bindings, timeline, start?)`** take the bindings first. Timelines still name buttons, so a replay follows the bindings as live play does.
- **`actions.group({ keyboard, mouse })`** groups devices into one merge entry: it binds what its devices bind between them, and `lastUsed` and `available` follow it as a whole, so walking with the keyboard while aiming with the mouse stays on one device. Grouped devices keep their own names in `devices`, `rebind`, and `idle`; `lastUsed` names the group. Pass the group to `lacking(...)` for actions none of its devices binds. A group of fewer than two devices, a `lacking` device or a group inside a group, a device binding an undeclared action, and a name used twice across devices and groups do not compile.
