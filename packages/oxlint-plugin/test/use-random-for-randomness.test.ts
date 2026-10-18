import plugin from "@typeonce/oxlint-plugin-ritmo"
import { tester } from "./tester.ts"

const rule = plugin.rules["use-random-for-randomness"]!

tester.run("use-random-for-randomness", rule, {
  valid: [
    "const random = Random.draw(resources.rng); const crit = random.next() < 0.1",
    "const kind = Random.draw(resources.rng).pick(kinds)",
    "const Math = { random: () => 0.5 }; Math.random()",
    "const value = Math.floor(x) + Math.max(a, b)",
    "const id = counter.next()"
  ],
  invalid: [
    { code: "const crit = Math.random() < 0.1", errors: [{ messageId: "random", data: { call: "Math.random()" } }] },
    { code: "const roll = Math[\"random\"]()", errors: [{ messageId: "random", data: { call: "Math.random()" } }] },
    { code: "crypto.getRandomValues(bytes)", errors: [{ messageId: "random", data: { call: "crypto.getRandomValues()" } }] },
    { code: "const id = crypto.randomUUID()", errors: [{ messageId: "uuid" }] }
  ]
})
