import { defineRule } from "@oxlint/plugins"

import { calledMethod, docsUrl, receiverName } from "../internal/ast.ts"

interface Options {
  readonly runtimePattern?: string
}

/**
 * The result of `runtime.tick(...)`, `tryTick(...)`, `restore(...)`, and
 * `rewind(...)` is read: a failed system, an invalid save, or a released
 * checkpoint comes back as data, and dropping it hides the failure.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Check the Result of runtime.tick(...), tryTick(...), restore(...), and rewind(...) instead of dropping it.",
      url: docsUrl("handle-tick-result")
    },
    messages: {
      tick:
        "The result of `{{call}}(...)` is dropped. A system that fails stops the tick and returns the failure here, so it goes unnoticed and the world is left half-updated. Check it: `const ran = {{call}}(...); if (!ran.ok) ...` (`ran.error` names the system and why). Write `void {{call}}(...)` to ignore it on purpose.",
      restore:
        "The result of `{{call}}(...)` is dropped. A save that fails to load leaves the previous world in place, unnoticed. Check it: `const restored = {{call}}(data); if (!restored.ok) ...` (`restored.error` says what was invalid). Write `void {{call}}(...)` to ignore it on purpose.",
      rewind:
        "The result of `{{call}}(...)` is dropped. A checkpoint the runtime let go of (older than its window, or taken before a rewind to an older one or a restore) changes nothing, so the ticks run next are run on top of the present instead of again, unnoticed. Check it: `const rewound = {{call}}(checkpoint); if (!rewound.ok) ...` (`rewound.error` says why), and resynchronize, for example by loading a peer's save. Write `void {{call}}(...)` to ignore it on purpose."
    },
    schema: [
      {
        type: "object",
        properties: {
          runtimePattern: {
            type: "string",
            description: "A regular expression (case-insensitive) the receiver's name must match to be treated as a Ritmo runtime. Defaults to `runtime$`."
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options
    const runtime = new RegExp(options.runtimePattern ?? "runtime$", "i")
    return {
      ExpressionStatement(node) {
        const call = node.expression
        if (call.type !== "CallExpression" || call.callee.type !== "MemberExpression" || call.arguments.length === 0) return
        const method = calledMethod(call)
        if (method !== "tick" && method !== "tryTick" && method !== "restore" && method !== "rewind") return
        const receiver = receiverName(call.callee.object)
        if (receiver === undefined || !runtime.test(receiver)) return
        context.report({
          node,
          messageId: method === "restore" || method === "rewind" ? method : "tick",
          data: { call: context.sourceCode.getText(call.callee) }
        })
      }
    }
  }
})
