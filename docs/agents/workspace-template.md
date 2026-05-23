# Workspace Template

Selected template: `coding-real-engineer`.

Use for serious code work where the user wants one project template combining Karpathy-inspired `CLAUDE.md`/`AGENTS.md` rules with Matt Pocock-inspired composable coding skills.

## Ecosystem

- workflow-agent-rules as the Karpathy-style behavior layer
- software-assets-builder for project/module asset initialization and validation
- requirement-grill when requirements are unclear
- work-to-slices for multi-step work
- diagnose-loop for bugs and regressions
- tdd-vertical-slice for new behavior
- codebase-architecture-review before new abstractions or boundary changes
- Git/GitHub only when the task needs issue or PR work
- Browser/Playwright only for runnable web verification

## Operating Defaults

- Treat this as a workspace template, not a standalone skill.
- Define goal, scope, success criteria, and risk level before editing.
- Keep diffs surgical and trace every changed line to the request.
- Prefer tests, typecheck, build, lint, curl, browser checks, or app smoke tests over confidence.
- Do not do drive-by refactors or speculative architecture.

## Expected Outputs

- narrow implementation diff
- verification evidence
- explicit assumptions or clarifying questions when needed
- residual risk notes
