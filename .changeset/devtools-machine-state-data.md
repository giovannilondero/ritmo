---
"@typeonce/ritmo-devtools": minor
---

**Machine values print with their fields.** Dumps, `describe()`, the monitor, and the journal print a machine as its state, then its fields (`Talking {speaker:"Mira",page:2}`), through the new `Format.state(value)`. A system's access lists `updates machine fields` for `Game.System.updateMachine`, and each immediate update is a journal line of the new kind `"machine"` (`machine Game/Mode {...} -> {...}`), filterable with `journal({ kinds: ["machine"] })`.
