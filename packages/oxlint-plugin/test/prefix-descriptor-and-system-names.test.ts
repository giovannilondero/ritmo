import plugin from "@typeonce/oxlint-plugin-ritmo"
import { tester } from "./tester.ts"

const rule = plugin.rules["prefix-descriptor-and-system-names"]!

tester.run("prefix-descriptor-and-system-names", rule, {
  valid: [
    "const Position = Descriptor.Component<Vec2>()(\"Town/Position\")",
    "const Rng = Descriptor.ConstructedResource(Random.codec)(\"Town/Rng\")",
    "const Player = Descriptor.Tag(\"Shooter/Player\")",
    "const ChildOf = Descriptor.Hierarchy(\"Town/ChildOf\", \"Town/Children\")",
    "const Move = Game.System(\"Shooter/Move\", {}, () => {})",
    "const Phase = Game.StateMachine(\"Town/Phase\", [\"Menu\", \"Playing\"] as const)",
    "const Run = Game.EntityScope(\"Shooter/Run\")",
    "const Time = Clock.resource(\"Town/Time\", step)",
    "const render = RenderSync.system(Game, { name: \"Town/Render\", registry })",
    // Names built at runtime are not checked.
    "const Move = Game.System(`${prefix}/Move`, {}, () => {})",
    "const label = format(\"Position\")"
  ],
  invalid: [
    { code: "const Position = Descriptor.Component<Vec2>()(\"Position\")", errors: [{ messageId: "unprefixed", data: { name: "Position" } }] },
    { code: "const Rng = Descriptor.ConstructedResource(Random.codec)(\"Rng\")", errors: [{ messageId: "unprefixed", data: { name: "Rng" } }] },
    { code: "const Enemy = Descriptor.Tag(\"Enemy\")", errors: [{ messageId: "unprefixed", data: { name: "Enemy" } }] },
    {
      code: "const ChildOf = Descriptor.Relation(\"ChildOf\", \"Children\")",
      errors: [{ messageId: "unprefixed", data: { name: "ChildOf" } }, { messageId: "unprefixed", data: { name: "Children" } }]
    },
    { code: "const Move = Game.System(\"Move\", {}, () => {})", errors: [{ messageId: "unprefixed", data: { name: "Move" } }] },
    { code: "const Phase = Sim.StateMachine(\"Phase\", states)", errors: [{ messageId: "unprefixed", data: { name: "Phase" } }] },
    { code: "const Round = Game.EntityScope(\"Round\")", errors: [{ messageId: "unprefixed", data: { name: "Round" } }] },
    { code: "const Time = Clock.resource(\"Time\", step)", errors: [{ messageId: "unprefixed", data: { name: "Time" } }] },
    { code: "const tick = Clock.system(Game, { name: \"AdvanceTime\", resource: Time })", errors: [{ messageId: "unprefixed", data: { name: "AdvanceTime" } }] },
    { code: "const capture = InputCapture.system(Game, { name: \"Capture\", source, resource })", errors: [{ messageId: "unprefixed", data: { name: "Capture" } }] },
    { code: "const bad = Game.System(\"/Move\", {}, () => {})", errors: [{ messageId: "unprefixed", data: { name: "/Move" } }] }
  ]
})
