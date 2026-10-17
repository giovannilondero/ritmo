# Fix plan: 0.8.0 review findings

Twenty-five findings from a full review of the library against its promises
(CLAUDE.md layers: compile time, runtime inspection, lock-in) and against the
two games that use it (inkline-town, spirit-call). Every finding was confirmed
with a compiled type probe or a running test before it went on this list.

This plan is ordered so that each step can be verified on its own, nothing
later undoes something earlier, and the games compile at every merge.

## Rules for every step

1. **Lock-in first.** Write the failing test before the fix: a TSTyche case in
   `packages/<pkg>/dtslint/` for a type hole, a vitest case in
   `packages/<pkg>/test/` for a runtime bug. Run it red, then fix, then green.
   A type test for a rejection states the expected message fragment
   (`// @ts-expect-error <fragment>`), never a bare `@ts-expect-error!`.
2. **Pair every rejection with an acceptance.** When a step makes the compiler
   reject something, the same test file shows the nearest correct call still
   compiling, so a fix cannot over-reject.
3. **Verify per step**: `pnpm check` (typecheck, type tests, tests). Steps
   that touch public types or runtime internals also run `pnpm bench:check`
   (record with `pnpm bench:update` only when the move is intended and say so
   in the commit). Steps that touch exports or package.json also run
   `pnpm pack:check`.
4. **Verify against the games at the end of each phase**: in each game run
   `pnpm engine:prepare` with `ritmoSource` pointed at the phase's last
   commit, then `pnpm install --frozen-lockfile` and `pnpm check`. A game that
   stops compiling is either a game fix (expected, listed below) or an
   over-rejection (a bug in the step; fix the step).
5. **One changeset per phase** (`pnpm changeset`). Phases A and D are a
   patch; phases B and C are a minor with migration notes appended to
   MIGRATION.md under "Upgrading to 0.9.0". No deprecated aliases, no
   compatibility shims.
6. **Commit per step** with a message that names the finding number and the
   promise it restores. One PR per phase.

## Phase A: runtime fixes, no API change (patch)

Independent of each other; any order. Each is a contained change plus a test.

| # | Finding | Where | Test to write | Fix |
|---|---------|-------|---------------|-----|
| 12 | Failing `onEnter` leaves a sub-state inactive | `Runtime.ts` ~1900 `applyStateTransitions` | lifecycle test: parent enters, `onEnter` fails once, next tick the sub-state is in its entry value and `set` succeeds | call `enterSubStates` before running the parent's `onEnter` schedules; on `onEnter` failure the sub-state is already entered. Confirm `despawnOnEnter` of nested sub-states fires. Document the order in the `within` JSDoc. |
| 15 | Pending transition dropped when a transition schedule sets the same machine | `Runtime.ts` ~1836 | scheduling test: normal system queues `Other=B`, an `onEnter` of an earlier machine also sets `Other`; after the marker `Other` is committed and one event is published | mark entries discarded by a parent explicitly (`discarded` flag) and only skip those; a replaced request commits the latest pending value at this marker |
| 16 | `restore`/`snapshot` run mid-tick | `Runtime.ts` ~2240, ~2299 | test: a service calling `runtime.restore` / `runtime.snapshot` from inside a system throws the same shape of error as `send` | add `if (ticking) throw new Error(...)` to both, message naming the fix ("restore outside the tick") |
| 17 | `restore` accepts an unknown scope name | `Runtime.ts` ~2345 | snapshot test: `scopes: { Nope: [1] }` fails with `UnknownScope` | look up `scopeDefinitions`; add `UnknownScope` to `Snapshot.RestoreError` |
| 23 | Host-sent events survive `restore` | `internal/streams.ts` `clear()` | events test: `send` then `restore` then tick: the reader sees nothing | drop them in `clear()` (the doc says events are dropped). If keeping them is wanted instead, change the Snapshot doc and make the test assert that. Decide at the step; default: drop. |
| 21 | Lints ignore reads inside `anyOf` | `internal/debug.ts` ~331 and `accessesOf` | debug test: a component read only through `anyOf` is not `component-never-read`, and `read-before-write` sees it | index `query.anyOf[*].added/changed` as reads in both places |
| 22 | `Schedule.when` copies duplicate `describe().systems` | `internal/debug.ts` ~296 | debug test: a system placed directly and under `when` is one entry with two placements | key placements by `ordering.key` |
| 13 | Touching circle tunnels | `math/src/Collide2.ts` sweep `t1 > enter`, `pushOut` `>=` | math test: circle at `wall + radius` moving in is blocked; same from `wall + radius + 1e-3`; a circle moving away is not blocked; a circle sliding along the face is not blocked | entry at exactly 0 counts as a contact; `pushOut` applies the skin at `<=`. Run the math bench before and after (`pnpm bench --filter Collide2`). |
| 14 | Replay with idle input unplayable | `devtools/src/Replay.ts` `takePoint` and the services diff | replay test: input constant for longer than `keep`, save, `Replay.session(...).play()` completes | when trimming, write the current `previous` values into the first kept tick (full `services` record at every snapshot point) |
| 18 | Throwing invariant escapes `Session.run` | `devtools/src/Session.ts` ~549 | devtools test: an invariant that throws gives a `Rendered` run with `stop.reason === "defect"` | wrap the inspector call in the tick's try/catch |

