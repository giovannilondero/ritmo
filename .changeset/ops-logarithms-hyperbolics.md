---
"@typeonce/ritmo-math": minor
---

**`Ops` covers every `Math` function engines approximate.** New: `Ops.expm1`, `log`, `log2`, `log10`, `log1p`, `cbrt`, `sinh`, `cosh`, `asinh`, `acosh`, and `atanh`, each a pure-JavaScript fdlibm port that returns the same bits on every engine and CPU (checked on V8 for macOS arm64, Linux x64, and Linux arm64, and on JavaScriptCore), within 1 ulp of the exact value. Simulation code no longer needs any `Math` function except the exact ones (`sqrt`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `trunc`, `sign`).
