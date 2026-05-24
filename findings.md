# Findings: Frontend Redesign Backend Capability Design

## Inputs

- Source prototype directory: `/Users/haoqi/Downloads/原图原型pickagent_副本2`
- Interface contract: `docs/frontend-redesign-api-contract.md`
- Primary menu source: `pickagent2/` dark sidebar.

## Key Findings

- New first-level menus are: Overview, SKU List, Activity Management, Mission/Run, Review, Reports, Data Sources, Rule Library, Settings.
- Existing backend already covers a demo chain: ingest, health projection, activity parse/simulation, review create/decision, report preview, agent mission/run/events/review-gate.
- Missing backend product capabilities are mostly aggregation and productionization: activity aggregate, rule-set management, connector management, report versions/exports, persistent agent event store, shell/dashboard aggregate APIs.
- Current evidence needs upgrading from summary text to field-level `EvidenceRef`.
- Existing API route defaults still need real auth/tenant boundary and Prisma adapter cleanup before production use.
- Backend work should split into eight streams: contracts, persistence/auth, dashboard/SKU, activity/rules, agent runtime, review/reports, connectors, rules/settings.
- The first implementation blocker is not UI-specific: production must stop silently falling back to memory persistence.
