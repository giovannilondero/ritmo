import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

import { docsUrl, globalMember } from "../internal/ast.ts"

/** The Math functions engines may approximate; each has an `Ops` counterpart. */
const approximated = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "exp", "expm1", "log", "log2", "log10", "log1p", "cbrt", "pow", "hypot",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh"
])

/** The local name `Ops` is imported under in this file, if it is. */
const opsBinding = (program: ESTree.Program): string | undefined => {
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue
    const source = statement.source.value
    for (const specifier of statement.specifiers) {
      if (source === "@typeonce/ritmo-math" && specifier.type === "ImportSpecifier" && specifier.importKind !== "type" &&
        specifier.imported.type === "Identifier" && specifier.imported.name === "Ops") return specifier.local.name
      if ((source === "@typeonce/ritmo-math/Ops" || /(^|\/)Ops(\.ts)?$/.test(source)) && specifier.type === "ImportNamespaceSpecifier") {
        return specifier.local.name
      }
    }
  }
  return undefined
}

/**
 * Simulation code uses `Ops` from `@typeonce/ritmo-math` for the math
 * functions engines may approximate, so every device computes the same bits.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Use Ops from @typeonce/ritmo-math instead of the Math functions and `**` that differ across engines.",
      url: docsUrl("use-ops-for-math")
    },
    fixable: "code",
    messages: {
      math:
        "Math.{{name}} may return a different last bit on another browser or CPU, and the simulation grows that bit into a different run. Use `Ops.{{name}}` from `@typeonce/ritmo-math` (`import { Ops } from \"@typeonce/ritmo-math\"`), which returns the same bits everywhere. Math.sqrt, abs, min, max, floor, ceil, round, trunc, and sign are exact everywhere and stay as they are.",
      power:
        "`{{operator}}` may return a different last bit on another browser or CPU, and the simulation grows that bit into a different run. Use `Ops.pow(base, exponent)` from `@typeonce/ritmo-math` (`import { Ops } from \"@typeonce/ritmo-math\"`). Squaring stays as it is: `x ** 2` and `x * x` are exact everywhere."
    },
    schema: []
  },
  create(context) {
    let ops: string | undefined
    return {
      Program(node) {
        ops = opsBinding(node)
      },
      MemberExpression(node) {
        const name = globalMember(context, node, "Math")
        if (name === undefined || !approximated.has(name)) return
        const local = ops
        context.report({
          node,
          messageId: "math",
          data: { name },
          ...(local === undefined ? {} : { fix: (fixer) => fixer.replaceText(node, `${local}.${name}`) })
        })
      },
      BinaryExpression(node) {
        if (node.operator !== "**") return
        if (node.right.type === "Literal" && node.right.value === 2) return
        const local = ops
        const text = context.sourceCode
        context.report({
          node,
          messageId: "power",
          data: { operator: "a ** b" },
          ...(local === undefined
            ? {}
            : { fix: (fixer) => fixer.replaceText(node, `${local}.pow(${text.getText(node.left)}, ${text.getText(node.right)})`) })
        })
      },
      AssignmentExpression(node) {
        if (node.operator !== "**=") return
        if (node.right.type === "Literal" && node.right.value === 2) return
        context.report({ node, messageId: "power", data: { operator: "a **= b" } })
      }
    }
  }
})
