import { describe, expect, it } from "vitest"
import { Descriptor, Result, Schema } from "@typeonce/ritmo"
import type * as Entity from "@typeonce/ritmo/Entity"

const Health = Descriptor.Component<number>()("Pages/Health")
const Position = Descriptor.Component<{ readonly x: number }>()("Pages/Position")
const Game = Schema.bind(Schema.fragment({ components: { Health, Position } }))

type Id = Entity.EntityId<typeof Game.schema, typeof Game.schema>

const makeRuntime = () => Game.Runtime.make({ services: Game.Runtime.services() }).value

const Healths = Game.Query({ selection: { health: Game.Query.write(Health) } })
const Changed = Game.Query({ selection: { health: Game.Query.read(Health) }, filters: [Game.Query.changed(Health)] })

const spawner = (count: number, ids: Array<Id> = []) =>
  Game.System("Pages/Spawn", { commands: Game.System.commands(Game.System.spawns(Health)) }, ({ commands }) => {
    for (let index = 0; index < count; index++) ids.push(commands.spawn(Game.Command.spawn([Health, index])))
  })

const AllHealth = Game.Inspector("Pages/AllHealth", {
  queries: { all: Game.Query({ selection: { health: Game.Query.read(Health) } }) }
}, ({ queries }) => queries.all.each().map((match) => match.data.health.get()))

/** What a `changed(Health)` reader sees on each run. */
const watcher = () => {
  const runs: Array<Array<number>> = []
  const system = Game.System("Pages/Watch", { queries: { changed: Changed } }, ({ queries }) => {
    runs.push(queries.changed.each().map((match) => match.data.health.get()))
  })
  return { system, runs }
}

describe("component storage in pages", () => {
  it("rolls back a failed system's writes across every page it touched", () => {
    const runtime = makeRuntime()
    // 600 entities span three pages.
    runtime.tick(Game.Schedule(spawner(600), Game.Schedule.applyDeferred()))
    const Fail = Game.System("Pages/Fail", { queries: { all: Healths } }, ({ queries }) => {
      for (const { data } of queries.all.each()) data.health.set(-1)
      return Result.failure("Rejected" as const)
    })
    const failed = runtime.tick(Game.Schedule(Fail))
    expect(failed.ok).toBe(false)
    expect(runtime.inspect(AllHealth)).toEqual(Array.from({ length: 600 }, (_, index) => index))
  })

  it("counts a write as a change only when the value differs", () => {
    const runtime = makeRuntime()
    const watch = watcher()
    runtime.tick(Game.Schedule(spawner(3), Game.Schedule.applyDeferred(), watch.system))
    // Writes 0 → 0 (equal), 1 → 10, 2 → NaN; then NaN → NaN, which is equal too.
    const Write = Game.System("Pages/Write", { queries: { all: Healths } }, ({ queries }) => {
      for (const { data } of queries.all.each()) {
        const health = data.health.get()
        data.health.set(health === 1 ? 10 : health === 2 || Number.isNaN(health) ? Number.NaN : health)
      }
    })
    runtime.tick(Game.Schedule(Write, watch.system))
    runtime.tick(Game.Schedule(Write, watch.system))
    expect(watch.runs).toEqual([[0, 1, 2], [10, Number.NaN], []])
  })

  it("counts an object value as changed only when a different object is written", () => {
    const runtime = makeRuntime()
    const seen: Array<number> = []
    const Spawn = Game.System("Pages/SpawnPosition", { commands: Game.System.commands(Game.System.spawns(Position)) }, ({ commands }) => {
      commands.spawn(Game.Command.spawn([Position, { x: 1 }]))
    })
    const Rewrite = Game.System("Pages/Rewrite", {
      queries: { positions: Game.Query({ selection: { position: Game.Query.write(Position) } }) }
    }, ({ queries }) => {
      // Writing back the value read is not a change; an equal new object is.
      for (const { data } of queries.positions.each()) data.position.set(data.position.get())
    })
    const Move = Game.System("Pages/Move", {
      queries: { positions: Game.Query({ selection: { position: Game.Query.write(Position) } }) }
    }, ({ queries }) => {
      for (const { data } of queries.positions.each()) data.position.set({ x: data.position.get().x })
    })
    const Watch = Game.System("Pages/WatchPosition", {
      queries: { changed: Game.Query({ selection: { position: Game.Query.read(Position) }, filters: [Game.Query.changed(Position)] }) }
    }, ({ queries }) => {
      seen.push(queries.changed.each().length)
    })
    runtime.tick(Game.Schedule(Spawn, Game.Schedule.applyDeferred(), Watch))
    runtime.tick(Game.Schedule(Rewrite, Watch))
    runtime.tick(Game.Schedule(Move, Watch))
    expect(seen).toEqual([1, 0, 1])
  })

  it("serves entities spawned into a page that emptied out", () => {
    const runtime = makeRuntime()
    const ids: Array<Id> = []
    const Clear = Game.System("Pages/Clear", {
      queries: { all: Healths },
      commands: Game.System.commands(Game.System.despawns(Health))
    }, ({ queries, commands }) => {
      for (const match of queries.all.each()) commands.despawn(match.entity)
    })
    runtime.tick(Game.Schedule(spawner(3, ids), Game.Schedule.applyDeferred()))
    runtime.tick(Game.Schedule(Clear, Game.Schedule.applyDeferred()))
    // The next ids land on the same page, which let go of its storage.
    runtime.tick(Game.Schedule(spawner(2, ids), Game.Schedule.applyDeferred()))
    const Double = Game.System("Pages/Double", { queries: { all: Healths } }, ({ queries }) => {
      for (const { data } of queries.all.each()) data.health.set(data.health.get() * 2 + 1)
    })
    runtime.tick(Game.Schedule(Double))
    expect(ids[3]! >> 8).toBe(ids[0]! >> 8)
    expect(runtime.inspect(AllHealth)).toEqual([1, 3])
  })
})

