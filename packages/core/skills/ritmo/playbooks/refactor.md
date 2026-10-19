# Refactor

1. Before moving code, pin the behaviour: the headless tests pass, and a `Determinism.check` or a recorded scripted run gives a baseline to compare against.
2. Keep the simulation in one folder covered by one glob in the simulation override. `ritmo-devtools lint` reports any module the simulation loads from outside it.
3. Keep each shared cache, pool, registry, and long-lived host object single, with one owner.
4. Move state held in module variables to its home ([`state-and-upgrades.md`](state-and-upgrades.md)).
5. Split large files along what changes together: one closed set per module, a file per system once systems grow, a module per screen.
6. Encode the new boundaries: a `no-restricted-imports` rule per folder whose message names where the code belongs.

**Done when** the tests pass unchanged, the scripted run matches the baseline, and the game's check passes.
