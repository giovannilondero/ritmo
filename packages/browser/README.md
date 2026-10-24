# `@typeonce/ritmo-browser`

Browser integrations for ritmo:

- `BrowserTickSource`: animation frames as a tick source for the core fixed-step loop.
- Devices, each built with `X.actions(...)` from its host and bindings (a layout for `Touch`) and reporting a snapshot of `actions`, `vectors`, and `used`: `Keyboard` (keys by character or physical key), `Gamepad` (standard-mapping button names, sticks, and triggers), `Pointer` (mouse and pen buttons, position, wheel, pointer lock), and `Touch` (on-screen controls with named floating sticks, one per vector, and drag-to-aim buttons; a control the game hides is `null` in the layout and lets go of its finger). Keyboard, gamepad, and pointer bindings are rebindable at runtime for a controls settings screen (validate saved ones with `parseRebinding`); every device has scripted timelines for tests, and keyboard, gamepad, and pointer also record them for replays.
- `Controls`: the game's actions declared once, as buttons and vectors (movement with length at most 1, from keys, d-pad, stick, or touch stick), and the devices merged into one input source; devices used together (keyboard and mouse) are grouped as one. It also holds the types every device shares: `Controls.ActionState` (a button's `held` / `pressed` / `released`) and `Controls.Vector`. `Controls.players` and `Gamepad.pads`: local multiplayer, where players join a slot by pressing a button on any pooled device, every pad on its own.
- `InputCapture`: the system that drains an input source once per update into a resource. Systems read that resource; a system that calls `snapshot()` itself declares the source with `Game.System.consumeService`.

```sh
pnpm add @typeonce/ritmo-browser @typeonce/ritmo
```

The package owns browser plumbing only; schemas, resources, and schedules stay in your game.

Released together with [`@typeonce/ritmo`](https://github.com/typeonce-dev/ritmo/blob/main/packages/core/README.md), always with the same version.

Source: https://github.com/typeonce-dev/ritmo
