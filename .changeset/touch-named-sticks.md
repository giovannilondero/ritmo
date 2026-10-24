---
"@typeonce/ritmo-browser": minor
---

**Touch layouts have named sticks, so a twin-stick shooter moves on the left and aims on the right.** A stick's key is the vector it drives, as a button's key is the action it reports. Each stick floats under its own thumb, two thumbs drive two sticks at once, and each reports `vectors.<name>` with `active`. A finger goes to the button it lands on, otherwise to the first free stick (in key order) whose region contains it, otherwise the swipe area.

```ts
Touch.actions(canvas, window, ({ width, height }) => ({
  sticks: {
    move: { region: { left: 0, top: 0, width: width / 2, height }, radius: 56 },
    aim: { region: { left: width / 2, top: 0, width: width / 2, height }, radius: 56 }
  },
  buttons: { dash: { center: { x: width - 84, y: height - 150 }, radius: 36 } }
}))
```

- **Breaking: `Layout.stick` (with `vector`) is `Layout.sticks`, keyed by the vector.** A buttons-only layout passes `sticks: {}`. A leftover `vector` field does not compile (`a stick drives the vector named by its key in sticks: remove vector`), and neither does a stick named like a button (`dash names both a stick and a button: give them different names`).

  ```diff
  -stick: { region, radius: 56, vector: "move" },
  +sticks: { move: { region, radius: 56 } },
  ```

- **Breaking: `Snapshot.stick` and the `Stick` type are removed.** Each stick is in `vectors` as a `StickState`: a `Controls.Vector` plus `active` (a thumb is on it). `Controls` merges it as a plain vector.

  ```diff
  -if (snapshot.stick.active) walk(snapshot.stick.vector)
  +if (snapshot.vectors.move.active) walk(snapshot.vectors.move)
  ```

- **Breaking: `View.stick` is `View.sticks`, by name** (each `{ origin, knob }` or `null`), and the radius is on `view.layout.sticks.<name>`.

  ```diff
  -if (view.stick !== null) draw(view.stick.origin, view.stick.knob, view.layout.stick.radius)
  +const stick = view.sticks.move
  +if (stick !== null) draw(stick.origin, stick.knob, view.layout.sticks.move.radius)
  ```

- **Breaking: `Names.vector` is `Names.sticks`, required like `buttons`** (`[]` for buttons only), for `Touch.idle` and `Touch.scripted`.

  ```diff
  -Touch.idle({ buttons: ["dash"], vector: "move" })
  -Touch.idle({ buttons: ["jump"] })
  +Touch.idle({ buttons: ["dash"], sticks: ["move"] })
  +Touch.idle({ buttons: ["jump"], sticks: [] })
  ```

- **Breaking: a timeline's `stick` is `sticks`, by name.** Naming a stick the names do not declare does not compile. `TimelineEntry` and `Timeline` take the stick names as a second type parameter.

  ```diff
  -{ frame: 0, stick: { x: 1, y: 0 } },
  -{ frame: 3, stick: null }
  +{ frame: 0, sticks: { move: { x: 1, y: 0 } } },
  +{ frame: 3, sticks: { move: null } }
  ```

- `Controls` copies each merged vector, so a merged `vectors.move` is a plain `{ x, y }` whatever the device's vector carries.
