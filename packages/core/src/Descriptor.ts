/**
 * Nominal descriptor constructors for schema authoring.
 *
 * Descriptors are the stable typed identities behind every public ECS surface:
 * schema entries, query slots, system specs, runtime provisioning, long-lived
 * handle intents, and relationships.
 *
 * If `Schema` answers "what world can exist?", descriptors answer "what is
 * each named thing in that world?" They are the vocabulary the rest of the
 * ECS system reuses everywhere else.
 *
 * The normal authoring flow is:
 *
 * 1. declare descriptors with `Descriptor.*`
 * 2. register them in `Schema.fragment(...)`
 * 3. bind one `Game` with `Schema.bind(...)`
 *
 * Reach for this module first whenever you introduce a new component,
 * resource, event, or service to the game. A game-wide mode whose transitions
 * matter is a state machine (`Game.StateMachine(...)`); a state each entity
 * has on its own is a component (`Descriptor.EntityState(...)`).
 *
 * Identity is `(kind, name)`: names are unique per kind across everything
 * bound with `Schema.bind`, and a clash between fragments is rejected there.
 * Prefix every name with the game or package (`"Game/Position"`), as the
 * `ritmo/prefix-descriptor-and-system-names` lint rule requires.
 *
 * @module Descriptor
 * @docGroup core
 *
 * @groupDescription Namespaces
 * Grouped descriptor helper types for narrowing and reflecting descriptor metadata.
 *
 * @groupDescription Interfaces
 * Public descriptor contracts and constructor-aware descriptor variants.
 *
 * @groupDescription Type Aliases
 * Shared descriptor identities and helper types used throughout the ECS surface.
 *
 * @groupDescription Variables
 * Stable runtime markers used to brand descriptor kinds and constructor-aware variants.
 *
 * @groupDescription Functions
 * Authoring helpers for declaring components, resources, services, and events.
 *
 * @example
 * ```ts
 * // Components describe per-entity state that queries can match.
 * const Position = Descriptor.Component<{ x: number; y: number }>()("Game/Position")
 *
 * // Resources describe singleton world data shared across systems.
 * const DeltaTime = Descriptor.Resource<number>()("Game/DeltaTime")
 *
 * // Events describe messages between systems, read once per reader.
 * const DamageTaken = Descriptor.Event<{ amount: number }>()("Game/DamageTaken")
 *
 * // Services describe host capabilities that live outside ECS storage.
 * const Logger = Descriptor.Service<{ log: (message: string) => void }>()("Game/Logger")
 * ```
 */
export type DescriptorTypeId = "~ritmo/Descriptor"
export type DescriptorConstructionTypeId = "~ritmo/DescriptorConstruction"
export type DescriptorDecodeTypeId = "~ritmo/DescriptorDecode"

/**
 * Runtime value for the descriptor type id.
 */
const descriptorTypeId: DescriptorTypeId = "~ritmo/Descriptor"
const descriptorConstructionTypeId: DescriptorConstructionTypeId = "~ritmo/DescriptorConstruction"
const descriptorDecodeTypeId: DescriptorDecodeTypeId = "~ritmo/DescriptorDecode"
const descriptorConstruction = Symbol("ritmo/DescriptorConstruction")

/**
 * The public categories of nominal descriptors used by the engine.
 *
 * Descriptors are the strongly typed identities behind components, resources,
 * events, and dependency-injected services.
 */
export type DescriptorKind = "component" | "resource" | "event" | "service"

/**
 * A branded identity for a schema item.
 *
 * Use descriptors instead of strings anywhere data is registered or accessed.
 * They are the foundation for schema typing, query typing, and system specs.
 */
export interface Descriptor<
  out Kind extends DescriptorKind,
  out Name extends string,
  in out Value
> {
  readonly kind: Kind
  readonly name: Name
  readonly key: symbol
  readonly [descriptorTypeId]: {
    readonly _Value: (_: Value) => Value
  }
}

/**
 * Minimal constructor contract carried by constructed descriptors.
 */
export interface ResultConstructor<Value, Raw, Error> {
  readonly result: (raw: Raw) => import("./Result.ts").Result<Value, Error>
}

