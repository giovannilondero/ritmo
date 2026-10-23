---
"@typeonce/ritmo-devtools": minor
---

**A described-only schedule named like a runnable one is a type error, and system descriptions show who drains a service.**

- **`Session.make` no longer throws for a name in both `schedules` and `describe`**: it does not compile (`already a runnable schedule in schedules`). Such a call already failed at runtime; rename the described-only schedule:

  ```diff
  -Session.make(runtime, { hostClock, schedules: { update }, describe: { update: render } })
  +Session.make(runtime, { hostClock, schedules: { update }, describe: { render } })
  ```

- `Format.system` (and `session.system(name).text`) prints the services a system drains on their own line, `consumes (drains each run): ...`, apart from the `services` it only calls, so a "where did my input go" question has an answer in the description.
