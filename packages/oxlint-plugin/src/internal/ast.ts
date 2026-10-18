import type { Context, ESTree } from "@oxlint/plugins"

/** The README section of a rule, linked from every report. */
export const docsUrl = (rule: string): string =>
  `https://github.com/typeonce-dev/ritmo/blob/main/packages/oxlint-plugin/README.md#ritmo${rule}`

/** The name a member expression reads (`a.b` or `a["b"]`), if it is static. */
export const propertyName = (node: ESTree.MemberExpression): string | undefined => {
  if (!node.computed && node.property.type === "Identifier") return node.property.name
  if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string") return node.property.value
  return undefined
}

/**
 * Whether `node` reads a global: a reference that no declaration in the file
 * resolves (or that resolves only to a configured global). Property keys,
 * declarations, and locals that shadow a global are not.
 *
 * (`sourceCode.isGlobalReference` only counts globals declared in the lint
 * environment, so rules using it would depend on each game's `env` setting.)
 */
export const isGlobalReference = (context: Context, node: ESTree.Node): boolean => {
  if (node.type !== "Identifier") return false
  const reference = context.sourceCode.getScope(node).references.find((candidate) => candidate.identifier === node)
  return reference !== undefined && (reference.resolved === null || reference.resolved.defs.length === 0)
}

/**
 * The property `node` reads from the global `object` (`Math.random`,
 * `Math["random"]`), or `undefined` when it reads something else or `object`
 * is a local binding that shadows the global.
 */
export const globalMember = (context: Context, node: ESTree.MemberExpression, object: string): string | undefined => {
  if (node.object.type !== "Identifier" || node.object.name !== object) return undefined
  if (!isGlobalReference(context, node.object)) return undefined
  return propertyName(node)
}

/** Whether `node` names the global `name` (not a local binding, property key, or type). */
export const isGlobalIdentifier = (context: Context, node: ESTree.Node, name: string): boolean =>
  node.type === "Identifier" && node.name === name && isGlobalReference(context, node)

/** The method name a call invokes (`x.tick(...)` gives `tick`). */
export const calledMethod = (node: ESTree.CallExpression): string | undefined =>
  node.callee.type === "MemberExpression" ? propertyName(node.callee) : undefined

/** The last name in a receiver chain (`runtime`, `t.runtime`, `this.runtime` all give `runtime`). */
export const receiverName = (node: ESTree.Node): string | undefined => {
  if (node.type === "Identifier") return node.name
  if (node.type === "MemberExpression") return propertyName(node)
  return undefined
}

/** Whether an import (or re-export) brings in only types, which never run. */
export const importsOnlyTypes = (node: ESTree.ImportDeclaration): boolean =>
  node.importKind === "type" ||
  (node.specifiers.length > 0 &&
    node.specifiers.every((specifier) => specifier.type === "ImportSpecifier" && specifier.importKind === "type"))

/** A string literal's value. */
export const stringValue = (node: ESTree.Node | undefined): string | undefined =>
  node !== undefined && node.type === "Literal" && typeof node.value === "string" ? node.value : undefined
