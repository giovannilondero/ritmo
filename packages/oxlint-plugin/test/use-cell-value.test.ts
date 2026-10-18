import plugin from "@typeonce/oxlint-plugin-ritmo"
import { tester } from "./tester.ts"

const rule = plugin.rules["use-cell-value"]!

tester.run("use-cell-value", rule, {
  valid: [
    "const ward = data.ward.value()",
    // Branching without reading, or reading a different cell.
    "if (data.ward.present) shield()",
    "const x = data.ward.present ? data.other.get() : undefined",
    // A different fallback is a different meaning.
    "const hp = data.health.present ? data.health.get() : 0",
    "const hp = data.health.present ? data.health.get() : null"
  ],
  invalid: [
    {
      // spirit-call src/features/attacks.ts
      code: "const dash = target.data.dash.present ? target.data.dash.get() : undefined",
      output: "const dash = target.data.dash.value()",
      errors: [{ messageId: "value", data: { cell: "target.data.dash" } }]
    },
    {
      // inkline-town src/schema.ts
      code: "const maybe = <T>(cell: Cell<T>) => cell.present ? cell.get() : undefined",
      output: "const maybe = <T>(cell: Cell<T>) => cell.value()",
      errors: [{ messageId: "value", data: { cell: "cell" } }]
    },
    {
      code: "const ward = !data.ward.present ? undefined : data.ward.get()",
      output: "const ward = data.ward.value()",
      errors: [{ messageId: "value", data: { cell: "data.ward" } }]
    }
  ]
})
