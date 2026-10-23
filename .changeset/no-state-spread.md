---
"@typeonce/oxlint-plugin-ritmo": minor
---

**`ritmo/no-state-spread`** reports `_tag` set over a spread of the previous state, such as `{ ...ground, _tag: "air", vy: 2 }`: the old state's fields survive at runtime while the new state's type hides them. Move an entity state with `cell.transition({ from, to, data })`, or write the new state's fields out. Spreads that change fields of the same state are not reported. Turn it on for every file:

```jsonc
"ritmo/no-state-spread": "error"
```
