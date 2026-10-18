import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, test } from "vitest"

const fixtures: Array<string> = []
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true })
})

// Exercise the real CLI and child-process path with deterministic measurements.
// No wall-clock timing or installed compiler version decides these assertions.
const run = (flags: Array<string>, runtimeScore = 1, compileFailure = false) => {
  const root = mkdtempSync(join(tmpdir(), "ritmo-bench-test-"))
  fixtures.push(root)
  const bench = join(root, "packages/core/bench")
  mkdirSync(bench, { recursive: true })
  mkdirSync(join(root, "scripts"))
  mkdirSync(join(root, "node_modules/.bin"), { recursive: true })
  writeFileSync(join(root, "package.json"), '{"type":"module"}')
  copyFileSync(new URL("../bench.ts", import.meta.url), join(root, "scripts/bench.ts"))
  writeFileSync(join(bench, "harness.ts"), `
    export const calibration = { name: "calibration" }
    export const measure = (bench) => ({ name: bench.name, minMs: 1, medianMs: 1 })
  `)
  writeFileSync(join(bench, "fixture.bench.ts"), 'export const cases = [{ name: "fixture" }]')
  writeFileSync(join(root, "node_modules/.bin/tsc"), `#!${process.execPath}
    if (process.argv.includes("--version")) console.log("Version fixture")
    else if (${compileFailure}) { console.log("fixture compilation error"); process.exit(1) }
    else console.log("Types: 110\\nInstantiations: 110")
  `, { mode: 0o755 })
  writeFileSync(join(bench, "baseline.json"), JSON.stringify({
    runtime: { tolerance: 0.25, cases: { fixture: { score: runtimeScore } } },
    types: { tolerance: 0.05, typescript: "Version fixture", metrics: { types: 100, instantiations: 100 } }
  }))
  writeFileSync(join(root, "comparison.json"), JSON.stringify({ runtime: { fixture: { score: runtimeScore } } }))
  return spawnSync(process.execPath, [
    "--import", import.meta.resolve("tsx"), join(root, "scripts/bench.ts"), "--check", ...flags
  ], { cwd: root, encoding: "utf8", timeout: 20_000 })
}

test("type growth remains blocking by default", () => {
  const result = run([])
  expect(result.status).toBe(1)
  expect(result.stderr).toContain("types types: 110 exceeds baseline 100")
})

test("CI can report type growth as warnings and succeed", () => {
  const result = run(["--compare", "comparison.json", "--warn-types"])
  expect(result.status).toBe(0)
  expect(result.stderr).toContain("::warning::types types: 110 exceeds baseline 100")
  expect(result.stderr).toContain("::warning::types instantiations: 110 exceeds baseline 100")
  expect(result.stdout).toContain("type metric growth is advisory")
})

test("runtime regressions still fail when type growth is advisory", () => {
  const result = run(["--compare", "comparison.json", "--warn-types"], 0.1)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain("runtime fixture: score 1.000 exceeds compare 0.100")
})

test("type compilation errors still fail when metric growth is advisory", () => {
  const result = run(["--warn-types"], 1, true)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain("Type benchmark program failed to compile")
  expect(result.stderr).toContain("fixture compilation error")
})
