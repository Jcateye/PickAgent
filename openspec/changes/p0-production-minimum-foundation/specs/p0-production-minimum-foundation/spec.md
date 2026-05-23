## ADDED Requirements

### Requirement: P0 production minimum foundation
P0 生产化最小层 MUST 将 L4 P1 risk 收敛为可启动生产路径，并 SHALL 以真实持久化、鉴权边界、Agent 审计链和 build/start smoke 作为开工门槛。

#### Scenario: Freeze P0 scope
- **WHEN** P0 work starts after L4 accepted
- **THEN** work is split into Prisma repository transaction, AgentEventStore persistence, auth boundary runtime config, and production acceptance smoke changes.

#### Scenario: Preserve L4 contracts
- **WHEN** a P0 implementation changes storage, auth, runtime config, or smoke execution
- **THEN** L4 route DTOs and Agent SSE contracts remain compatible unless a child change records an explicit contract migration.

#### Scenario: Declare P0 readiness
- **WHEN** all child changes validate and their required evidence is documented
- **THEN** P0 may be declared ready to start implementation with no known P0 blocker.
