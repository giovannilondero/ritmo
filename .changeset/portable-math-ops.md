---
"@typeonce/ritmo-math": minor
"@typeonce/ritmo-browser": patch
---

**`Ops`: math that returns the same bits on every engine.**

JavaScript engines may approximate `Math.sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `exp`, `tanh`, `pow`, `hypot`, and `a ** b`, and they do: V8 on macOS arm64 and on Linux x64, and JavaScriptCore (Safari, every iOS browser), return different last bits, and a simulation grows that bit into a different run. `Ops` from `@typeonce/ritmo-math` has the same functions as pure-JavaScript ports of fdlibm (musl libm), built only from operations every engine rounds exactly, so a run replays bit for bit on any device. Each is within 1 ulp of the exact value (`tanh` within 2, like the native one); `Ops.hypot` takes exactly two numbers and never overflows.

```ts
import { Ops } from "@typeonce/ritmo-math"

const heading = Ops.atan2(dy, dx)
const step = { x: Ops.cos(heading) * speed, y: Ops.sin(heading) * speed }
```

Use `Ops` in simulation code instead of those `Math` functions; `Math.abs`, `min`, `max`, `floor`, `ceil`, `round`, `trunc`, `sign`, `sqrt`, `+ - * /`, and `x ** 2` are already exact everywhere.

`Vec2.rotate`, `length`, `distance`, `normalizeOr`, `moveToward`, `clampLength`, `Collide2` corner normals, and `FlowField.way` now use `Ops`. Their results can differ from the previous version in the last bit, so a replay recorded on an earlier version may diverge. `Touch` (browser) measures stick and aim offsets with `Math.sqrt(x * x + y * y)` instead of `Math.hypot`, for the same reason.
