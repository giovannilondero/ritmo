---
"@typeonce/ritmo-browser": minor
---

**A touch control the game hides is `null` in the layout, and lets go of its finger.** A finger kept the control it landed on until it lifted, and the layout was read only on a new touch, so a thumb resting on the walking stick when the game swapped in the driving buttons kept holding its direction: the car drove off on its own. The layout is now read on every snapshot and every new touch. A held control that turns `null` releases at once with `cancelled: true`, and its finger does nothing until it lifts; a `null` control takes no finger. Its name stays in `actions` and `vectors`, reported idle.

```ts
Touch.actions(canvas, window, ({ width, height }) => ({
  sticks: { move: driving() ? null : { region: { left: 0, top: 0, width: width / 2, height }, radius: 56 } },
  buttons: { steerLeft: driving() ? { center: { x: 60, y: height - 60 }, radius: 40 } : null }
}))
```

- **Breaking: `Layout.buttons` zones are `ButtonZone | null`, and `Layout.sticks` zones `StickZone | null`.** Code that reads zones from `view().layout` narrows them:

  ```diff
  -const dash = view.layout.buttons.dash
  -draw(dash.center, dash.radius)
  +const dash = view.layout.buttons.dash
  +if (dash !== null) draw(dash.center, dash.radius)
  ```

- The layout function now runs once per `snapshot()` as well: keep it cheap.
