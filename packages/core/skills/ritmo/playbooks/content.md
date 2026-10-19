# Content

1. Find the closed set the content belongs to (items, kinds, levels) and add the id there. Let the type check list every table that needs an entry, and fill each one.
2. Content that reuses existing behaviour is data: add no system. Content that needs new behaviour is also a mechanic ([`mechanic.md`](mechanic.md)).
3. Derive labels, menus, shortcuts, and lookups from the set instead of adding entries by hand.
4. Keep per-id overrides `Partial<Record<Id, T>>` with one explicit default.
5. Decode content loaded at runtime (files, network) at the boundary, with a constructed descriptor or `Decode`, so bad data fails on load instead of in play.

**Done when** the type check passes with no casts and a headless test spawns the new content and asserts it behaves as its data says.