Phase gate: `pnpm check`, `pnpm bench:check`, both games green with
`ritmoSource` on the phase's last commit. No game change expected.

## Phase B: tighter types that reject only wrong code (minor)

Each step rejects a call that was always wrong; correct code keeps compiling.
Order matters only for 1 and 5, which share `Command.ts` helpers.

| # | Finding | Where | Test to write | Fix |
|---|---------|-------|---------------|-----|
| 1 | Union of entity targets passes `despawn`/`insert`/`remove` | `Command.ts` `DespawnAllowed`, `TargetHolds`, `TargetLacks`, `RemoveTargetAllowed` | CommandPermissions.tst: `cond ? a.entity : b.entity` rejected for each of the three commands when one side lacks the proof; `ref \| id` rejected; a union where both sides prove it accepted | compute the verdict per member as a non-`unknown` token and require `[Verdict] extends [Pass]` over the whole union; `TargetHolds` intersects member proofs (`UnionToIntersection`), `TargetLacks` likewise. Also add a runtime guard in `despawn` apply for a raw number (defence in depth, traced as an effect). |
| 5 | Spread-array drafts and inserts skip requirements | `Command.ts` `HeldNames`, `InsertRequirementsMet` | Requires.tst: `spawn(...entries)` with a widened array of a requirer rejected; `insert(rawId, ...entries)` likewise; a widened array whose members require nothing accepted | for widened arrays treat every possibly-present component as a possible requirer checked against what is certainly held (reuse the conditional-entry rule); `insert` counts only certainly-present entries as "inserted alongside" |
| 3 | `thisTick` static check ignores `anyOf` | `Schedule.ts` `QueryReadOf` | ThisTickQueries.tst: writer before an `anyOf` reader with no `applyDeferred()` rejected with the same message as a plain filter | expand `anyOf` members in `DescriptorsOf` |
| 6 | Unknown resource key beside a valid one | `Runtime.ts` `make` signature | Runtime.tst: `resources: { Score: 0, Scroe: 5 }` rejected naming `Scroe`; a valid literal still accepted; a widened record type still accepted | exact-key check on the `resources` parameter with a `Fix<...>` message |
| 9 | Contradictory or unanchored queries | `Schema.ts` bound `Query` | QueryAnyOf.tst or a new Query.tst: `with`+`without` of one component rejected; `read`+`without` rejected; `filters: [added(Tag)]` with `Tag` unselected rejected ("add Tag to with: [...]") | validation type on the spec; the filter rule is "every filter component is in the selection or `with`". Check both games for an unselected filter component before choosing this over "add it to the proof". |
| 10 | Bundle on an unprovided machine compiles | `Schema.ts` `BoundTransitionScheduleResult` | Runtime.tst: `applyStateTransitions(transitions(onEnter(Other, ...)))` on a runtime without `Other` rejected with "Missing machine" | add the machine requirement to the bundle's requirement set |
| 2 | Wrong-kind descriptor in a registry | `Schema.ts` `Registry`, `fragment`, `bind` | Schema.tst: `components: { Score }` rejected on the `Score` key; `events: { Position }` likewise | `ComponentRegistry`, `ResourceRegistry`, `EventRegistry` with kind-narrowed `Descriptor` types; `Registry` stays only if something still needs the union. Check `bench:check`: this touches every schema type. |
| 8 | Draft relations need no `relates` | `Entity.ts` `EntityDraft`, `Command.ts` `relate`, `CommandsApi.spawn` | CommandPermissions.tst: `spawn(Command.relate(draft, ChildOf, p))` rejected without `relates(ChildOf)`, accepted with it | carry relations in the draft type; `spawn` checks them against `relates`. **Game change**: inkline-town declares `relates(...)` at four sites (`src/sim/logistics.ts`, `hazards.ts`, `work.ts`, `walkers.ts`). Update MIGRATION.md. |

Phase gate: `pnpm check`, `pnpm bench:check` (expect type-checker metrics to
move on 1, 2, 5; record with `bench:update` and say so), both games green
after the inkline-town `relates` edits. Add the four inkline edits to the
game in the same PR cycle so the pin can move.

## Phase C: API decisions (minor, needs one answer each before starting)

These change what correct code looks like. Each has a default; the human
confirms or picks the alternative, then the step runs like Phase B.

