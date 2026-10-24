---
"@typeonce/ritmo-devtools": patch
---

**The `ritmo-devtools lint` docs put the entry beside the simulation** (`src/lint.ts`), loading the render and audio schedules inside `lintTarget`. With the entry inside the simulation, `describe` made the simulation import host code, which a game's own import rules forbid. The CLI already treated the entry as host code; the docs now say so.