/**
 * Validates input of any shape, such as values read back from a save file.
 *
 * Constructors whose `result` takes a specific raw shape (for example
 * `Vector2.result({ x, y })`) also export `decode` so snapshots can load
 * them safely. `@typeonce/ritmo-math` modules do.
 */
export interface Decoder<Value> {
  readonly decode: (raw: unknown) => import("./Result.ts").Result<Value, unknown>
}

/**
 * Descriptor that also carries explicit raw-construction metadata.
 *
 * Outside raw-aware APIs this behaves like a normal descriptor. The extra
 * constructor information is only used when a public entrypoint explicitly
 * opts into raw validation.
 */
export interface ConstructedDescriptor<
  out Kind extends DescriptorKind,
  out Name extends string,
  in out Value,
  Raw,
  Error
> extends Descriptor<Kind, Name, Value> {
  readonly [descriptorConstruction]: ResultConstructor<Value, Raw, Error>
  readonly [descriptorConstructionTypeId]: {
    readonly _Raw: (_: never) => Raw
    readonly _Error: (_: never) => Error
  }
}

/**
 * Constructed descriptor whose constructor also exports `decode`, so snapshots
 * can validate untrusted values for it.
 */
export interface DecodableDescriptor<
  out Kind extends DescriptorKind,
  out Name extends string,
  in out Value,
  Raw,
  Error
> extends ConstructedDescriptor<Kind, Name, Value, Raw, Error> {
  readonly [descriptorDecodeTypeId]: true
}

type ConstructedFor<Kind extends DescriptorKind, Name extends string, Value, Raw, Error, Constructor> =
  Constructor extends Decoder<any>
    ? DecodableDescriptor<Kind, Name, Value, Raw, Error>
    : ConstructedDescriptor<Kind, Name, Value, Raw, Error>

/**
 * Descriptor whose values are runtime-only: snapshots skip it.
 *
 * Use it for state that should not be saved or cannot be serialized, such as
 * per-frame input, caches, or references to host objects. On restore,
 * transient components are absent from restored entities and transient
 * resources keep their current value.
 */
export interface TransientDescriptor<
  out Kind extends "component" | "resource",
  out Name extends string,
  in out Value
> extends Descriptor<Kind, Name, Value> {
  readonly transient: true
}

/**
 * Marks a component that is never edited in place: `Game.Query.write(...)`
 * rejects it, and the only way to change its value is to replace it with
 * `commands.insert(...)` (applied at `applyDeferred()`, seen by
 * `Game.Query.changed(...)`).
 */
export interface Immutable {
  readonly immutable: true
}

/**
 * Options of the component descriptor constructors (`Component`,
 * `ConstructedComponent`, `TransientComponent`).
 */
export interface ComponentOptions {
  /**
   * `true` for data that says what an entity is (a kind, a team, a tile) and
   * is replaced, never edited: queries can only read it, and
   * `commands.insert(...)` replaces it. Leave it out for state that systems
   * update every frame.
   */
  readonly immutable?: true
}

/** The descriptor a component constructor returns for `Options`: `D`, plus `Immutable` when `immutable: true`. */
export type WithComponentOptions<D, Options extends ComponentOptions> =
  Options extends { readonly immutable: true } ? D & Immutable : D

const applyComponentOptions = <D extends object>(descriptor: D, options: ComponentOptions | undefined): D =>
  options?.immutable === true ? { ...descriptor, immutable: true } : descriptor

/**
 * Whether a component descriptor was declared `immutable: true` (readable by
 * queries, replaced only with `commands.insert(...)`).
 */
export const isImmutable = (descriptor: Descriptor.Any): descriptor is Descriptor.Any & Immutable =>
  "immutable" in descriptor && descriptor.immutable === true

/**
 * Type-level helpers for working with descriptors.
 */
