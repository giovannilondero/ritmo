import { Clock, Descriptor, HostClock, Schema } from "@typeonce/ritmo"
import * as Codecs from "../../core/test/codecs.ts"
import type * as Schedule from "@typeonce/ritmo/Schedule"
import type * as Snapshot from "@typeonce/ritmo/Snapshot"
import { Desync, Invariant, Lint, Replay, Rendered, Session } from "@typeonce/ritmo-devtools"
import { describe, expect, it } from "tstyche"

const hostClock = HostClock.test()

const Position = Descriptor.Component<{ readonly x: number }>()("DevtoolsTypes/Position")
const Other = Descriptor.Component<{ readonly y: number }>()("DevtoolsTypes/Other")
const Limit = Descriptor.Resource<number>()("DevtoolsTypes/Limit")
const Request = Descriptor.Event<string>()("DevtoolsTypes/Request")
const Foreign = Descriptor.Event<string>()("DevtoolsTypes/ForeignRequest")
const Game = Schema.bind(Schema.fragment({ components: { Position }, resources: { Limit }, events: { Request } }))
const OtherGame = Schema.bind(Schema.fragment({ components: { Other } }))
const update = Game.Schedule(Game.System("DevtoolsTypes/Noop", {}, () => {}))

describe("Session.make", () => {
  it("requires a runtime made with debug: { hostClock }", () => {
    const plain = Game.Runtime.make({ services: Game.Runtime.services() }).value
    expect(Session.make).type.not.toBeCallableWith(plain, { hostClock, schedules: { update } })
    const debugged = Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value
    expect(Session.make).type.toBeCallableWith(debugged, { hostClock, schedules: { update } })
  })

  it("requires the host clock that times runs", () => {
    const debugged = Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value
    // @ts-expect-error Property 'hostClock' is missing
    Session.make(debugged, { schedules: { update } })
  })

  it("rejects schedules of another schema", () => {
    const debugged = Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value
    const foreign = OtherGame.Schedule(OtherGame.System("DevtoolsTypes/Foreign", {}, () => {}))
    expect(Session.make).type.not.toBeCallableWith(debugged, { hostClock, schedules: { foreign } })
  })

  it("describes but does not run describe-only schedules", () => {
    const render = Game.Schedule(Game.System("DevtoolsTypes/Render", {}, () => {}))
    const session = Session.make(Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value, { hostClock, schedules: { update }, describe: { render } })
    expect(session.run).type.toBeCallableWith("update")
    expect(session.run).type.not.toBeCallableWith("render")
    const foreign = OtherGame.Schedule(OtherGame.System("DevtoolsTypes/ForeignRender", {}, () => {}))
    expect(Session.make).type.not.toBeCallableWith(Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value, { hostClock, schedules: { update }, describe: { foreign } })
  })

  it("rejects a described-only schedule named like a runnable one", () => {
    const render = Game.Schedule(Game.System("DevtoolsTypes/RenderTwice", {}, () => {}))
    const debugged = Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value
    // @ts-expect-error already a runnable schedule in schedules
    Session.make(debugged, { hostClock, schedules: { update }, describe: { update: render } })
    const session = Session.make(debugged, { hostClock, schedules: { update }, describe: { render } })
    expect(session.run).type.toBeCallableWith("update")
  })

  it("runs only named schedules and filters by the runtime's descriptors", () => {
    const session = Session.make(Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value, { hostClock, schedules: { update } })
    expect(session.run).type.toBeCallableWith("update")
    expect(session.run).type.not.toBeCallableWith("updat")
    expect(session.journal).type.toBeCallableWith({ component: Position })
    expect(session.journal).type.not.toBeCallableWith({ component: Other })
    expect(session.why).type.not.toBeCallableWith(1, Other)
  })
})

