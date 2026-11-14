# Contributing

## From issue to merge

1. Start with an issue describing the problem, scope, dependencies, acceptance
   criteria and how to verify them. Search for duplicates. Prefer one focused issue
   per PR; reference a parent issue for a larger project.
2. Check for an assignee or existing PR before starting. When coordinating work on
   GitHub, leave a short claim comment with the planned branch. AI assistants only
   post comments when the user's task authorizes that communication.
3. Fetch the current `origin/main` and create a branch such as
   `feat/2-theme-download`, `fix/7-import-target`, or `chore/ai-development-workflow`.
   Keep unrelated local changes out of the task. Use a separate worktree if needed;
   do not stash, reset, delete or publish another task's work as a convenience.
4. Implement the acceptance criteria and run the relevant checks in AGENTS.md.
   Explain anything that still needs a person, real site or unavailable service.
5. Commit the task and push the branch when shipping is authorized. Open a PR
   targeting `main` using the PR template. Use `Closes #N` for completed issues and
   `Related to #N` for partial work. Identify the branch in the PR; when closing a
   ticket, also leave an issue comment naming the branch and PR before closure.
6. Have a separate reviewer inspect the actual change against the issue, check
   test evidence and report concrete findings. Fix blocking findings and review
   the updated commit. An AI reviewer starts without the author's conversation;
   provide the issue/PR, exact commit and repository instructions, not the author's
   explanation of why the implementation is correct.
7. When merging is authorized, confirm the reviewed commit is still the PR head,
   applicable checks passed on that commit, and it merges cleanly. Merge into
   `main`; the closing reference closes the issue. Verify both outcomes. Do not
   bypass protections or publish a release as part of an ordinary merge.

The normal path is:

```text
issue -> branch -> implementation -> checks -> PR -> separate review -> merge -> closed issue
```

## Useful prompts

Repository skills live under `.agents/skills/`. Codex can discover repository skills;
if they are absent from the current session's catalog, start a new session or point
the assistant directly to the relevant `SKILL.md` file.

- `Use $shop-file-issue to draft a ticket for [problem].` Drafts stay local until
  posting is requested. Say "create the GitHub issue" to publish it.
- `Implement issue #N locally.` Makes the change without implying publication.
- `Use $shop-ship-task to commit, push and open a PR for this task.` Includes a
  separate review. Add "and merge when review and checks pass" to authorize merging.
- `Use $shop-review-change to review PR #N at commit <full SHA>. Do not merge.`

Skills are instructions for an assistant, not continuously running bots. This
setup does not enable automatic issue processing, project-board updates, labels,
branch protection or scheduled loops on GitHub.

## Tests and review evidence

Use the checks in [AGENTS.md](AGENTS.md) and the compatibility policy in the
[theme contract](contracts/theme/README.md). A PR should say what changed, why,
what ran, and what did not run. Mark remaining manual verification explicitly:

```text
Needs human check: import the downloaded theme on the intended Moodle hostname
and confirm it applies only to that site.
```

Review outcomes are `READY`, `CHANGES` or `BLOCKED`. `READY` means the reviewed
change has no unresolved blocking findings; it does not grant merge permission.
Use `BLOCKED` when missing evidence or an unavailable environment prevents a
conclusion. Cosmetic suggestions should not block a correct change.

GitHub Actions currently runs Go tests and extension typecheck, Chromium contract
tests and the extension build. Path filters mean docs-only PRs may have no app
checks. Do not claim remote branch protections enforce a review merely because
this document asks for one. AI review using the author's GitHub account is posted
as a clearly identified comment, not presented as another person's approval.
