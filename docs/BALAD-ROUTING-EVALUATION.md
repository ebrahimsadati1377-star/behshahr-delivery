# Balad / Neshan routing evaluation (experimental)

This branch prepares a read-only, opt-in comparison. No production routing changes.

## Provider contract

A routing adapter should accept origin/destination WGS84 coordinates, vehicle type and departure timestamp and return distanceMeters, durationSeconds, trafficAware, provider, measuredAt, and error status. Never silently substitute straight-line distance for a road route.

## Verification gates

- Verify Balad's official commercial API documentation, terms, authentication, vehicle modes and quotas before any integration.
- Do not use undocumented/private endpoints or third-party MCP proxies for production traffic.
- Retain Neshan as the existing provider until a controlled evaluation passes.
- Do not commit credentials or log customer addresses/precise courier positions.
- Keep provider credentials server-side, apply timeouts, rate limits, cache, circuit breaker and structured error handling.
- Never let evaluation calls block order creation, ETA, or dispatch.

## Evaluation protocol

Collect 30 consented, anonymized Behshahr origin/destination pairs (short, medium, long; varied traffic windows). For each, request both providers within a short interval; record status, duration, distance, vehicle support, latency, and timestamp. Where actual courier timestamps exist, compute absolute ETA error per provider. Report MAE, median and p90 errors, failure rate and API latency. Never claim a winner without observed results.

## Rollout

1. Confirm official Balad API availability and authorization.
2. Implement typed adapter behind disabled-by-default feature flag.
3. Add mocked unit/integration tests and failure-path coverage.
4. Run staging comparison without influencing dispatch.
5. Review results and approve production separately.
