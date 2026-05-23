import assert from "node:assert/strict";
import test from "node:test";
import {
  createP0RuntimeConfig,
  P0AuthBoundaryError,
  requireP0AuthContext,
} from "../../src/application/foundation/P0AuthBoundaryRuntimeConfig";

test("route guard rejects missing actor tenant or session in production", () => {
  const config = createP0RuntimeConfig({ NODE_ENV: "production" });

  assert.throws(
    () =>
      requireP0AuthContext(
        {
          headers: {
            "x-p0-actor-id": "actor_001",
            "x-p0-tenant-id": "tenant_a",
            "x-request-id": "request_001",
          },
        },
        config,
      ),
    (error) => error instanceof P0AuthBoundaryError && error.code === "P0_AUTH_BOUNDARY_MISSING" && (error.audit.missing as string[]).includes("sessionId"),
  );
});

test("route guard uses explicit development fallback only when configured", () => {
  assert.throws(() => requireP0AuthContext({ headers: {} }, createP0RuntimeConfig({ NODE_ENV: "development" })), /actor, tenant and session/);

  const context = requireP0AuthContext(
    { headers: { "x-request-id": "request_dev" } },
    createP0RuntimeConfig({ NODE_ENV: "development", P0_ALLOW_DEV_AUTH_FALLBACK: "true" }),
  );

  assert.equal(context.actorId, "dev_actor");
  assert.equal(context.tenantId, "dev_tenant");
  assert.equal(context.sessionId, "dev_session");
  assert.equal(context.requestId, "request_dev");
});

test("production config rejects silent dev fallback", () => {
  assert.throws(
    () => createP0RuntimeConfig({ NODE_ENV: "production", P0_ALLOW_DEV_AUTH_FALLBACK: "true" }),
    (error) => error instanceof P0AuthBoundaryError && error.code === "P0_RUNTIME_CONFIG_INVALID",
  );
});