export namespace Descriptor {
  /**
   * Any supported descriptor.
   */
  export type Any = Descriptor<DescriptorKind, string, any>
  export type AnyConstructed = ConstructedDescriptor<DescriptorKind, string, any, any, any>
  export type AnyTransient = TransientDescriptor<"component" | "resource", string, any>
  /**
   * Extracts the runtime value associated with a descriptor.
   */
  export type Value<T extends Any> = T extends Descriptor<infer _Kind, infer _Name, infer Value> ? Value : never
  /**
   * Extracts the descriptor name.
   */
  export type Name<T extends Any> = T extends Descriptor<infer _Kind, infer Name, infer _Value> ? Name : never
  export type Raw<T extends Any> = T extends ConstructedDescriptor<infer _Kind, infer _Name, infer _Value, infer Raw, infer _Error>
    ? Raw
    : never
  export type ConstructionError<T extends Any> =
    T extends ConstructedDescriptor<infer _Kind, infer _Name, infer _Value, infer _Raw, infer Error>
      ? Error
      : never
  export type Constructor<T extends Any> =
    T extends ConstructedDescriptor<infer _Kind, infer _Name, infer Value, infer Raw, infer Error>
      ? ResultConstructor<Value, Raw, Error>
      : never
}

/**
 * Internal descriptor constructor shared by all descriptor helpers.
 *
 * The runtime value is intentionally tiny: only category, name, and a stable
 * symbol key are needed.
 */
const makeDescriptor = <Kind extends DescriptorKind, Name extends string, Value>(
  kind: Kind,
  name: Name
): Descriptor<Kind, Name, Value> =>
  ({
    kind,
    name,
    key: Symbol.for(`ritmo/${kind}/${name}`)
  }) as Descriptor<Kind, Name, Value>

const makeTransientDescriptor = <Kind extends "component" | "resource", Name extends string, Value>(
  kind: Kind,
  name: Name
): TransientDescriptor<Kind, Name, Value> =>
  ({
    kind,
    name,
    key: Symbol.for(`ritmo/${kind}/${name}`),
    transient: true
  }) as TransientDescriptor<Kind, Name, Value>

const makeConstructedDescriptor = <
  Kind extends DescriptorKind,
  Name extends string,
  Value,
  Raw,
  Error
>(
  kind: Kind,
  name: Name,
  constructor: ResultConstructor<Value, Raw, Error>
): ConstructedDescriptor<Kind, Name, Value, Raw, Error> =>
  ({
    kind,
    name,
    key: Symbol.for(`ritmo/${kind}/${name}`),
    [descriptorConstruction]: constructor
  }) as ConstructedDescriptor<Kind, Name, Value, Raw, Error>

/**
 * The message naming why `Value` cannot be the value of a descriptor of
 * `Kind`, or `never` when it can. `any` turns off every check on the
 * descriptor's reads and writes, and `never` erases the fragment it is listed in.
 */
type Article<Kind extends string> = Kind extends "event" ? "an" : "a"

type ValueRejection<Kind extends string, Value> = 0 extends 1 & Value
  ? `${Article<Kind>} ${Kind} value cannot be \`any\`: give it a type (use \`unknown\` for a value you never read)`
  : [Value] extends [never] ? `${Article<Kind>} ${Kind} value cannot be \`never\`: give it a type (use \`{}\` for a marker)`
  : never

/** `Make`, or, when `Value` is rejected, a function whose only parameter is the message. */
type CheckedValue<Kind extends string, Value, Make> = [ValueRejection<Kind, Value>] extends [never] ? Make
  : (name: ValueRejection<Kind, Value>) => never

/**
 * Defines a component descriptor.
 *
 * Use this when declaring per-entity data that should participate in queries
 * and typed entity proofs.
 *
 * Components are the only descriptor kind that can be queried directly with
 * `Game.Query.read(...)`, `write(...)`, or `optional(...)`.
 *
 * The value is a real type: `any` and `never` do not compile (here and in
 * every other descriptor constructor). Use `unknown` for a value no system
 * reads, and `Descriptor.Tag` for a marker.
 *
 * @example
 * ```ts
 * const Position = Descriptor.Component<{ x: number; y: number }>()("Game/Position")
 * // What an entity is, replaced with commands.insert and never written by a query:
 * const EnemyKind = Descriptor.Component<"grunt" | "boss">()("Game/EnemyKind", { immutable: true })
 * ```
 */
export const Component = <Value>(): CheckedValue<"component", Value, <const Name extends string, const Options extends ComponentOptions = {}>(
  name: Name,
  options?: Options
) => WithComponentOptions<Descriptor<"component", Name, Value>, Options>> =>
  ((name: string, options?: ComponentOptions) => applyComponentOptions(makeDescriptor("component", name), options)) as never

