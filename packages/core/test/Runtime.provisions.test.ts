import { describe, expect, it } from "vitest"
import { Descriptor, Schema } from "@typeonce/ritmo"
import * as Runtime from "@typeonce/ritmo/Runtime"

const Logger = Descriptor.Service<{ readonly log: (message: string) => void }>()("Provisions/Logger")
const Game = Schema.bind(Schema.fragment({}))
const Flow = Game.StateMachine("Provisions/Flow", ["Menu", "Playing"] as const)

describe("runtime provisions", () => {
  it("throws on a service or machine provided twice through erased entries", () => {
    const services: ReadonlyArray<Runtime.ServiceProvision> = [
      Runtime.service(Logger, { log: () => {} }),
      Runtime.service(Logger, { log: () => {} })
    ]
    expect(() => Runtime.services(...services)).toThrow("Provisions/Logger is provided twice: keep one Game.Runtime.service(...) for it")
    const machines: ReadonlyArray<Runtime.MachineProvision> = [Runtime.machine(Flow, "Menu"), Runtime.machine(Flow, "Playing")]
    expect(() => Runtime.machines(...machines)).toThrow("Provisions/Flow is provided twice: keep one Game.Runtime.machine(...) for it")
  })
})
