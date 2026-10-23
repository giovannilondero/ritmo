import plugin from "@typeonce/oxlint-plugin-ritmo"
import { tester } from "./tester.ts"

const rule = plugin.rules["no-state-spread"]!

tester.run("no-state-spread", rule, {
  valid: [
    // A move writes the new state's fields.
    "data.contact.transition({ from: \"ground\", to: \"air\", data: { vy: 2, coyote: 0 } })",
    "const next = { _tag: \"air\", vy: body.vy, coyote: 0 }",
    // Spreading to change fields of the same state.
    "data.contact.update({ state: \"air\", data: (air) => ({ ...air, vy: air.vy - 1 }) })",
    "const next = { ...air, vy: air.vy - 1 }",
    // The tag written before the spread names the state the spread's fields belong to.
    "const value = { _tag: to, ...data }",
    // Keeping the spread value's own tag.
    "const copy = { ...value, extra: 1, _tag: value._tag }",
    // Other keys, and computed keys.
    "const node = { ...base, tag: \"air\" }",
    "const node = { ...base, [key]: \"air\" }"
  ],
  invalid: [
    {
      // shape-brawl src/sim/fighter.ts: the breaker kept `grounded` while moving the body into the air.
      code: "const popped = { ...body, _tag: \"air\", vy: 2 }",
      errors: [{ messageId: "spread", data: { spread: "body" } }]
    },
    {
      code: "return { ...state, _tag: \"hurt\", stun: 20 }",
      errors: [{ messageId: "spread", data: { spread: "state" } }]
    },
    {
      code: "const value = { ...current.action, \"_tag\": next }",
      errors: [{ messageId: "spread", data: { spread: "current.action" } }]
    },
    {
      // A tag written before a spread is fine; one written after it re-tags it.
      code: "const value = { _tag: \"ground\", ...previous, _tag: \"air\" }",
      errors: [{ messageId: "spread", data: { spread: "previous" } }]
    }
  ]
})