/**
 * Defines a component descriptor that also knows how to validate raw values.
 *
 * Use this when the component should never exist in the world in an unvalidated
 * shape, for example vectors, sizes, collider bounds, or other branded domain
 * values.
 *
 * @example
 * ```ts
 * // Route raw component input through a constructor once at the boundary.
 * const Position = Descriptor.ConstructedComponent(Vector2)("Game/Position")
 * ```
 */
export const ConstructedComponent = <Value, Raw, Error, Constructor extends {} = {}>(
  constructor: ResultConstructor<Value, Raw, Error> & Constructor
) => <const Name extends string, const Options extends ComponentOptions = {}>(
  name: Name,
  options?: Options
): WithComponentOptions<ConstructedFor<"component", Name, Value, Raw, Error, Constructor>, Options> =>
  applyComponentOptions(makeConstructedDescriptor("component", name, constructor), options) as WithComponentOptions<ConstructedFor<"component", Name, Value, Raw, Error, Constructor>, Options>

/**
 * Defines a component descriptor that snapshots skip.
 *
 * Restored entities come back without it, so systems that need it rebuild it,
 * for example from an `added(...)` query.
 *
 * @example
 * ```ts
 * const SpriteRef = Descriptor.TransientComponent<{ frame: number }>()("Game/SpriteRef")
 * ```
 */
export const TransientComponent = <Value>(): CheckedValue<"component", Value, <const Name extends string, const Options extends ComponentOptions = {}>(
  name: Name,
  options?: Options
) => WithComponentOptions<TransientDescriptor<"component", Name, Value>, Options>> =>
  ((name: string, options?: ComponentOptions) => applyComponentOptions(makeTransientDescriptor("component", name), options)) as never

/**
 * Defines a marker component: no data, only presence (`[Player, {}]`).
 *
 * Tags validate on load like any constructed component, so they never block
 * snapshots.
 *
 * @example
 * ```ts
 * const Player = Descriptor.Tag("Game/Player")
 * const Enemy = Descriptor.Tag("Game/Enemy")
 * ```
 */
export const Tag = <const Name extends string>(
  name: Name
): DecodableDescriptor<"component", Name, {}, {}, DecodeModule.DecodeError> =>
  ConstructedComponent(DecodeModule.struct({}))(name)

/**
 * The fields of one state of a {@link EntityState} component or a
 * `Game.StateMachine(...)`: each field's codec, by name. A state without data
 * has no fields (`{}`).
 */
export type StateFields = Readonly<Record<string, DecodeModule.Codec<any>>>

/** Every state of an entity state or a state machine: each state's fields, by state name. */
export type StateDefinitions = Readonly<Record<string, StateFields>>

/** The name of a state in `States`. */
export type StateName<States extends StateDefinitions> = keyof States & string

/**
 * The value of state `State` (of every state, for a union): its name in
 * `_tag`, and its fields. Use {@link EntityStateOf} or `Machine.StateOf` in
 * game code.
 */
export type StateValueOf<States extends StateDefinitions, State extends StateName<States>> = State extends unknown
  ? { readonly _tag: State } & { readonly [Field in keyof States[State]]: DecodeModule.Type<States[State][Field]> } extends infer Value
    ? { readonly [Key in keyof Value]: Value[Key] }
    : never
  : never

/**
 * The allowed moves of a {@link EntityState} component: for every state, the
 * states it may move to (`[]` for a state with no way out).
 */
export type EntityStateTransitions<States extends StateDefinitions> = {
  readonly [From in keyof States & string]: ReadonlyArray<keyof States & string>
}

/**
 * A component whose value is one of a closed set of states, each with its own
 * data, and an optional graph of allowed moves. Built with {@link EntityState}.
 */
export interface EntityStateDescriptor<
  out Name extends string,
  in out States extends StateDefinitions,
  in out Transitions extends EntityStateTransitions<States> | undefined
> extends DecodableDescriptor<
  "component",
  Name,
  StateValueOf<States, StateName<States>>,
  StateValueOf<States, StateName<States>>,
  DecodeModule.DecodeError
> {
  readonly states: States
  readonly transitions: Transitions
}

