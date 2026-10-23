// The Twoslash setup for `ts twoslash` snippets: the compiler options a Ritmo
// game uses, and errors shown as the message Ritmo writes into them.
import { rendererRich, transformerTwoslash } from "@shikijs/twoslash"
import { createTwoslasher } from "twoslash"
import ts from "typescript"

// Strict, with exact optional properties: the errors a real game would see.
const compilerOptions = {
  strict: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  noEmit: true,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  types: []
}

// Types printed from the workspace sources carry absolute paths of the
// machine that built the site: print the module name instead.
const stripPaths = (text) => text.replace(/import\("[^"]*\/packages\/[\w-]+\/src\/([\w/]+?)(?:\.ts)?"\)\./g, "")

// Ritmo puts the fix for a mistake inside the type error, as a string at its
// end (`Fix<"...">`, `__fixTickOrder__: "..."`, ...). An editor prints it
// after the types around it; the docs show that message alone.
const fixes = [
  /Fix<"((?:[^"\\]|\\.)*)">/,
  /__fix\w+__: "((?:[^"\\]|\\.)*)"/,
  /__schemaConflicts__: "((?:[^"\\]|\\.)*)"/,
  /parameter of type '"((?:[^"\\]|\\.)*)"'/
]

const condense = (text) => {
  const requirement = /__runtimeRequirementError__: "([^"]+)"; readonly __requirement__: "([^"]+)"/.exec(text)
  if (requirement !== null) return `${requirement[1]}: ${requirement[2]}. Provide it in Game.Runtime.make(...)`
  const conflict = /__schemaConflicts__: "((?:[^"\\]|\\.)*)"/.exec(text)
  if (conflict !== null) return `Two descriptors share a name: ${JSON.parse(`"${conflict[1]}"`)}`
  for (const pattern of fixes) {
    const match = pattern.exec(text)
    if (match !== null) return JSON.parse(`"${match[1]}"`)
  }
  return stripPaths(text)
}

const base = createTwoslasher({ compilerOptions })

/** Compiles a snippet, then condenses its errors (one per line and message). */
const twoslasher = (code, extension, options) => {
  const result = base(code, extension, options)
  const seen = new Set()
  // `errors` is a view of `nodes`, so the error nodes are rewritten there.
  result.nodes = result.nodes.flatMap((node) => {
    if (node.type !== "error") return [node]
    const text = condense(node.text)
    const key = `${node.line}:${text}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...node, text }]
  })
  return result
}

export const twoslash = () =>
  transformerTwoslash({
    // Only fences marked `ts twoslash` are compiled.
    explicitTrigger: true,
    // An error a snippet does not expect with `// @errors: <code>` fails the build.
    throws: true,
    twoslasher,
    renderer: rendererRich({ processHoverInfo: stripPaths })
  })
