# `@typeonce/ritmo-browser`

Browser integrations for ritmo: animation frames as a tick source for the core fixed-step loop (`BrowserTickSource`), keyboard actions with press/release edges, bound by character or by physical key (`Keyboard`), gamepad actions by standard-mapping button names plus the sticks and triggers (`Gamepad`), both rebindable at runtime for a controls settings screen (capture the key or button to bind, validate saved bindings with `parseRebinding`), mouse and pen actions (rebindable too), raw buttons, and position over an element (`Pointer`), on-screen touch controls with a floating stick and drag-to-aim buttons (`Touch`), scripted and recorded keyboard, pointer, and gamepad timelines for tests and replays, one input source merged from several devices, with the actions declared once as buttons and vectors (movement with length at most 1, from keys, d-pad, stick, or touch stick) and devices used together (keyboard and mouse) grouped as one (`Controls`), and a system that copies input into a resource (`InputCapture`).

```sh
pnpm add @typeonce/ritmo-browser @typeonce/ritmo
```

The package owns browser plumbing only; schemas, resources, and schedules stay in your game.

Released together with [`@typeonce/ritmo`](https://github.com/typeonce-dev/ritmo/blob/main/packages/core/README.md), always with the same version.

Source: https://github.com/typeonce-dev/ritmo