/**
 * The value of an entity state component, or of one of its states: what
 * game functions that work on the state take and return.
 *
 * @example
 * ```ts
 * const fall = (air: Descriptor.EntityStateOf<typeof Contact, "air">, gravity: number) => air.vy - gravity
 * const describe = (contact: Descriptor.EntityStateOf<typeof Contact>) => contact._tag
 * ```
 */
export type EntityStateOf<
  D extends EntityStateDescriptor<string, any, any>,
  State extends keyof D["states"] & string = keyof D["states"] & string
> = StateValueOf<D["states"], State>

/**
 * The `states` argument of an entity state or a state machine, or the message
 * naming what is wrong with it: `Empty` is the message for a record without
 * states.
 */
export type CheckedStates<States extends StateDefinitions, Empty extends string> = [StateName<States>] extends [never]
  ? { readonly [Message in Empty]: StateFields }
  : {
    readonly [State in keyof States]: "_tag" extends keyof States[State]
      ? { readonly _tag: "`_tag` holds the state's name: give this field another name" }
      : unknown
  }

/**
 * Defines a per-entity state: a component whose value is one of `states`,
 * each with its own fields, validated (so snapshots reject unknown states and
 * wrong fields), that behaves like any other component (storage, change
 * detection, rollback, traces).
 *
 * Use this when each entity has its own state: an enemy's attack windup, a
 * fighter on the ground or in the air, a unit's AI mode. Give each state the
 * data only it has (an airborne speed, a hitstun length), so a value can
 * never pair a state with data that does not belong to it. Data every state
 * shares stays in another component. Use `Game.StateMachine(...)` instead for
 * one game-wide mode (menu, playing, paused, game over): machines change only
 * at `applyStateTransitions(...)`, run `onEnter`/`onExit` schedules, and gate
 * systems with `Game.Condition.inState(...)`. An entity state does none of
 * that; it is data on an entity. A closed set of values with no moves (a
 * team, a direction) is `Descriptor.ConstructedComponent(Decode.literal(...))`.
 *
 * The value is a tagged union: `_tag` is the state's name, next to that
 * state's fields. Its write cell moves with `transition({ from, to, data })`,
 * which takes all of `to`'s fields so nothing carries over from `from`, and
 * changes the current state's fields with `update({ state, data })`. Both are
 * a compare-and-set: they write only while the entity is still in `from` (or
 * `state`), and otherwise return an `EntityStateMismatch` failure. With
 * `transitions`, `to` is checked against the graph at compile time; the graph
 * lists every state (`[]` for one with no way out). Writes are ordinary
 * component writes: immediate, visible to later systems, rolled back with a
 * failed system. There are no per-state schedules: branch on `get()._tag` in
 * the system that owns the component, and emit an event on a transition
 * other systems must react to.
 *
 * @example
 * ```ts
 * const Contact = Descriptor.EntityState("Game/Contact", {
 *   ground: { platform: Decode.nullable(Decode.integer) },
 *   air: { vy: Decode.number, coyote: Decode.integer }
 * }, { transitions: { ground: ["air"], air: ["ground"] } })
 *
 * commands.spawn(Game.Command.spawn([Contact, { _tag: "ground", platform: null }]))
 * // in a system with a write slot `contact`:
 * data.contact.transition({ from: "ground", to: "air", data: { vy: 12, coyote: 0 } })
 * data.contact.update({ state: "air", data: (air) => ({ ...air, vy: air.vy - gravity }) })
 * ```
 */
export const EntityState = <
  const Name extends string,
  const States extends StateDefinitions,
  const Transitions extends EntityStateTransitions<States> | undefined = undefined
>(
  name: Name,
  states: States & CheckedStates<States, "an entity state needs at least one state">,
  options?: {
    readonly transitions: Transitions & { readonly [Key in Exclude<keyof Transitions, keyof States>]: never }
  }
): EntityStateDescriptor<Name, States, Transitions> => ({
  ...makeConstructedDescriptor("component", name, stateCodec(states)),
  states,
  transitions: options?.transitions
}) as unknown as EntityStateDescriptor<Name, States, Transitions>

