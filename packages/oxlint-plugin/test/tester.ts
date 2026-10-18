import { RuleTester } from "oxlint/plugins-dev"
import { describe, it } from "vitest"

RuleTester.describe = describe
RuleTester.it = it

/** A rule tester that parses TypeScript modules, as games are written. */
export const tester = new RuleTester({ languageOptions: { sourceType: "module", parserOptions: { lang: "ts" } } })
