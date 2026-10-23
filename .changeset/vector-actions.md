---
"@typeonce/ritmo-browser": minor
---

**Movement is one vector action: declared once, bound per device, merged by `Controls`, and checked like every other action.**

- **`Controls.actions({ buttons: [...], vectors: [...] })`** declares both kinds. A button action is pressed and held (jump); a vector action is a direction with length at most 1, `y` growing down (move). A name declared as both kinds does not compile. The declared names are listed in the set's `buttons` and `vectors`.
- **`Keyboard.vector({ up, down, left, right })`** binds a vector to keys: opposite keys cancel and a diagonal has length 1. **`Gamepad.vector({ stick, up, down, left, right })`** binds it to a stick, the d-pad, or both (the longer wins). **A `Touch` layout's `stick.vector`** names the vector the stick drives. Every device snapshot has `vectors`; read `input.vectors.move` (`Pointer`'s is empty: it reports `position` and `movement`).
- `Controls` merges a vector as the longest any device reports, so devices never add up past 1 or cancel each other. Vectors work with `lacking`, `available`, `idle`, and `lastUsed` (a vector in use counts as use). Binding a vector action as a button (or the reverse), missing a vector, and reading `actions.move` or `vectors.jump` do not compile, each with an error naming the fix.
- `rebind` and `parseRebinding` take vector bindings (`Gamepad` can swap sticks).
- Keyboard timelines name a vector by direction, `press: ["move.right"]`; `parseTimeline` validates it. Button actions are named as before.
- **Breaking: `Touch.idle` and `Touch.scripted` take the names as an object**, `{ buttons, vector? }` (`vector` as the layout's `stick.vector`):

  ```diff
  -Touch.idle(["fire"])
  -Touch.scripted(["fire"], timeline)
  +Touch.idle({ buttons: ["fire"] })
  +Touch.scripted({ buttons: ["fire"] }, timeline)
  ```

- Directions that step one tile at a time (a grid game reading taps) stay button actions.