/** Whether a descriptor was built with {@link EntityState}. */
export const isEntityState = (
  descriptor: Descriptor.Any
): descriptor is EntityStateDescriptor<string, StateDefinitions, EntityStateTransitions<StateDefinitions> | undefined> =>
  "states" in descriptor

/**
 * Defines a resource descriptor.
 *
 * Resources represent unique world-level values accessed through explicit
 * system specs.
 *
 * Use resources for singleton world data such as counters, configuration,
 * global timers, camera summaries, or transient per-frame aggregates that
 * should not be duplicated across entities.
 *
 * @example
 * ```ts
 * // Store shared world state once and request it explicitly from systems.
 * const Score = Descriptor.Resource<number>()("Game/Score")
 * ```
 */
export const Resource = <Value>(): CheckedValue<"resource", Value, <const Name extends string>(
  name: Name
) => Descriptor<"resource", Name, Value>> => ((name: string) => makeDescriptor("resource", name)) as never

/**
 * Defines a resource descriptor that also knows how to validate raw values.
 */
export const ConstructedResource = <Value, Raw, Error, Constructor extends {} = {}>(
  constructor: ResultConstructor<Value, Raw, Error> & Constructor
) => <const Name extends string>(
  name: Name
): ConstructedFor<"resource", Name, Value, Raw, Error, Constructor> =>
  makeConstructedDescriptor("resource", name, constructor) as ConstructedFor<"resource", Name, Value, Raw, Error, Constructor>

/**
 * Defines a resource descriptor that snapshots skip. Restoring keeps its
 * current value.
 *
 * @example
 * ```ts
 * const DeltaTime = Descriptor.TransientResource<number>()("Game/DeltaTime")
 * ```
 */
export const TransientResource = <Value>(): CheckedValue<"resource", Value, <const Name extends string>(
  name: Name
) => TransientDescriptor<"resource", Name, Value>> => ((name: string) => makeTransientDescriptor("resource", name)) as never

/**
 * Defines an event descriptor.
 *
 * Use event descriptors to model append-only messages flowing between systems
 * without exposing untyped channels.
 *
 * Events are per-reader streams, like change detection: each reading system
 * sees the events published since its own previous run, once, in emission
 * order. A system's events are published when it completes successfully, so
 * later systems in the same schedule see them, and a failed system publishes
 * nothing. Events are kept until every system that reads them has run (see
 * `Game.System.readEvent`).
 *
 * @example
 * ```ts
 * const Hit = Descriptor.Event<{ target: number; amount: number }>()("Game/Hit")
 * ```
 */
export const Event = <Value>(): CheckedValue<"event", Value, <const Name extends string>(
  name: Name
) => Descriptor<"event", Name, Value>> => ((name: string) => makeDescriptor("event", name)) as never

/**
 * Defines a service descriptor.
 *
 * Services are the dependency-injection side of the system model, similar to
 * Effect environment entries.
 *
 * Use them for capabilities owned by the host instead of the ECS world:
 * render/audio bridges, logs, storage, or network clients. Simulation time
 * is `Clock` and randomness is the `Random` resource from
 * `@typeonce/ritmo-math`, not services. Systems request them explicitly with
 * `Game.System.service(...)` (or `Game.System.consumeService(...)` for the
 * one system that drains it), and the runtime provides them through
 * `Game.Runtime.services(...)`. A service's effects (a sound played, a
 * request sent, a value stored) are not rolled back when the system fails.
 *
 * @example
 * ```ts
 * // Describe one host capability the runtime must provide.
 * const Logger = Descriptor.Service<{ log: (message: string) => void }>()("Game/Logger")
 * ```
 */
export const Service = <Value>(): CheckedValue<"service", Value, <const Name extends string>(
  name: Name
) => Descriptor<"service", Name, Value>> => ((name: string) => makeDescriptor("service", name)) as never

/**
 * Checks whether one descriptor is transient (skipped by snapshots).
 */
export const isTransient = (descriptor: Descriptor.Any): descriptor is Descriptor.AnyTransient =>
  "transient" in descriptor && descriptor.transient === true

/**
 * The parts of the Standard Schema v1 interface (https://standardschema.dev)
 * that `fromStandardSchema` reads. ArkType, Effect Schema, Zod, and Valibot
 * schemas all satisfy it.
 */
