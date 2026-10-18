import plugin from "@typeonce/oxlint-plugin-ritmo"
import { tester } from "./tester.ts"

const rule = plugin.rules["no-infinity-in-simulation-data"]!

tester.run("no-infinity-in-simulation-data", rule, {
  valid: [
    "const dash = { since: null, charges: 2 }",
    "const pool = { timer: null }",
    // Local search seeds are not data.
    "let best = Infinity; for (const d of distances) best = Math.min(best, d)",
    "const nearest = distances.reduce((a, b) => Math.min(a, b), Infinity)",
    "if (range === Infinity) unlimited()",
    // A local named Infinity is not the global.
    "const Infinity = 5; const limit = { max: Infinity }"
  ],
  invalid: [
    {
      // spirit-call src/features/team.ts
      code: "const fresh = () => ({ dash: { remaining: 0, since: Infinity, perfect: false } })",
      errors: [{ messageId: "nonFinite", data: { key: "since", value: "Infinity" } }]
    },
    {
      // spirit-call src/features/arena.ts
      code: "commands.spawnIn(RunScope, Game.Command.spawn([Ground, { remaining: Infinity, duration: Infinity, permanent: true }]))",
      errors: [
        { messageId: "nonFinite", data: { key: "remaining", value: "Infinity" } },
        { messageId: "nonFinite", data: { key: "duration", value: "Infinity" } }
      ]
    },
    {
      // spirit-call src/features/combat.ts
      code: "resources.passiveCooldowns.set({ ...cooldowns, [windKey]: Infinity })",
      errors: [{ messageId: "nonFinite", data: { key: "windKey", value: "Infinity" } }]
    },
    { code: "const floor = { min: -Infinity }", errors: [{ messageId: "nonFinite", data: { key: "min", value: "-Infinity" } }] },
    { code: "const unknown = { score: NaN }", errors: [{ messageId: "nonFinite", data: { key: "score", value: "NaN" } }] },
    { code: "const lob = { maxRange: Number.POSITIVE_INFINITY }", errors: [{ messageId: "nonFinite", data: { key: "maxRange", value: "Number.POSITIVE_INFINITY" } }] }
  ]
})
