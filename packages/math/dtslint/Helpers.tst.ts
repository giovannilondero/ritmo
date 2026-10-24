import { Box2, Collide2, FlowField, Ops, Random, Scalar, Segment2, SpatialGrid, Vec2, Vector2 } from "@typeonce/ritmo-math"
import { describe, expect, it } from "tstyche"

declare const size: Scalar.Positive
declare const validated: Vector2.Vector2

describe("hot-path helpers", () => {
  it("Vec2 works on plain and validated vectors alike", () => {
    expect(Vec2.add({ x: 1, y: 2 }, validated)).type.toBe<Vec2.Vec2>()
    expect(Vec2.length(validated)).type.toBe<number>()
    expect(Vec2.normalizeOr({ x: 1, y: 2 }, Vec2.zero)).type.toBe<Vec2.Vec2>()
    // @ts-expect-error Property 'y' is missing
    Vec2.add({ x: 1 }, validated)
  })

  it("Ops takes and returns plain numbers", () => {
    expect(Ops.sin(1)).type.toBe<number>()
    expect(Ops.atan2(1, 2)).type.toBe<number>()
    expect(Ops.pow(2, 0.5)).type.toBe<number>()
    expect(Ops.hypot(3, 4)).type.toBe<number>()
    // @ts-expect-error Expected 2 arguments, but got 3
    Ops.hypot(1, 2, 3)
  })

  it("Box2 and Collide2 report contacts as optional values", () => {
    const box = Box2.around(0, 0, 1, 1)
    expect(box).type.toBe<Box2.Box2>()
    expect(Collide2.sweepCircleBox({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, box)).type.toBe<Collide2.Hit | undefined>()
    expect(Collide2.sweepCircleCircle({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, { x: 3, y: 0 }, 1)).type.toBe<number | undefined>()
    expect(Collide2.moveCircle({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, { boxes: [box] })).type.toBe<Collide2.MoveResult>()
    // @ts-expect-error Property 'maxY' is missing
    Collide2.pushOut({ x: 0, y: 0 }, 1, { boxes: [{ minX: 0, minY: 0, maxX: 1 }] })
  })

  it("Segment2 walls collide through the same Walls as boxes", () => {
    const box = Box2.around(0, 0, 1, 1)
    const wall = Segment2.between({ x: 0, y: 0 }, { x: 4, y: 3 })
    expect(wall).type.toBe<Segment2.Segment2>()
    expect(Segment2.closestPoint(wall, { x: 1, y: 1 })).type.toBe<Vec2.Vec2>()
    expect(Segment2.overlapsCircle(wall, { x: 1, y: 1 }, 1)).type.toBe<boolean>()
    expect(Collide2.sweepCircleSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, wall)).type.toBe<Collide2.Hit | undefined>()
    expect(Collide2.sweepCircle({ x: 0, y: 0 }, { x: 1, y: 0 }, 0, { boxes: [box], segments: [wall] })).type.toBe<Collide2.Hit | undefined>()
    expect(Collide2.moveCircle({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, { segments: [wall] })).type.toBe<Collide2.MoveResult>()
    expect(Collide2.pushOut({ x: 0, y: 0 }, 1, {})).type.toBe<Vec2.Vec2>()
    // @ts-expect-error Property 'by' is missing
    Collide2.moveCircle({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, { segments: [{ ax: 0, ay: 0, bx: 1 }] })
    // @ts-expect-error pass walls by kind: { boxes: walls } or { segments: walls }
    Collide2.moveCircle({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, [box])
  })

  it("Random makes absence explicit", () => {
    const random = Random.make(1)
    expect(random).type.toBe<Random.Random>()
    expect(random.pick(["a", "b"] as const)).type.toBe<"a" | "b" | undefined>()
    expect(random.weighted([{ weight: 1 }], (item) => item.weight)).type.toBe<{ weight: number } | undefined>()
    expect(random.shuffle([1, 2])).type.toBe<Array<number>>()
    // @ts-expect-error Cannot assign to 'state' because it is a read-only property
    random.state = 3
  })

  it("SpatialGrid and FlowField need a positive cell size", () => {
    expect(SpatialGrid.make(size)).type.toBe<SpatialGrid.SpatialGrid>()
    expect(FlowField.make(size)).type.toBe<FlowField.FlowField>()
    expect(FlowField.make(size).way({ x: 0, y: 0 })).type.toBe<Vec2.Vec2 | undefined>()
    expect(FlowField.make(size).distance({ x: 0, y: 0 })).type.toBe<number | undefined>()
    // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'Positive'
    SpatialGrid.make(16)
    // @ts-expect-error Argument of type 'number' is not assignable to parameter of type 'Positive'
    FlowField.make(16)
  })
})

describe("Random resource", () => {
  it("draws only from the cell of a random resource", () => {
    expect(Random.seed(1)).type.toBe<Random.State>()
    const cell = { get: () => Random.seed(1), set: (_: Random.State) => {}, update: () => {} }
    expect(Random.draw(cell)).type.toBe<Random.Random>()
    const score = { get: () => 1, set: (_: number) => {}, update: () => {} }
    // @ts-expect-error Type 'number' is not assignable to type 'State'
    Random.draw(score)
  })
})
