---
"@typeonce/ritmo": patch
"@typeonce/ritmo-browser": patch
"@typeonce/ritmo-devtools": patch
"@typeonce/ritmo-math": patch
"@typeonce/ritmo-render": patch
"@typeonce/ritmo-pixi": patch
"@typeonce/oxlint-plugin-ritmo": patch
---

**Documentation pass over every public module.** Every export has JSDoc saying what it is for and which neighbouring API to use instead; examples that no longer compiled (`Session.make` without `hostClock`, `Replay.session`, the `Pointer` rebind) are fixed; `Debug.Lint` lists every lint code the runtime emits. The `stale-target` lint's fix now names `queries.x.getHandle(handle)`.
