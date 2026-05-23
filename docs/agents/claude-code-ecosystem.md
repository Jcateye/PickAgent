# Claude Code Ecosystem

Selected template: `coding-real-engineer`.

## Current Global Claude Code Baseline

Globally enabled:

- `codex@openai-codex`
- `typescript-lsp@claude-plugins-official`

Globally installed but disabled:

- `agent-sdk-dev@claude-plugins-official`
- `pyright-lsp@claude-plugins-official`
- `ralph-loop@claude-plugins-official`
- `gopls-lsp@claude-plugins-official`
- `jdtls-lsp@claude-plugins-official`
- `everything-claude-code@everything-claude-code`

Do not enable plugins, MCP servers, or hooks globally just because this project may need them. Prefer project-scoped or task-scoped activation.

## Recommendation

Use the global baseline plus project-scoped additions when needed.

Good candidates:

- `code-review@claude-plugins-official` for serious diffs or PR review.
- `pr-review-toolkit@claude-plugins-official` for full PR review workflows.
- `github` MCP when GitHub Issues/PRs are the project tracker.
- `playwright` MCP when browser/E2E verification is part of acceptance.
- `pyright-lsp`, `gopls-lsp`, or `jdtls-lsp` only for matching language stacks.

Project asset work should use Codex `software-assets-builder`, not a Claude Code plugin.

Avoid by default:

- `ralph-loop@claude-plugins-official`, unless the user explicitly asks for a loop.
- `hookify`, unless creating project-specific hooks.
- `everything-claude-code@everything-claude-code`.

Hooks:

- Keep hooks off unless the user asks for automatic enforcement.
- If security-sensitive code is being edited, consider `security-guidance`, preferably project-scoped.
