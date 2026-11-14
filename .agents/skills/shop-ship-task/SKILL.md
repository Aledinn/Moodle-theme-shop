---
name: shop-ship-task
description: Ship a completed Moodle Theme Shop task through a focused branch, commit, pull request and separate review, merging when authorized.
---

# Ship a task

Read AGENTS.md and CONTRIBUTING.md. Use the user's existing authorization to
determine the endpoint: a request to ship permits commit, push and PR; merging
also needs to be requested. Do not treat skill discovery as authorization. If
only local work was requested, prepare it locally and report that state.

## Prepare and publish

- Inspect status, diff, remote, current branch and the linked issue. Fetch the base
  without disturbing unrelated work. Start a focused branch from current
  `origin/main` when needed; use a worktree if the working copy cannot switch safely.
- Check the issue's acceptance criteria, implement remaining authorized work and
  run the relevant AGENTS.md checks. For mixed files, stage only task hunks; name
  paths rather than using `git add .`. Inspect the staged diff before committing.
- When publication is authorized, commit and push, then open or update a PR
  targeting `main`. Follow `.github/PULL_REQUEST_TEMPLATE.md`; use `Closes #N` for
  completed issues and `Related to #N` for partial work. Record the branch and
  actual validation, including `Needs human check:` items. Use a body file with
  `gh` to preserve formatting. Prefer the connected GitHub tools when sufficient.

## Separate review

Use a reviewer with fresh context, following the repository's
`shop-review-change` skill. Delegate this review when available; do not delegate
unrelated implementation work. Give only the repository path/remote, PR or diff,
exact full head SHA, linked issue, and pointers to AGENTS.md and the review skill.
Do not include the author's reasoning or anticipated findings. Ask for review,
not automatic merging. If no separate reviewer is available, provide that handoff
for another session/person and report that independent review is outstanding.

Address blockers or explain a finding with evidence. Have the reviewer inspect
the updated SHA; a review of an old commit is not approval of new code. For a
repeated unchanged failure or unavailable prerequisite, report the concrete
blocker rather than repeatedly rerunning the same operation. A READY verdict is
review evidence, not merge permission.

## Merge and verify, when requested

Before merging, confirm the PR is open, targets `main`, the head SHA is still the
reviewed SHA, blocking findings are resolved, and applicable CI checks passed on
that SHA. Explain checks that are absent due to path filters; do not treat pending
or failing applicable checks as success. Do not bypass branch protections.

If there is a completed linked issue, first post an issue comment naming the
branch, PR and validation. This records the branch before automatic closure.
Then merge with the reviewed head pinned, for example:

```text
gh pr merge N --repo Aledinn/Moodle-theme-shop --merge --match-head-commit SHA
```

Use a repository-supported merge method. If the head moved or conflicts appear,
resolve them, rerun affected checks and refresh the review before merging.
Verify the PR merged and the intended issue closed; do not close a partial or
unrelated issue. If automatic closure did not happen, inspect the linkage and
close manually only when the completed task and user request support it.

Report the branch, commit/PR URL, review and CI outcome, unresolved manual checks,
and unrelated changes left local. Do not switch or pull over a dirty working tree
just to tidy up. Branch deletion and release publication are separate actions.
