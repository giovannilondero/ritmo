/**
 * Builds relation pairs for `Descriptor.Hierarchy` and `Descriptor.Relation`,
 * the one public way to define a relation.
 */
import type { PairBrand, RelatedDefinition, RelationDefinition, RelationKind } from "../Relation.ts"

const relationTypeId = "~ritmo/Relation"

export const makePair = <
  const Name extends string,
  const RelatedName extends string,
  const Kind extends RelationKind
>(
  kind: Kind,
  name: Name,
  relatedName: RelatedName
): {
  readonly relation: RelationDefinition<Name, RelatedName, Kind, PairBrand<Name, RelatedName, Kind>>
  readonly related: RelatedDefinition<RelatedName, Name, Kind, PairBrand<Name, RelatedName, Kind>>
} => {
  type Pair = PairBrand<Name, RelatedName, Kind>
  const related = {
    kind: "related",
    relatedName,
    relationName: name,
    key: Symbol.for(`ritmo/related/${name}`),
    relationKind: kind,
    [relationTypeId]: {
      _Pair: (_: never) => undefined as unknown as Pair
    }
  } as RelatedDefinition<RelatedName, Name, Kind, Pair>

  const relation = {
    kind: "relation",
    name,
    relatedName,
    key: Symbol.for(`ritmo/relation/${name}`),
    relationKind: kind,
    linkedDespawn: kind === "hierarchy",
    allowSelf: false,
    ordered: kind === "hierarchy",
    related,
    [relationTypeId]: {
      _Pair: (_: never) => undefined as unknown as Pair
    }
  } as RelationDefinition<Name, RelatedName, Kind, Pair>

  return {
    relation,
    related
  }
}
