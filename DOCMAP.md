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
| `AGENTS.md` | API table (if new endpoint), Schema section (if DB change), Architecture diagram |
| `client/src/i18n.ts` | New UI keys → ja + zh entries |

### B. Change a Rule / Constraint

When you add or modify an iron rule, prevention item, or project-wide prohibition:

| Must update | What to change |
|-------------|----------------|
| `AGENTS.md` | Add to prevention checklist / 禁止 section |
| `WORKFLOW.md` | Add to 开发检查清单 if it's actionable |
| `DOCMAP.md` | This file — if the sync trigger list changed |
| `PROBLEM.md` | Only if the rule came from a specific bug |

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
| `WORKFLOW.md` | Status line at line 17 ("当前 [version] 推进中") |
| `README.md` | Features list, Design section (if milestone added visible changes) |

---

## Document Inventory

| File | Type | Last touched by Feature |
|------|------|------------------------|
| `AGENTS.md` | Rules & architecture | Mobile Web Phase A |
| `WORKFLOW.md` | Methodology & workflow | Doc-sync rule (#8) |
| `PROBLEM.md` | Bug archive | #40 doc-code drift |
| `LONGTODO.md` | Roadmap | Mobile Web 70→85% |
| `future/NATIVE_APP_ROADMAP.md` | Native app progress | Mobile Web Phase A |
| `future/APP_FRAMEWORKS_AND_CONSTRAINTS.md` | Framework matrix | Phase A checked |
| `future/ONLINE_PLAN.md` | Production launch guide | Turbistile+CSP added |
| `future/DEPLOY.md` | Deployment guide | (needs review — deploy.sh diverged) |
| `COMPAT.md` | Compatibility | Stable |
| `README.md` | Public face | Atmosphere + mobile + security |
| `client/README.md` | Client boot notes | Not maintained — consider removing |
| `SUGGESTION.md` | Partial implementation ref | Stale — features implemented since |
| `Trying/*.md` | Design exploration | Not sync-gated to production |
| `plugins/kotoba-method/*` | Plugin docs | Independent |
| `testbug/README.md` | Test instructions | Updated to reflet shared DB |

---

## Quick check before commit

```text
□ Did I add a feature?        → Check Trigger A list
□ Did I change a rule?        → Check Trigger B list
□ Did I fix a bug?            → Check Trigger C list
□ Did I complete a milestone? → Check Trigger D list
```
