import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

import { docsUrl, propertyName, stringValue } from "../internal/ast.ts"

/** Descriptor constructors called with the name directly: `Descriptor.Tag("Game/Player")`. */
const directDescriptors = new Set(["Tag", "EntityState", "Hierarchy", "Relation"])

/** Schema-bound constructors whose first argument is the name: `Game.System("Game/Move", ...)`. */
const boundConstructors = new Set(["System", "StateMachine", "EntityScope"])

/** Modules whose `system` / `interpolate` take `{ name }`: `Clock.system(Game, { name: "Game/Time", ... })`. */
const pluginModules = new Set(["Clock", "InputCapture", "RenderSync"])

const isModuleCall = (callee: ESTree.Node, module: string): callee is ESTree.MemberExpression =>
  callee.type === "MemberExpression" && callee.object.type === "Identifier" && callee.object.name === module

/** The string literals in `node` that Ritmo registers as names. */
const namesIn = (node: ESTree.CallExpression): ReadonlyArray<ESTree.Node> => {
  const callee = node.callee
  // Descriptor.Component<T>()("Name"), Descriptor.ConstructedResource(codec)("Name")
  if (callee.type === "CallExpression" && isModuleCall(callee.callee, "Descriptor")) return node.arguments.slice(0, 1)
  if (callee.type !== "MemberExpression") return []
  const method = propertyName(callee)
  if (method === undefined) return []
  if (isModuleCall(callee, "Descriptor") && directDescriptors.has(method)) {
    return method === "Hierarchy" || method === "Relation" ? node.arguments.slice(0, 2) : node.arguments.slice(0, 1)
  }
  if (boundConstructors.has(method)) return node.arguments.slice(0, 1)
  if (isModuleCall(callee, "Clock") && method === "resource") return node.arguments.slice(0, 1)
  if (callee.object.type === "Identifier" && pluginModules.has(callee.object.name) && (method === "system" || method === "interpolate")) {
    const options = node.arguments[1]
    if (options?.type !== "ObjectExpression") return []
    return options.properties.flatMap((property) =>
      property.type === "Property" && !property.computed && property.key.type === "Identifier" && property.key.name === "name" ? [property.value] : []
    )
  }
  return []
}

/**
 * Names Ritmo registers (descriptors, systems, state machines, scopes,
 * plugin systems) carry a `Game/` prefix, so names from a game and from the
 * packages it uses never clash.
 */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefix descriptor, system, state machine, and scope names with the game or package (`\"Town/Position\"`).",
      url: docsUrl("prefix-descriptor-and-system-names")
    },
    messages: {
      unprefixed:
        "\"{{name}}\" has no prefix. Name it `\"<Game>/{{name}}\"`, with your game's or package's name before the slash: names must be unique across everything given to `Schema.bind`, and a clash with a name from a package or another fragment throws there."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        for (const argument of namesIn(node)) {
          const name = stringValue(argument)
          if (name !== undefined && !/^[^/\s]+\/\S/.test(name)) {
            context.report({ node: argument, messageId: "unprefixed", data: { name } })
          }
        }
      }
    }
  }
})
