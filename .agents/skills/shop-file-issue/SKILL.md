---
name: shop-file-issue
description: Draft or create a Moodle Theme Shop GitHub ticket with scope, dependencies, acceptance criteria and verification.
---

# Define a ticket

Read the repository's AGENTS.md and CONTRIBUTING.md. The repository is
`Aledinn/Moodle-theme-shop`; verify the working copy's remote before writing to it.

Search open and closed issues for the same problem and inspect likely matches.
For a bug, capture actual/expected behavior, reproduction steps, environment and
relevant redacted evidence. For a feature or technical task, capture the problem,
scope, parent issue/dependencies, acceptance checklist and validation. Use the
fields in `.github/ISSUE_TEMPLATE/` as the shape, not guessed implementation details.
Split a large project into a tracking issue and independently verifiable children
when that helps; do not create a batch of tickets for a request to draft one.

When asked to draft, return the title and body without publishing. When asked to
create/file the GitHub issue, use the connected GitHub tool, or `gh issue create`
with a UTF-8 body file if the connector lacks the required capability. Use only
existing labels that fit; do not invent labels, board IDs or milestones. Add to a
project only if that project was identified and board changes were requested.
Existing authorization remains valid; do not ask to publish a second time.

Return the issue URL when published, or the complete draft when not. State which
missing evidence is still needed rather than fabricating a reproduction.
