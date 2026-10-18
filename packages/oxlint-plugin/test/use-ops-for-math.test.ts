import plugin from "@typeonce/oxlint-plugin-ritmo"
import { tester } from "./tester.ts"

const rule = plugin.rules["use-ops-for-math"]!

tester.run("use-ops-for-math", rule, {
  valid: [
    "import { Ops } from \"@typeonce/ritmo-math\"; const turn = Ops.atan2(Ops.sin(b - a), Ops.cos(b - a))",
    // Exact everywhere.
    "const d = Math.sqrt(dx * dx + dy * dy) + Math.abs(x) + Math.min(a, b) + Math.floor(t) + Math.sign(v)",
    "const tau = Math.PI * 2",
    "const area = radius ** 2",
    "let s = side; s **= 2",
    // A local Math is not the global.
    "const Math = { sin: (x: number) => x }; Math.sin(1)"
  ],
  invalid: [
    {
      // inkline-town mapgen.ts
      code: "const turn = Math.atan2(Math.sin(b - a), Math.cos(b - a))",
      errors: [
        { messageId: "math", data: { name: "atan2" } },
        { messageId: "math", data: { name: "sin" } },
        { messageId: "math", data: { name: "cos" } }
      ]
    },
    { code: "const length = Math.hypot(dx, dy)", errors: [{ messageId: "math", data: { name: "hypot" } }] },
    { code: "const bits = Math.log2(size)", errors: [{ messageId: "math", data: { name: "log2" } }] },
    { code: "const beauty = base * repeat ** n", errors: [{ messageId: "power", data: { operator: "a ** b" } }] },
    { code: "const scale = 2 ** level", errors: [{ messageId: "power", data: { operator: "a ** b" } }] },
    { code: "let v = x; v **= 3", errors: [{ messageId: "power", data: { operator: "a **= b" } }] },
    {
      // With Ops imported, the report fixes itself.
      code: "import { Ops } from \"@typeonce/ritmo-math\"\nconst damping = Math.exp(-friction * dt)",
      output: "import { Ops } from \"@typeonce/ritmo-math\"\nconst damping = Ops.exp(-friction * dt)",
      errors: [{ messageId: "math", data: { name: "exp" } }]
    },
    {
      code: "import { Ops as M } from \"@typeonce/ritmo-math\"\nconst y = (a + b) ** 1.5",
      output: "import { Ops as M } from \"@typeonce/ritmo-math\"\nconst y = M.pow(a + b, 1.5)",
      errors: [{ messageId: "power", data: { operator: "a ** b" } }]
    },
    {
      code: "import * as Ops from \"@typeonce/ritmo-math/Ops\"\nconst a = Math.atan2(y, x)",
      output: "import * as Ops from \"@typeonce/ritmo-math/Ops\"\nconst a = Ops.atan2(y, x)",
      errors: [{ messageId: "math", data: { name: "atan2" } }]
    },
    {
      // A type-only import gives no value to fix with.
      code: "import type { Ops } from \"@typeonce/ritmo-math\"\nconst s = Math.sin(t)",
      errors: [{ messageId: "math", data: { name: "sin" } }]
    }
  ]
})