describe("Invariant.fromInspector", () => {
  const Positions = Game.Query({ selection: { position: Game.Query.read(Position) } })

  it("builds an invariant named after an inspector that returns a message or undefined", () => {
    const inspector = Game.Inspector("DevtoolsTypes/NonNegative", { queries: { positions: Positions } }, ({ queries }) =>
      queries.positions.each().some((match) => match.data.position.get().x < 0) ? "negative x" : undefined)
    const invariant = Invariant.fromInspector(inspector)
    expect(invariant).type.toBe<Invariant.Invariant<typeof inspector>>()
    expect(invariant.name).type.toBe<"DevtoolsTypes/NonNegative">()
  })

  it("rejects inspectors that do not return string | undefined", () => {
    const counts = Game.Inspector("DevtoolsTypes/Count", { queries: { positions: Positions } }, ({ queries }) => queries.positions.each().length)
    expect(Invariant.fromInspector).type.not.toBeCallableWith(counts)
    const message = Game.Inspector("DevtoolsTypes/Message", {}, () => "always" as string | undefined)
    expect(Invariant.fromInspector).type.toBeCallableWith(message)
  })

  it("is checked against the runtime's provisions by Session.make", () => {
    const UnderLimit = Invariant.fromInspector(Game.Inspector("DevtoolsTypes/UnderLimit", {
      queries: { positions: Positions },
      resources: { limit: Game.System.readResource(Limit) }
    }, ({ queries, resources }) =>
      queries.positions.each().some((match) => match.data.position.get().x > resources.limit.get()) ? "over limit" : undefined))

    const provided = Game.Runtime.make({ services: Game.Runtime.services(), resources: { Limit: 10 }, debug: { hostClock } }).value
    Session.make(provided, { hostClock, schedules: { update }, invariants: [UnderLimit] })

    const missing = Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value
    // @ts-expect-error __fixInvariantRequirements__: { readonly __runtimeRequirementError__: "Missing resource"; readonly __requirement__: "DevtoolsTypes/Limit"
    Session.make(missing, { hostClock, schedules: { update }, invariants: [UnderLimit] })
  })

  it("rejects invariants of another game", () => {
    const Foreign = Invariant.fromInspector(OtherGame.Inspector("DevtoolsTypes/Foreign", {}, () => undefined))
    const debugged = Game.Runtime.make({ services: Game.Runtime.services(), debug: { hostClock } }).value
    expect(Session.make).type.not.toBeCallableWith(debugged, { hostClock, schedules: { update }, invariants: [Foreign] })
    expect(Session.make).type.toBeCallableWith(debugged, { hostClock, schedules: { update }, invariants: [Invariant.fromInspector(Game.Inspector("DevtoolsTypes/Own", {}, () => undefined))] })
  })
})

describe("Lint.run", () => {
  it("returns a report and takes host events of the runtime's schema only", () => {
    const runtime = Game.Runtime.make({ services: Game.Runtime.services(), resources: { Limit: 1 }, debug: { hostClock } }).value
    expect(Lint.run({ runtime, schedules: { update }, hostEvents: [Request] }).data).type.toBe<Lint.Report>()
    expect(Lint.run).type.not.toBeCallableWith({ runtime, schedules: { update }, hostEvents: [Foreign] })
    expect(runtime.debug.declareHostEvents).type.not.toBeCallableWith([Foreign])
    expect(runtime.debug.declareHostEvents).type.toBeCallableWith([Request])
  })

  it("requires a runtime made with debug: { hostClock }", () => {
    const plain = Game.Runtime.make({ services: Game.Runtime.services(), resources: { Limit: 1 } }).value
    expect(Lint.run).type.not.toBeCallableWith({ runtime: plain, schedules: { update } })
  })
})

