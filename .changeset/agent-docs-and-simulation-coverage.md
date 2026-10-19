---
"@typeonce/ritmo": patch
"@typeonce/ritmo-browser": patch
"@typeonce/ritmo-render": patch
"@typeonce/ritmo-pixi": patch
"@typeonce/ritmo-math": patch
"@typeonce/ritmo-devtools": minor
"@typeonce/oxlint-plugin-ritmo": patch
---

**Everything a game's agent needs now ships with the packages, and `ritmo-devtools lint` reports simulation modules the lint rules miss.**

- **Breaking: `ritmo-devtools lint` fails on an uncovered simulation module.** Every module the entry loads that the `ritmo/keep-simulation-headless` override in `.oxlintrc.json` does not cover is reported as `uncovered-simulation-module`, and the command exits 1. Add the module (or its folder) to the simulation override's `"files"`, or stop importing values from it. Modules loaded only inside `lintTarget` are not checked. Requires Node 22.15 or newer (`engines.node` is now `>=22.15`).
- **An agent skill ships with `@typeonce/ritmo`** in `skills/ritmo/SKILL.md`: where the docs are, and principles for where a game's code and state belong. Link it into the folder the game's agent reads skills from, for example `ln -s ../../node_modules/@typeonce/ritmo/skills/ritmo .agents/skills/ritmo`.
- **Every package ships its `CHANGELOG.md`.** The upgrade notes for 0.8.0 and 0.9.0 moved from the repository's `MIGRATION.md` into the `@typeonce/ritmo` changelog.
- **JSDoc corrections.** Examples no longer provide randomness or time as services (use the `Random` resource and `Clock`), the `Command` module example declares its commands, inspector docs state that `added`/`changed` reads report records since the inspector's previous evaluation, and every example uses prefixed names (`"Game/Position"`). Guidance that lived only in the repository's guides (spawn order, `ReadonlyValue` helpers, re-entering a state, `thisTick` and plugin systems, service effects and rollback) is now in the JSDoc.
- Package READMEs link other packages' READMEs by GitHub URL, so the links work on npm.
