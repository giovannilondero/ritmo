import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

import { calledMethod, docsUrl, isGlobalReference, propertyName } from "../internal/ast.ts"

/**
 * An optional cell is read with `cell.value()`, the one way to get its value
 * or `undefined`.
 */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Read an optional query cell with `cell.value()` instead of `cell.present ? cell.get() : undefined`.",
      url: docsUrl("use-cell-value")
    },
    fixable: "code",
    messages: {
      value:
        "Read this optional cell with `{{cell}}.value()`: it returns the component's value, or `undefined` when the entity does not hold the component. Check `{{cell}}.present` only to branch without reading."
    },
    schema: []
  },
  create(context) {
    const text = (node: ESTree.Node): string => context.sourceCode.getText(node)
    /** The cell `node` reads `.present` of, if it does. */
    const presentOf = (node: ESTree.Node): ESTree.Node | undefined =>
      node.type === "MemberExpression" && propertyName(node) === "present" ? node.object : undefined
    const isGetOf = (node: ESTree.Node, cell: ESTree.Node): boolean =>
      node.type === "CallExpression" && node.arguments.length === 0 && calledMethod(node) === "get" &&
      node.callee.type === "MemberExpression" && text(node.callee.object) === text(cell)
    const isUndefined = (node: ESTree.Node): boolean =>
      (node.type === "Identifier" && node.name === "undefined" && isGlobalReference(context, node)) ||
      (node.type === "UnaryExpression" && node.operator === "void")
    return {
      ConditionalExpression(node) {
        const test = node.test
        // cell.present ? cell.get() : undefined
        let cell = presentOf(test)
        let read = node.consequent
        let absent = node.alternate
        // !cell.present ? undefined : cell.get()
        if (cell === undefined && test.type === "UnaryExpression" && test.operator === "!") {
          cell = presentOf(test.argument)
          read = node.alternate
          absent = node.consequent
        }
        if (cell === undefined || !isGetOf(read, cell) || !isUndefined(absent)) return
        const name = text(cell)
        context.report({ node, messageId: "value", data: { cell: name }, fix: (fixer) => fixer.replaceText(node, `${name}.value()`) })
      }
    }
  }
})