describe("Replay.recorder", () => {
  const Place = Descriptor.ConstructedComponent(Codecs.struct({ x: Codecs.number }))("DevtoolsTypes/Place")
  const Keys = Descriptor.Service<Schedule.Source<{ readonly left: boolean }>>()("DevtoolsTypes/Keys")
  const Rules = Descriptor.Service<{ readonly speed: number; readonly names: ReadonlyArray<string> }>()("DevtoolsTypes/Rules")
  const Page = Descriptor.Service<{ readonly toast: (message: string) => void }>()("DevtoolsTypes/Page")
  const Mapped = Descriptor.Service<Schedule.Source<Map<string, number>>>()("DevtoolsTypes/Mapped")
  const Saved = Schema.bind(Schema.fragment({ components: { Place } }))
  const runtime = Saved.Runtime.make({
    services: Saved.Runtime.services(
      Saved.Runtime.service(Keys, { snapshot: () => ({ left: false }) }),
      Saved.Runtime.service(Rules, { speed: 1, names: [] }),
      Saved.Runtime.service(Page, { toast: () => {} }),
      Saved.Runtime.service(Mapped, { snapshot: () => new Map() })
    ),
    debug: { hostClock }
  }).value
  const base = { name: "update", keep: 10, step: Clock.hz(1), sink: Replay.memorySink(), hostClock }

  it("accepts plain-data sources and plain constants", () => {
    const update = Saved.Schedule(Saved.System("DevtoolsTypes/Plain", {
      services: { keys: Saved.System.service(Keys), rules: Saved.System.service(Rules) }
    }, () => {}))
    expect(Replay.recorder(runtime, { ...base, schedule: update })).type.toBe<Replay.Recorder>()
  })

  it("rejects a service that is neither a plain source nor plain data, naming it", () => {
    const update = Saved.Schedule(Saved.System("DevtoolsTypes/Page", { services: { page: Saved.System.service(Page) } }, () => {}))
    // @ts-expect-error DevtoolsTypes/Page is neither a snapshot() source of plain data nor plain data
    Replay.recorder(runtime, { ...base, schedule: update })
  })

  it("rejects a source whose snapshot is not plain data", () => {
    const update = Saved.Schedule(Saved.System("DevtoolsTypes/Mapped", { services: { mapped: Saved.System.service(Mapped) } }, () => {}))
    // @ts-expect-error DevtoolsTypes/Mapped: its snapshot() returns data that is not plain
    Replay.recorder(runtime, { ...base, schedule: update })
  })

  it("requires a runtime whose world can be saved", () => {
    const Loose = Descriptor.Component<{ readonly x: number }>()("DevtoolsTypes/Loose")
    const Unsaved = Schema.bind(Schema.fragment({ components: { Loose } }))
    const unsaved = Unsaved.Runtime.make({ services: Unsaved.Runtime.services(), debug: { hostClock } }).value
    const update = Unsaved.Schedule(Unsaved.System("DevtoolsTypes/Unsaved", {}, () => {}))
    expect(Replay.recorder).type.not.toBeCallableWith(unsaved, { ...base, schedule: update })
  })

  it("tells plain data from the rest", () => {
    expect<Schedule.IsPlain<{ readonly a: ReadonlyArray<{ readonly b: string | null }> }>>().type.toBe<true>()
    expect<Schedule.IsPlain<{ readonly f: () => void }>>().type.toBe<false>()
    expect<Schedule.IsPlain<Map<string, number>>>().type.toBe<false>()
    expect<Schedule.IsPlain<Set<number>>>().type.toBe<false>()
    interface Upgrade { readonly cost: number; readonly next: Upgrade | null }
    expect<Schedule.IsPlain<{ readonly upgrade: Upgrade }>>().type.toBe<true>()
    interface Broken { readonly next: Broken | null; readonly run: () => void }
    expect<Schedule.IsPlain<Broken>>().type.toBe<false>()
  })
})

describe("Session stops", () => {
  it("include a failed tick result nobody read", () => {
    expect<Extract<Session.Stop, { readonly reason: "ignored-failure" }>["skipped"]>().type.toBe<ReadonlyArray<string>>()
  })
})

describe("Desync.compare", () => {
  it("compares two saves into rendered differences", () => {
    expect(Desync.compare).type.toBe<(mine: Snapshot.WorldSnapshot, theirs: Snapshot.WorldSnapshot) => Rendered.Rendered<ReadonlyArray<Desync.Difference>>>()
    expect(Desync.compare).type.not.toBeCallableWith({ entities: [] }, { entities: [] })
  })
})
