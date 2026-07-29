# DOCMAP — Document dependency and sync checklist

> When you change the code, this file tells you which documents to update.  
> Read before committing. Checked by AGENTS.md §8.

---

## Trigger → Sync Checklist

### A. Add / Change a Feature

When you add a new component, API endpoint, capability, or visual change:

| Must update | What to change |
|-------------|----------------|
| `README.md` | Features list, API table, Architecture diagram, Design section |
| `LONGTODO.md` | Progress bars in the current-version section |
| `future/NATIVE_APP_ROADMAP.md` | Progress bars, "当前做到的位置" line |
| `future/ONLINE_PLAN.md` / `future/DEPLOY.md` | If launch or deployment behavior changed |
| `future/RELEASE_HANDOFF.md` | If branch topology, release gates, version, or cleanup decisions changed |
| `AGENTS.md` | API table (if new endpoint), Schema section (if DB change), Architecture diagram |
| `client/src/i18n.ts` | New UI keys → ja + zh entries |
| `client/src/assets/**` | New design assets → keep license/source beside the asset and document graceful fallback |

### B. Change a Rule / Constraint

When you add or modify an iron rule, prevention item, or project-wide prohibition:

| Must update | What to change |
|-------------|----------------|
| `AGENTS.md` | Add to prevention checklist / 禁止 section |
| `WORKFLOW.md` | Add to 开发检查清单 if it's actionable |
| `DOCMAP.md` | This file — if the sync trigger list changed |
| `PROBLEM.md` | Only if the rule came from a specific bug |
| `README.md` | If dependency or asset governance changes the public tech/design description |

### C. Fix a Bug

When you find and fix a bug in the codebase:

| Must update | What to change |
|-------------|----------------|
| `PROBLEM.md` | Add entry to index table + body: phenomenon → root cause → fix → prevention |
| `AGENTS.md` | Add prevention rule (if the pattern can recur) |
| `WORKFLOW.md` | Add to 开发检查清单 (if new class of bug) |

### D. Complete a Milestone

When a roadmap phase is finished:

| Must update | What to change |
|-------------|----------------|
| `LONGTODO.md` | Progress bars, cross-reference to NATIVE_APP_ROADMAP |
| `future/NATIVE_APP_ROADMAP.md` | Progress bars, position statement, "已完成" records |
| `WORKFLOW.md` | Update current version/phase wording wherever it appears; do not rely on a fixed line number |
| `README.md` | Features list, Design section (if milestone added visible changes) |
| `future/RELEASE_HANDOFF.md` | Release source branch, validation matrix, retained/deleted branches |

### E. Change Deployment / Runtime Topology

When systemd, nginx, environment parsing, readiness, backup/restore, migration order, data paths, or the supported upgrade path changes:

| Must update | What to change |
|-------------|----------------|
| `future/DEPLOY.md` | Exact commands, state transitions, lock order, failure recovery, permissions |
| `future/ONLINE_PLAN.md` | Launch checklist, staging drills, external operations still required |
| `future/RELEASE_HANDOFF.md` | Deployment gates, unresolved Ubuntu checks, immutable release identity |
| `AGENTS.md` / `WORKFLOW.md` | Runtime contract and actionable prevention rules |
| `PROBLEM.md` | Incident record when the change fixes a discovered defect |
| `COMPAT.md` | Runtime/platform support if Bun, OS, browser, proxy, or filesystem requirements changed |

### F. Change Release / Branch Topology

When the release source, retained branch, merge target, tag, worktree, or cleanup decision changes:

| Must update | What to change |
|-------------|----------------|
| `future/RELEASE_HANDOFF.md` | Authoritative branch graph, retained/deleted branches, merge/tag/push state |
| `LONGTODO.md` | Release milestone status and deferred branch-bound work |
| `WORKFLOW.md` | Current version/phase wording, without depending on a line number |
| `README.md` | Public version/release status when user-visible |
| `PROBLEM.md` | Only when branch topology caused or resolved a concrete engineering problem |

### G. Change Test / CI Topology

When test locations, fixtures, temp-data policy, CI jobs, audit gates, migration checks, production smoke, or test commands change:

| Must update | What to change |
|-------------|----------------|
| `testbug/README.md` | Test layout, commands, fixtures, platform limitations |
| `future/RELEASE_HANDOFF.md` | Current validation matrix and exact latest result/count |
| `AGENTS.md` / `WORKFLOW.md` | Required gates and reusable prevention rule |
| `PROBLEM.md` | Root cause and regression boundary if the change came from a defect |
| `DOCMAP.md` | Trigger list when the new gate adds another documentation dependency |

---

## Document Inventory

| File | Type | Last touched by Feature |
|------|------|------------------------|
| `AGENTS.md` | Rules & architecture | 2.1.2 release/security boundaries |
| `WORKFLOW.md` | Methodology & workflow | 2.1.2 release gates |
| `PROBLEM.md` | Bug archive | #47–74 release readiness |
| `LONGTODO.md` | Roadmap | 2.1.2 Web release closeout |
| `future/NATIVE_APP_ROADMAP.md` | Native app progress | 2.1.2 Web boundary; native remains pending |
| `future/APP_FRAMEWORKS_AND_CONSTRAINTS.md` | Framework matrix | Phase A checked |
| `future/ONLINE_PLAN.md` | Production launch guide | 2.1.2 readiness/deployment boundary |
| `future/DEPLOY.md` | Deployment guide | Immutable-ref deployment state machine |
| `future/RELEASE_HANDOFF.md` | Branch/release handoff | 2.1.2 branch consolidation |
| `COMPAT.md` | Compatibility | Bun 1.3.11 / Vite 8.1.5 browser baseline |
| `README.md` | Public face | 2.1.2 security/readiness |
| `client/README.md` | Client boot notes | Not maintained — consider removing |
| `SUGGESTION.md` | Partial implementation ref | Stale — features implemented since |
| `Trying/*.md` | Design exploration | Not sync-gated to production |
| `plugins/kotoba-method/*` | Plugin docs | Independent |
| `testbug/README.md` | Test instructions | Real migrations, OS-temp isolation, release/CI topology |

---

## Quick check before commit

```text
□ Did I add a feature?        → Check Trigger A list
□ Did I change a rule?        → Check Trigger B list
□ Did I fix a bug?            → Check Trigger C list
□ Did I complete a milestone? → Check Trigger D list
□ Did deploy/runtime change?  → Check Trigger E list
□ Did release/branches change? → Check Trigger F list
□ Did tests/CI change?        → Check Trigger G list
```
