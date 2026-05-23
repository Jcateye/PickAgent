## ADDED Requirements

### Requirement: Build start production acceptance smoke
Production acceptance MUST run build/start mode smoke and SHALL archive evidence for persistence, auth boundary, Agent replay, Copilot contract, Pi tool policy, and cross-module routes.

#### Scenario: Run production startup
- **WHEN** P0 acceptance begins
- **THEN** the app is built and started through production commands before HTTP or browser smoke runs.

#### Scenario: Verify persistence after restart
- **WHEN** acceptance data is created and the service restarts
- **THEN** SKU, activity, review, report, Agent run, and Agent event data remain queryable.

#### Scenario: Verify safe runtime boundary
- **WHEN** the production smoke requests Agent visible tools or attempts a dangerous tool call
- **THEN** only approved low-risk business tools are visible and dangerous tools are denied.

#### Scenario: Archive acceptance evidence
- **WHEN** production smoke completes
- **THEN** logs, JSON responses, screenshots, and the Chinese acceptance report are written to the P0 evidence directory.