| # | Finding | Default | Alternative | Test |
|---|---------|---------|-------------|------|
| 7 | `Runtime.make` has two return shapes and lies for widened types | always return a `Result` (both games already unwrap one); delete the bare branch and `MakeRuntimeResult`'s conditional | keep two shapes but decide from values at the type level (not possible soundly); not recommended | Runtime.tst: `make(...)` is a `Result` with and without constructed resources; runtime test for `{ Score?: number }` |
| 4 | Duplicate system names silence the `thisTick` check | throw at `Game.System(name, ...)` when the name exists for this game ("Duplicate system name"), like scopes and machines; keep the static check by name | type-level uniqueness (would need every system in the schedule tuple; heavy) | Identity.tst keeps the existing case that two names may coexist only if that case is removed; new runtime test for the throw; ThisTick.tst for the same-name writer now impossible |
| 20 | Several writers of one machine, last wins silently | new lint `next-state-conflict` (warning: "Flow was queued by Lose and Win in one tick; the last value wins") on the debug runtime, plus a sentence in `set`'s JSDoc | `set` returns a `Result` failing with `AlreadyQueued { by, value }` for a different value (breaks spirit-call's four `Flow` writers, which rely on last-wins by hand) | debug test for the lint; spirit-call stays as is under the default |
| 19 | Held `QueryMatch` leaks the `absent` sentinel | cells check `record.alive` and the slot, and throw a named error ("match from a previous run; resolve the entity again with queries.x.get(id)") | invalidate every cell at the end of the system's run (one flag per run, checked on every `get`: measure with the core bench) | query-lookup test: holding a match across a despawn throws the named error; bench unchanged within noise |
| 11 | Look-alike descriptor adds behaviour | at system construction resolve each query's descriptor through the schema registry by `(kind, name)` and throw when the caller's descriptor differs in kind, `immutable`, constructor, or entity-state table ("Mode is a plain component in this schema; the descriptor passed is an EntityState") | nominal identity by object (larger: changes every `extends ComponentDescriptor<S>` check; defer) | Identity.tst keeps structural acceptance where the shapes agree; new runtime test for the throw |
| 24 | `Vector2` arithmetic brands overflow as `Finite` | document: validated operations keep the brand for finite inputs within range; overflow is the caller's responsibility, hot paths use unbranded `Vec2` | return `Result` from `add`/`scale`/`lengthSquared` (no game uses them; cheap to change) | math test either way |

Phase gate as Phase B, plus MIGRATION.md entries for 7 and 4 (and 20/24 if
the alternative is chosen).

## Phase D: one-way cleanup and docs (patch, last)

Pure deletions and doc fixes; do them last so earlier diffs stay small.

- Delete `Debug.MemberFor` (`Debug.ts` ~634).
- Delete `Descriptor.Hierarchy` / `Descriptor.Relation` or `Relation.Hierarchy` / `Relation.Relation` (keep the `Descriptor.*` spelling: both games use it); update examples and READMEs.
- Delete `Schema.empty()` (unused; `Schema.fragment({})` is the one way).
- `Game.System.spawns()` with no component: require at least one (type error naming the fix).
- Reject the same resource or event declared twice in one spec (`readResource` + `writeResource` + `changedResource` of one descriptor); the write view already reads.
- `EntityState`: keep `transition` only, or document when `set` is the right call. Default: keep both but make `set` the documented escape hatch with a JSDoc line; revisit if it causes a real bug.
- JSDoc fixes: `spawn` cites a non-existent `insert(...)` builder; `entryRaw` says it feeds `insert`; `Schedule.when` says whether a bundle's systems are gated (they are not); `Clock.every` on step 0; CLAUDE.md "keeps two ticks" versus the actual mark-based change detection; `set` on `nextMachines` says last wins (if Phase C keeps it); Snapshot doc on `send` events (per Phase A step 23).
- Add `OptionalReadCell.value()` returning `T | undefined` (inkline's `maybe` at 99 call sites, spirit-call inline 9 times). Type test plus one runtime test.

Phase gate: `pnpm check`, `pnpm pack:check` (exports change), both games
green after replacing `maybe(cell)` with `cell.value()` in inkline-town.

## Not in this plan (recorded, not scheduled)

- `Random` resource and system glue like `Clock.resource` / `Clock.system`: both games repeat it with two different resource shapes. A design step, not a fix.
- An `Entity.id(handle)` accessor or documented comparability of handles (spirit-call stores `{ handle, id }` pairs).
- A snapshot migration hook (inkline edits raw JSON).
- A lint for readers that never check `lagged()`.
- Structural descriptor identity in general (Phase C step 11 closes the behaviour hole without changing identity).

## Done when

- Every finding above has a test that was red before its fix and is green after.
- `pnpm check`, `pnpm bench:check`, and `pnpm pack:check` pass on `main` after the last phase.
- inkline-town and spirit-call pass `pnpm check` with `ritmoSource` on the final commit, with only the listed game edits (inkline `relates` at four sites, `maybe` replaced).
- MIGRATION.md has an "Upgrading to 0.9.0" section covering 7, 4, 8, and Phase D removals.
- This file is deleted in the last PR.
