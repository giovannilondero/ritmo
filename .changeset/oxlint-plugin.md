---
"@typeonce/oxlint-plugin-ritmo": minor
---

**New package: `@typeonce/oxlint-plugin-ritmo`, oxlint rules for Ritmo games.**

Types reject wrong calls and devtools lints reject wrong runs; these rules catch the source patterns neither can see. Every report says what goes wrong and the Ritmo API to use instead.

Simulation files (listed in an `overrides` entry, so host, render, and unrelated files keep using the platform):

- `ritmo/use-clock-for-time`: `Date.now()`, `performance.now()`, `new Date()`, and timers; read the `Clock` resource.
- `ritmo/use-random-for-randomness`: `Math.random()` and `crypto` randomness; draw with `Random.draw(resources.rng)`.
- `ritmo/use-ops-for-math`: `Math.sin`, `Math.hypot`, `a ** b`, and the other functions engines approximate; use `Ops` (fixes itself once `Ops` is imported).
- `ritmo/keep-simulation-headless`: page globals, host I/O, and renderer or UI imports; take input and data from the host, draw in a render schedule.
- `ritmo/no-infinity-in-simulation-data`: `Infinity` and `NaN` in object literals, which cannot be saved and loaded; use `null`.

Every file:

- `ritmo/handle-tick-result`: a dropped `runtime.tick(...)`, `tryTick(...)`, or `restore(...)` result.
- `ritmo/prefix-descriptor-and-system-names`: names without a `Game/` prefix.
- `ritmo/use-cell-value`: `cell.present ? cell.get() : undefined`; use `cell.value()` (fixes itself).

```jsonc
{
  "jsPlugins": ["@typeonce/oxlint-plugin-ritmo"],
  "rules": { "ritmo/handle-tick-result": "error" },
  "overrides": [{ "files": ["src/sim/**"], "rules": { "ritmo/use-ops-for-math": "error" } }]
}
```