export interface StandardSchema<Input, Output> {
  readonly "~standard": {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => StandardSchema.Result<Output> | Promise<StandardSchema.Result<Output>>
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

export namespace StandardSchema {
  export type Result<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<Issue> }
  export interface Issue {
    readonly message: string
    readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
  }
}

const asyncValidationIssue: ReadonlyArray<StandardSchema.Issue> = [
  { message: "Asynchronous validation is not supported: descriptor constructors run synchronously" }
]

/**
 * Adapts a Standard Schema validator into a descriptor constructor, so any
 * compliant validation library can guard constructed components and
 * resources. Validation must be synchronous; a schema that returns a promise
 * fails with an issue instead.
 *
 * @example
 * ```ts
 * const Position = Descriptor.ConstructedComponent(
 *   Descriptor.fromStandardSchema(type({ x: "number", y: "number" }))
 * )("Game/Position")
 * ```
 */
export const fromStandardSchema = <Input, Output>(
  schema: StandardSchema<Input, Output>
): ResultConstructor<Output, Input, ReadonlyArray<StandardSchema.Issue>> & Decoder<Output> => {
  const validate = (raw: unknown) => {
    const outcome = schema["~standard"].validate(raw)
    if (outcome instanceof Promise) {
      // Avoid an unhandled rejection from the discarded promise.
      outcome.catch(() => {})
      return ResultModule.failure(asyncValidationIssue)
    }
    return outcome.issues === undefined
      ? ResultModule.success(outcome.value)
      : ResultModule.failure(outcome.issues)
  }
  return { result: validate, decode: validate }
}

/**
 * Returns the function that validates untrusted values for a constructed
 * descriptor: its constructor's `decode` when present, otherwise `result`.
 * The snapshot types only allow the `result` fallback when it accepts
 * `unknown`.
 */
export const decoderOf = (descriptor: Descriptor.AnyConstructed): (raw: unknown) => import("./Result.ts").Result<unknown, unknown> => {
  const constructor = descriptor[descriptorConstruction] as ResultConstructor<unknown, unknown, unknown> & Partial<Decoder<unknown>>
  return typeof constructor.decode === "function" ? constructor.decode : constructor.result
}

/**
 * Checks whether one descriptor carries raw-construction metadata.
 */
export const hasConstructor = (descriptor: Descriptor.Any): descriptor is Descriptor.AnyConstructed =>
  descriptorConstruction in descriptor

/**
 * Returns the raw constructor carried by one descriptor when present.
 *
 * Plain descriptors return `undefined`.
 */
export function constructorOf<D extends Descriptor.AnyConstructed>(
  descriptor: D
): Descriptor.Constructor<D>
export function constructorOf<D extends Descriptor.Any>(
  descriptor: D
): Descriptor.Constructor<D> | undefined
export function constructorOf<D extends Descriptor.Any>(
  descriptor: D
): Descriptor.Constructor<D> | undefined {
  return (hasConstructor(descriptor) ? descriptor[descriptorConstruction] : undefined) as Descriptor.Constructor<D> | undefined
}

/**
 * Defines the canonical parent/children relationship pair.
 *
 * The returned `relation` is the source-of-truth edge component, while
 * `related` is the reverse collection maintained by the runtime.
 *
 * Use hierarchy when the relationship must support ordered children,
 * ancestor/descendant traversal, and linked recursive despawn. Use
 * `Game.EntityScope(...)` instead when entities only share a lifetime (a
 * level, a menu) and need no tree, order, or traversal.
 */
export const Hierarchy = <const Name extends string, const RelatedName extends string>(
  name: Name,
  relatedName: RelatedName
) => makePair("hierarchy", name, relatedName)

/**
 * Defines a general relationship pair with direct edges and reverse lookups.
 *
 * Use a general relation when you need direct source -> target edges plus
 * reverse lookup, but not hierarchy-only behavior such as tree traversal or
 * child reordering.
 */
export const Relation = <const Name extends string, const RelatedName extends string>(
  name: Name,
  relatedName: RelatedName
) => makePair("relation", name, relatedName)
import * as DecodeModule from "./Decode.ts"
import { makePair } from "./internal/relations.ts"
import { stateCodec } from "./internal/states.ts"
import * as ResultModule from "./Result.ts"
