---
"@typeonce/ritmo-browser": minor
---

**Movement is one vector action: declared once, bound per device, merged by `Controls`, and checked like every other action.**

- **Breaking: `Controls.actions({ buttons: [...], vectors: [...] })`** replaces `Controls.actions([...])`. A button action is pressed and held (jump); a vector action is a direction with length at most 1, `y` growing down (move). A name declared as both kinds does not compile. `ActionSet.names` is now `buttons` and `vectors`.
- **`Keyboard.vector({ up, down, left, right })`** binds a vector to keys: opposite keys cancel and a diagonal has length 1. **`Gamepad.vector({ stick, up, down, left, right })`** binds it to a stick, the d-pad, or both (the longer wins). **A `Touch` layout's `stick.vector`** names the vector the stick drives. Every device snapshot has `vectors` (empty for `Pointer`, which reports `position` and `movement`).
- `Controls` merges a vector as the longest any device reports, so devices never add up past 1 or cancel each other. Vectors work with `lacking`, `available`, `idle`, and `lastUsed` (a vector in use counts as use). Binding a vector action as a button (or the reverse), missing a vector, and reading `actions.move` or `vectors.jump` do not compile, each with an error naming the fix.
- `rebind` and `parseRebinding` take vector bindings (`Gamepad` can swap sticks).
- **Breaking: keyboard timelines name a vector by direction**, `press: ["move.right"]`; `parseTimeline` validates it. Gamepad and touch timelines are unchanged (buttons, sticks).
- **Breaking: `Touch.idle({ buttons, vector? })` and `Touch.scripted({ buttons, vector? }, timeline)`** take the names as an object.
- Directions that step one tile at a time (a grid game reading taps) stay button actions.
