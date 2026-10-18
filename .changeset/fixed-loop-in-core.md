---
"@typeonce/ritmo": minor
"@typeonce/ritmo-browser": minor
---

**`FixedLoop` moves to core, so any host can drive it.** See [MIGRATION.md](https://github.com/typeonce-dev/ritmo/blob/main/MIGRATION.md#upgrading-to-090).

- **`FixedLoop` is now exported from `@typeonce/ritmo`** (`import { FixedLoop } from "@typeonce/ritmo"`). Its API is unchanged. `@typeonce/ritmo-browser` no longer exports it.
- **`BrowserTickSource.make(window)`** in `@typeonce/ritmo-browser` replaces `FixedLoop.animationFrames(window)`. It is the browser's `TickSource`, named like `BrowserHostClock`. Native shells, desktop runtimes, and renderer tickers wrap their own frames with `FixedLoop.source(...)`.
- **Package sources compile without DOM types.** Core, math, render, browser, and pixi reach no DOM global, and the compiler now rejects one. Published code is unchanged.
