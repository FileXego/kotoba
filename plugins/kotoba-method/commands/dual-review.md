---
name: dual-review
description: Launch two independent oracle sessions for code review, cross-verify findings. Use when the user says "dual review", "double check", "cross-verify", "two oracles", or wants a thorough security/architecture review.
argument: Provide the scope of what to review — e.g., "all files changed since last commit", "auth.ts + message.ts", "entire project for security issues"
---

# Dual Oracle Review

Launch TWO independent @oracle sessions with identical prompts, run them in parallel, then compare outputs.

## Procedure

### Step 1: Define the review scope

Ask the user what should be reviewed. Be specific: list the exact files or areas. If the user is vague, narrow it down:
- "Everything" → ask: "Which area are you most worried about? Security? Architecture? Data consistency?"
- "The recent changes" → check `git diff --name-only` to list files

### Step 2: Write a precise review prompt

The prompt must include:
- Project context: tech stack, key constraints
- Files to review (exact paths)
- What to look for: bugs, security issues, inconsistencies, drift from documented standards
- Known false positives to ignore (e.g., "Elysia LSP errors on currentUser are false positives — ignore them")

### Step 3: Launch both sessions in parallel

Use `task` tool with `subagent_type: "oracle"`. Launch BOTH in the same tool call batch:
```
task(subagent_type="oracle", prompt="...")
task(subagent_type="oracle", prompt="...same prompt...")
```
Both get the identical prompt. Use FRESH sessions — never resume old oracle sessions (their file cache is stale).

### Step 4: Compare and classify

When both return, compare findings:

| Pattern | Confidence | Action |
|---------|-----------|--------|
| Both found the same issue | HIGH | Fix immediately — confirmed by independent analysis |
| Only round 1 found it | MEDIUM | Read the file yourself to verify. Oracle 2 may have missed it (known ~50% miss rate) |
| Only round 2 found it | MEDIUM | Same — self-verify before acting |
| Neither found anything | HIGH (for absence) | The scope is clean — or the issue is too subtle for human review |
| R1 says X is a bug, R2 says X is correct | LOW | Read the file yourself. One of them is wrong. Don't trust either until you verify |

### Step 5: Report to user

Present findings grouped by confidence:
- **Confirmed by both oracles** (HIGH): These are definitely bugs. Fix now.
- **Single oracle finding** (MEDIUM): I'll read the file to verify these.
- **Disagreements** (LOW): Need manual investigation.

### Step 6: Fix and re-verify

After fixing all confirmed issues, run the tests and build. If the fix touches a critical path, consider a second round of review on just the changed files.

## Known Limitations

- Oracle sessions snapshot files at spawn time. Edits made after spawning are invisible to them.
- Single oracle review has a ~50% miss rate. Always use two for critical changes.
- Large codebases (>20 files changed) may need to be split into backend/frontend review pairs.
