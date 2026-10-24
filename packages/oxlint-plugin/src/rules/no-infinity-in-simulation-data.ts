import { defineRule } from "@oxlint/plugins"
import type { Context, ESTree } from "@oxlint/plugins"

import { docsUrl, globalMember, isGlobalIdentifier } from "../internal/ast.ts"

/** Whether `node` is Infinity, -Infinity, NaN, or Number's names for them. */
const nonFinite = (context: Context, node: ESTree.Node): boolean => {
  if (node.type === "UnaryExpression" && (node.operator === "-" || node.operator === "+")) return nonFinite(context, node.argument)
  if (isGlobalIdentifier(context, node, "Infinity") || isGlobalIdentifier(context, node, "NaN")) return true
  if (node.type === "MemberExpression") {
    const name = globalMember(context, node, "Number")
    return name === "POSITIVE_INFINITY" || name === "NEGATIVE_INFINITY" || name === "NaN"
  }
  return false
}

/**
 * Simulation data stays finite: Infinity and NaN cannot be saved, so a world
 * holding them no longer loads.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "No Infinity or NaN in simulation data: they cannot be saved and loaded.",
      url: docsUrl("no-infinity-in-simulation-data")
    },
    messages: {
      nonFinite:
        "`{{key}}: {{value}}` cannot be saved: JSON turns it into null and a number schema rejects it, so the save no longer loads (and devtools warns `non-finite-value`). Use `null` for \"never\" or \"no limit\": type the field `number | null` and give it a nullable number schema. For a value that only some entities have (a timer on a non-permanent pool), make that part optional: `timer: { remaining: number; duration: number } | null`."
    },
    schema: []
  },
  create(context) {
    return {
      Property(node) {
        if (node.kind !== "init" || !nonFinite(context, node.value)) return
        context.report({
          node,
          messageId: "nonFinite",
          data: { key: context.sourceCode.getText(node.key), value: context.sourceCode.getText(node.value) }
        })
      }
    }
  }
})
