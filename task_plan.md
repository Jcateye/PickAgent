# Task Plan: Frontend Redesign Backend Capability Design

## Goal

Design backend capabilities and work allocation for the redesigned PickAgent frontend pages, based on `docs/frontend-redesign-api-contract.md`.

## Scope

- Map each redesigned first-level menu to backend bounded capabilities.
- Identify domain services, repositories, persistence changes, and route groups.
- Split implementation into parallel workstreams with dependencies and verification.
- Produce a project doc; do not implement runtime code in this task.

## Phases

| Phase | Status | Output |
|---|---|---|
| 1. Read interface contract and workflow constraints | complete | Loaded frontend API contract and issue-tracker rules |
| 2. Design backend capability map | complete | Backend capability groups and service boundaries |
| 3. Define work allocation | complete | Workstreams, dependency order, verification |
| 4. Persist final design doc | complete | `docs/backend-capability-work-allocation.md` |

## Decisions

- Use local markdown as the issue tracker layer; do not publish to external tools.
- Treat this as design and task allocation only, not code implementation.
- Classify the overall backend redesign as L2, with Prisma migrations / production auth / real Agent runtime marked as L3 approval gates.
- Backend implementation scope is restricted to `apps/backend/`, `apps/contracts/`, `apps/frontend/src/app/api/`, and `docs/`; frontend pages/modules/components/styles are out of scope.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
