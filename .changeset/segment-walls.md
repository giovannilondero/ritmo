---
"@typeonce/ritmo-math": minor
---

**`Collide2` collides circles with line segments, so walls can run at any angle.** The new `Segment2` module is the plain segment `Collide2` reads every frame (`Segment2.between(a, b)`, `closestPoint`, `overlapsCircle`), like `Box2` for boxes. A segment is a two-sided wall with round ends; both ends at one point make a round post. `Collide2.sweepCircleSegment` finds the first contact with one, next to `sweepCircleBox`. A map traced from survey data, a slanted fence, or a polygon's edges no longer need a hand-written port of `moveCircle`.

```ts
const fence = Segment2.between({ x: 0, y: 0 }, { x: 40, y: 30 })
const moved = Collide2.moveCircle(position, delta, radius, { boxes: rooms, segments: [fence] })
```

- **Breaking: `moveCircle` and `pushOut` take the walls by kind, as `Collide2.Walls`** (`{ boxes?, segments? }`), instead of an array of boxes. An array no longer compiles (`pass walls by kind: { boxes: walls } or { segments: walls }`):

  ```diff
  -Collide2.moveCircle(position, delta, radius, walls)
  +Collide2.moveCircle(position, delta, radius, { boxes: walls })
  -Collide2.pushOut(position, radius, walls)
  +Collide2.pushOut(position, radius, { boxes: walls })
  ```

- **Breaking: `sweepCircleBoxes` is `sweepCircle`**, the first contact with any of the walls (line of sight with a radius of 0, as before):

  ```diff
  -Collide2.sweepCircleBoxes(eye, Vec2.subtract(target, eye), 0, walls) === undefined
  +Collide2.sweepCircle(eye, Vec2.subtract(target, eye), 0, { boxes: walls }) === undefined
  ```

  Results against boxes are unchanged.
