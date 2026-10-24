---
"@typeonce/ritmo": patch
---

**Numbers are stored unboxed.** A component value that is a number (a plain or branded number such as `Scalar.Finite`, a number literal union, an entity id) is kept in a typed array in its page. Reading one returns the number and writing one copies it in: nothing is allocated, and change detection and rollback compare plain numbers. Nothing to declare: the runtime stores each value by what it is, so a component whose value is sometimes a number (`number | { x: number }`) works too. Queries, cells, commands and snapshots keep their API. On the community ECS benchmark cases, iteration with number writes is about 1.4× faster than before, and reading object values through a query is about 25% faster.
