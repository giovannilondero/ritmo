---
"@typeonce/ritmo": patch
---

**The `RuntimeServices` docs show how to pass services through a game's own function.** Bound it by `RuntimeServices`, not `RuntimeServices<any>`: every service set satisfies the bound, `const` keeps the exact one, and a missing service still fails at `tick`.

```ts
export const makeRuntime = <const Services extends RuntimeServices>(services: Services) =>
  Game.Runtime.make({ services, resources: { Score: 0 } })
```