describe("a query match from an earlier run", () => {
  it("throws when used again, even while its entity still matches", () => {
    const runtime = makeRuntime()
    runtime.tick(Game.Schedule(spawner(1), Game.Schedule.applyDeferred()))
    const outcomes: Array<string> = []
    const Aim = Game.System("Pages/Aim", {
      queries: { all: Healths },
      local: () => ({ target: undefined as undefined | { readonly data: { readonly health: { get(): number } } } })
    }, ({ queries, local }) => {
      local.target ??= queries.all.each()[0]
      try {
        outcomes.push(String(local.target!.data.health.get()))
      } catch (error) {
        outcomes.push((error as Error).message)
      }
    })
    runtime.tick(Game.Schedule(Aim))
    runtime.tick(Game.Schedule(Aim))
    expect(outcomes).toEqual([
      "0",
      "Pages/Health was used through a query match from an earlier run: a match is valid during the system run that produced it; keep the entity id or a handle and resolve it again with queries.x.get(id) or queries.x.getHandle(handle)"
    ])
  })

  it("throws when written after an inspector returned it", () => {
    const runtime = makeRuntime()
    runtime.tick(Game.Schedule(spawner(1), Game.Schedule.applyDeferred()))
    const Leak = Game.Inspector("Pages/Leak", {
      queries: { all: Game.Query({ selection: { health: Game.Query.read(Health) } }) }
    }, ({ queries }) => queries.all.each()[0]!)
    const leaked = runtime.inspect(Leak)
    expect(() => leaked.data.health.get()).toThrow("Pages/Health was used through a query match from an earlier run")
  })

  it("is still valid when the same system resolves it again", () => {
    const runtime = makeRuntime()
    const ids: Array<Id> = []
    runtime.tick(Game.Schedule(spawner(1, ids), Game.Schedule.applyDeferred()))
    const values: Array<number> = []
    const Follow = Game.System("Pages/Follow", {
      queries: { all: Healths },
      local: () => ({ target: undefined as Id | undefined })
    }, ({ queries, local }) => {
      local.target ??= ids[0]
      const found = queries.all.get(local.target!)
      if (found.ok) {
        values.push(found.value.data.health.get())
        found.value.data.health.set(found.value.data.health.get() + 1)
      }
    })
    runtime.tick(Game.Schedule(Follow))
    runtime.tick(Game.Schedule(Follow))
    expect(values).toEqual([0, 1])
  })
})

describe("runtime.inspect", () => {
  it("throws while a schedule is running", () => {
    const runtime = makeRuntime()
    let message = ""
    const Nested = Game.System("Pages/Nested", {}, () => {
      try {
        runtime.inspect(AllHealth)
      } catch (error) {
        message = (error as Error).message
      }
    })
    runtime.tick(Game.Schedule(Nested))
    expect(message).toBe("runtime.inspect(Pages/AllHealth) was called while a schedule is running: read the world from a system, or inspect between ticks")
  })
})
