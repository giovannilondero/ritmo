---
"@typeonce/ritmo": patch
---

**Skill and JSDoc: recognise flat mode records and same-run despawns.** The mechanic and state playbooks and the self-check name the symptoms of state that should be a machine: a system that returns early on a mode field (gate it with `Game.Condition.inState` in `when` on a `Game.StateMachine`), and a nullable or kind-only field next to a `kind` or `phase` field (split it into `Descriptor.EntityState` or `Game.StateMachine` states). `commands.despawn`'s JSDoc says the entity still matches this system's queries for the rest of its run, and to skip the ids it despawned with a local `Set`.
