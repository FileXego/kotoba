---
status: accepted
---

# Authorize in SQL and invalidate in realtime

Every read surface applies the same viewer-aware SQL access predicate before counting, sorting, pagination, search, or aggregation, while realtime transports content-free invalidation signals instead of protected object metadata. This was chosen over post-query JavaScript filtering and in-memory per-recipient fan-out because those approaches leak counts or identifiers, break pagination, and make the SQLite monolith harder to reason about safely.

## Consequences

New read surfaces must reuse the shared predicate, and clients refetch protected APIs after garden, account, or notification invalidations.
