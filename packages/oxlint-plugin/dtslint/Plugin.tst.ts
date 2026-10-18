import type { Plugin, Rule } from "@oxlint/plugins"
import plugin from "@typeonce/oxlint-plugin-ritmo"
import { describe, expect, it } from "tstyche"

describe("oxlint plugin", () => {
  it("is an oxlint plugin whose rules are oxlint rules", () => {
    expect(plugin).type.toBe<Plugin>()
    expect(plugin.rules).type.toBe<Record<string, Rule>>()
  })
})
