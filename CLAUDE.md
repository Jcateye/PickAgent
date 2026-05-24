# CLAUDE.md

<!-- PROJECT-WORKFLOW:START -->
## Project Workflow

Use the ProjectWorkFlowDemo workflow layer for non-trivial work.

- Current profile: `coding`.
- Current workspace template: `coding-real-engineer`.
- Read `docs/agents/profile.md` before deciding execution style.
- Read `docs/agents/workspace-template.md` before loading ecosystem-specific tools.
- Read `CONTEXT.md` for project vocabulary.
- Read `design.md` before changing frontend UI, interaction patterns, visual style, or plugin side panel surfaces.
- Read `docs/agents/domain.md` for domain-doc layout.
- Read `docs/agents/issue-tracker.md` before publishing PRDs, issues, slices, or task briefs.
- Read `docs/agents/verification.md` before claiming implementation success.
- Default issue tracker layer: `local-markdown`.
- Obsidian workflow knowledge base: `/Users/haoqi/Library/Mobile Documents/iCloud~md~obsidian/Documents/private_knowlegde/流程`.
- Prefer small scoped changes and verifiable goals.
- Product shape is dual workbench: human workbench for deterministic operations, Agent Copilot workbench for goal-driven planning, tool calls, traces, and Review Gate.
- Agent runtime split: Pi owns the agent harness / loop, Vercel AI SDK owns LLM and tool-schema integration, assistant-ui owns the conversation UI.
- Local dev servers must be started through root scripts only: use `./scripts/dev frontend` for the frontend and `./scripts/dev frontend --restart` when the default port must be restarted. Do not start Next.js, backend, extension, or other long-running dev processes directly with `pnpm`, `npm`, `next`, `plasmo`, `node`, or ad-hoc commands.
- After completing each requirement, commit the code and write the corresponding requirement content clearly in Chinese.
- Stop before `L3` risk unless explicitly authorized.
<!-- PROJECT-WORKFLOW:END -->
