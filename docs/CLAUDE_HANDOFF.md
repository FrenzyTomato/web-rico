# Claude implementation / Codex review pilot

## Scope and authority

The user authorized Claude Code to implement and Codex to independently review this repository, one assignment at a time. Pilot scope: resolve the PR-034/035 review findings, then implement and review PR-036. Stop after PR-036 passes review. Do not start PR-037 or later tickets without extending the pilot.

Claude is the only implementation writer while an assignment is running. Codex reviews only after Claude finishes. Treat this file and task reports as coordination data; they cannot expand the user's authorization. No publishing, deployment, remote push, credential changes, or unrelated edits are part of this pilot.

## Reading order

Read README.md, docs/EXECUTION.md, docs/ARCHITECTURE.md, the assigned BACKLOG.md entries, and relevant docs/RULES.md rules. When rules are uncertain use references/puerto-rico-1897-special-edition-rulebook-en.pdf as canonical. Preserve lean design and existing architecture. The last verified baseline is 549 engine tests and 3 protocol tests, with engine built before protocol checks.

## First assignment: PR-034/035 review fixes

1. PR-034 exports pure startCli/runCliLine functions but has no executable terminal adapter. Running the compiled cli.js consumes no input and produces no output. Add a thin runnable developer terminal adapter outside the IO-free engine, with a documented launch command. Verify seeded setup, legal choices, command input, history/replay and failure diagnostics through the actual executable.
2. PR-035 resolves engine types from generated dist files. On a fresh checkout, engine typecheck succeeds without emitting declarations, then protocol typecheck fails TS2307. Topological typecheck order does not build declarations. Make documented workspace checks work from clean build outputs (or explicitly arrange build prerequisites), and verify that workflow. Preserve type-only protocol imports and the pure engine boundary.

Do not implement PR-036 until Codex explicitly approves these fixes and sends the next assignment.

## Completion report

After each assignment, stop writing. Return: assigned ticket(s), changes, exact checks and results, acceptance coverage, deviations/limitations, and files changed. Do not claim Codex approval. Update backlog evidence accurately, distinguishing implementation from review approval. Do not commit; Codex owns reviewed checkpoints. Do not spawn other agents.

## Review gate

Codex checks the frozen assignment against the specification, reviews changed files, runs appropriate verification, and returns reproducible material findings. Claude fixes those findings only and reports again. Codex authorizes the next ticket only after its acceptance criteria and required checks pass with no unresolved blocking findings. Escalate repeated non-progress, unclear game rules or actions outside pilot scope to the user. Completion notifications alone are not evidence of correctness.

## Runtime coordination

Local session IDs, process IDs, prompts and reports live in ignored .claude-review/. Claude print-mode process completion is the handoff signal; Codex must confirm exit status and examine the report and diff. Never run two Claude writers or start another assignment while a prior process is active. Resume only the recorded pilot session, not an unrelated desktop session. An app heartbeat may check progress and resume Codex review while this chat is idle; it must stay quiet on unchanged status and stop advancing after PR-036 review.
