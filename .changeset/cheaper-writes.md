---
"@typeonce/ritmo": patch
---

**Faster component writes and spawns, with the same semantics.** A write through a query cell now stamps its change tick as it happens, and committing a system run no longer replays its writes; a system still does not see its own writes in its `changed` filters, and a rolled-back run or transition phase still restores the values and their change ticks. An entity's storage is sized to the components it holds, not to every component in the schema. On the community ECS benchmark cases, iteration with writes is 1.3–1.8× faster and spawning and despawning 1.4× faster.
