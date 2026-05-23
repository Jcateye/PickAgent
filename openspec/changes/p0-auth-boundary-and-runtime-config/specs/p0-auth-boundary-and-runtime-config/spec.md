## ADDED Requirements

### Requirement: Production auth boundary and runtime config
Production APIs MUST enforce minimal auth, tenant, and session boundaries, and Pi runtime config SHALL expose only approved low-risk business tools.

#### Scenario: Reject missing boundary
- **WHEN** a production API request lacks actor, tenant, or session context
- **THEN** the route rejects the request before calling application service or repository code.

#### Scenario: Prevent cross-tenant access
- **WHEN** a request attempts to read or write data outside its tenant boundary
- **THEN** the API denies access and records an auditable rejection.

#### Scenario: Hide dangerous runtime tools
- **WHEN** Pi production adapter starts
- **THEN** coding, file, bash, sql, credential, cookie, token, JWT, SSO, secret, and api key tools are not visible and cannot be executed.

#### Scenario: Expose only low-risk business tools
- **WHEN** Agent runtime asks for available production tools
- **THEN** it receives only approved low-risk business tools routed through ToolPolicy and application service.
