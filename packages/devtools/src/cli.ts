#!/usr/bin/env node
/**
 * `ritmo-devtools`: devtools from the command line.
 *
 *   ritmo-devtools lint <entry>
 *
 * Imports `<entry>` (a module exporting `lintTarget`, see the `Lint` module),
 * prints every lint of its schedules with its fix, and exits with 1 when one
 * is a warning. Info-level lints are printed and do not fail.
 *
 * It also checks simulation coverage: every module that importing `<entry>`
 * loads (inside the directory of `.oxlintrc.json` in the working directory,
 * outside `node_modules`) must have `ritmo/keep-simulation-headless` on in that
 * config, so the oxlint simulation rules check it. Each one that does not is
 * printed as `uncovered-simulation-module` and exits with 1. Only modules
 * loaded by importing the entry are checked: modules imported inside
 * `lintTarget` (such as render schedules passed to `describe`) or loaded later
 * are host code and are not. Type-only imports never load and are not checked.
 * A missing or unreadable config, one with `extends`, or one that never turns
 * the rule on prints why the check was skipped and does not fail.
 *
 * Exit codes: 0 ok, 1 lint warning or uncovered module, 2 usage error.
 * Requires Node 22.15 or later for `module.registerHooks`; on older Node it
 * prints that coverage was not checked.
 *
 * @module cli
 * @docGroup devtools
 */
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import * as SimulationCoverage from "./internal/simulationCoverage.ts"
import * as Lint from "./Lint.ts"

const usage = "usage: ritmo-devtools lint <entry>\n  <entry> exports lintTarget: () => { runtime, schedules, describe?, hostEvents? } (see the Lint module)"

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** Checks at runtime what the type of `lintTarget`'s result promises, so a wrong entry fails with a message. */
const isTarget = (value: unknown): value is Lint.Target<any, any> =>
  isRecord(value)
  && isRecord(value["runtime"])
  && isRecord(value["runtime"]["debug"])
  && typeof value["runtime"]["debug"]["describe"] === "function"
  && isRecord(value["schedules"])
  && (value["describe"] === undefined || isRecord(value["describe"]))
  && (value["hostEvents"] === undefined || Array.isArray(value["hostEvents"]))

const main = async (args: ReadonlyArray<string>): Promise<number> => {
  const [command, entry] = args
  if (command !== "lint" || entry === undefined) {
    console.error(usage)
    return 2
  }
  const loads = SimulationCoverage.recordLoads()
  const loaded: unknown = await import(pathToFileURL(resolve(entry)).href)
  // Snapshot before lintTarget runs: modules it imports (render schedules to describe) are host code.
  const simulationModules = loads?.()
  const make = isRecord(loaded) ? loaded["lintTarget"] : undefined
  if (typeof make !== "function") {
    console.error(`${entry} must export lintTarget: a function returning { runtime, schedules, describe? } (see the Lint module)`)
    return 2
  }
  const target: unknown = await make()
  if (!isTarget(target)) {
    console.error(`lintTarget in ${entry} must return { runtime, schedules, describe? } with a runtime made with debug: { hostClock }`)
    return 2
  }
  const report = Lint.run(target)
  console.log(report.text)
  if (simulationModules === undefined) {
    console.log("simulation coverage not checked: needs Node 22.15 or later (module.registerHooks)")
    return report.data.ok ? 0 : 1
  }
  const coverage = SimulationCoverage.check(process.cwd(), resolve(entry), simulationModules)
  const text = SimulationCoverage.format(coverage)
  if (text !== "") console.log(text)
  return report.data.ok && (!coverage.checked || coverage.uncovered.length === 0) ? 0 : 1
}

process.exitCode = await main(process.argv.slice(2))
