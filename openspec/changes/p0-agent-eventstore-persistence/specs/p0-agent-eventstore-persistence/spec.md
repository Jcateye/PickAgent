## ADDED Requirements

### Requirement: Persistent AgentEventStore and replay
Agent runtime state MUST persist AgentRun, AgentRunEvent, AgentToolCall, AgentReviewGate, Workflow linkage, and SSE replay data, and SHALL restore Copilot state without fake defaults.

#### Scenario: Replay after reconnect
- **WHEN** an SSE client reconnects with `after=<sequence>`
- **THEN** the API returns all missing persisted `AgentRunEvent` items in ascending sequence before streaming new events.

#### Scenario: Link run audit chain
- **WHEN** an Agent run starts and executes important tool calls
- **THEN** the run is linked to `WorkflowRun` and the important tool calls are linked to `WorkflowStep` or equivalent audit evidence.

#### Scenario: Create formal review item
- **WHEN** Agent policy opens a review gate for a human decision
- **THEN** `AgentReviewGate` creates or links a formal `ReviewItem` that appears in the normal Review workbench.

#### Scenario: Restore Copilot without fake defaults
- **WHEN** the Copilot Overlay loads an existing run after page reload or app restart
- **THEN** its plan, trace, tool status, review gate, and context links are restored from EventStore/SSE contract.
