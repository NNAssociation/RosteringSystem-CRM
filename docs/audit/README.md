# Production audit and cleanup

Audit date: 2026-10-08. No production deployment, database migration, seed, or reset was performed.

## Coverage and limits

`inventory.csv` and `inventory.json` enumerate tracked and non-ignored project files, including pre-existing changes. Each entry records its review depth and content hash. Automated structural scans cover every included text file; targeted manual review covers the security and state boundaries listed by the inventory script. Automated review is not equivalent to a complete manual review. Entries explicitly marked "manual review outstanding" still require that work before describing this as an exhaustive audit.

Generated clients, dependencies, build outputs, ignored credentials, and local backups are excluded. Historical migrations are preserved. Live Clerk settings, hosting/CDN configuration, production origins, Redis access controls, storage permissions, and deployed database policies were not accessible for verification. The existing PostgreSQL integration suites require an isolated `_test` database and were not run locally.

## Confirmed findings and corrections

| Priority | Finding and evidence | Correction | Verification |
| --- | --- | --- | --- |
| High | `backendServer/src/index.ts` reflected arbitrary origins with credentials; Socket.IO allowed wildcard origins. | Shared explicit origin policy using `PUBLIC_APP_URL` and `ALLOWED_ORIGINS`; reject untrusted browser origins before route execution and WebSocket admission. | Origin allow/deny tests; production origin configuration still requires deployment verification. |
| High | `backendServer/src/routes/quotationRoutes.ts` exposed pricing configuration/calculation before its employee guard. | Move those operations behind active employee and office authorization. Public customer capability links remain available. | Anonymous, inactive, driver, and mechanic access tests. |
| High | Resend webhook accepted requests without a configured secret and did not verify standard signed payloads. | Fail closed when unconfigured; verify Svix signatures against raw body, including timestamp tolerance. Preserve existing secret-authenticated integrations for non-`whsec_` secrets. | Missing secret, signed payload, tampering, and old timestamp tests. |
| High | Office users could change employee roles and sign-in email linkage through user updates. | Administrator-only role changes, office-role grants, sign-in email changes, and account reactivation. | Permission regression tests. Review organizational HR policy separately. |
| High | Only one RTK Query cache was reset on account change; booking drafts used an unowned key. | Key the complete provider/store tree by Clerk user and session; scope drafts to the user and remove other users' drafts and legacy data. | Account switching, late actions, draft isolation, sign-out cleanup, and disabled storage tests. |
| Medium | Pricing settings and calculator used unauthenticated fetches and silently displayed defaults after failures. | Shared authenticated pricing hook; explicit retryable loading errors. | Authenticated load/save and failed-load/retry tests. |
| Medium | `charterPricingService.ts` persisted arbitrary pricing payloads, including malformed or unordered rate tables. | Validate partial updates before database access and the merged configuration before persistence; return HTTP 400 for validation errors. | Nine invalid-input regression cases and a partial-update preservation assertion; all backend unit tests pass. |
| Medium | Dispatch reconnection could leave missed events stale. | Invalidate board/assignment data on reconnect; dispose old socket listeners on provider cleanup. | Existing dispatch tests; live reconnect smoke test remains a staging check. |
| Medium | Queue configuration passed `{ url }` as connection options. | Instantiate ioredis from the actual URL with the retry option required by workers. | Mocked queue configuration tests; live Redis/TLS remains a staging check. |
| Medium | Error logs included full request URLs; case variants of capability paths could enter access logs; query logging was enabled in production. | Remove raw URLs from global error logs, suppress public capability paths case-insensitively, disable production SQL query logging, and mask server-error responses. | Static review; verify platform logs separately. |
| Low | Sidebar preference cookie lacked explicit attributes. | Set `SameSite=Lax` and `Secure` over HTTPS. It is a non-sensitive browser-written preference and cannot be `HttpOnly`. | Source verification; Clerk session cookies are unchanged. |

## Cleanup and structure

Both applications retain their roots and public routes. Dispatch's grid, pool, driver lane, and job rendering now live in `frontend/components/dispatch/board`. Scheduling execution, preview, types, and weekly load now live in `backendServer/src/modules/scheduling`; the original service path re-exports its API. Pricing request state is separated from settings rendering. Shared pagination eliminates repeated reset effects.

Prettier formatting and TypeScript import organization were performed as separate mechanical passes after behavior changes. Existing uncommitted changes remain in the same working tree; no commits were created. The frontend and backend expose `format`, `format:check`, `lint`, and `typecheck` scripts. CI uses `npm ci`, checks formatting, and no longer passes production database secrets to backend validation. The backend build cleans only its resolved `dist` directory and refuses a redirected directory.

Deletion evidence:

- React Query provider and `@tanstack/react-query`: repository search found only provider wiring and no query-hook consumers. RTK Query remains the server-state implementation.
- `deps`: no imports, scripts, or configuration consumers.
- `bcrypt`, `jsonwebtoken`, and their type packages: no source consumers; authentication uses Clerk.
- `ts-node-dev`: no scripts or source consumers; development uses `tsx`.
- Five Next/Vercel scaffold SVGs: no application, stylesheet, or configuration references.
- `_old` backend scripts duplicated active commands; `routing:evaluate` pointed to a missing source file. Removed those scripts, retaining active entry points.
- Other apparently unused UI primitives and legacy components were retained pending deeper dynamic-use review. A zero-import count alone is not deletion proof.

## Remaining findings and recommendations

1. **High, policy decision:** Office-wide employee responses contain HR notes, rates, and personal details. Establish a field-level HR access policy, then restrict response projections and tests accordingly. The existing office access model was otherwise retained.
2. **Medium, confirmed:** There is no application rate limiter for public quotation/PDF traffic. Configure bounded request rates at the ingress and a shared limiter before horizontally scaling; establish acceptable customer traffic and proxy topology first. Origin checking is not a replacement for authentication or rate limiting.
3. **Medium, confirmed:** Broad record invalidation refetches multiple API caches after most mutations. Replace it gradually with an explicit resource-impact map, preserving cross-feature refresh tests. No server-side cache was added for private records.
4. **Medium, review required:** Scheduling still uses some host-local week/day calculations and has duplicated candidate-selection logic between preview and execution. Add cross-timezone/DST and multi-booking parity fixtures before changing scheduling behavior.
5. **Medium, operational:** Verify Redis TLS/ACLs, durable job processing, worker shutdown, multi-instance scheduled-work coordination, and backup restore procedures in staging. Without Redis, dispatch background jobs remain disabled.
6. **Medium, defense in depth:** Attachments enforce parent authorization, file signatures, count/size limits, private storage, and download authorization. Signature checks are not malware scanning; add quarantine/scanning if deployment policy requires it.
7. **Maintenance:** Existing broad `any` types and lint warnings remain. Prioritize API DTOs, employee actors, and scheduling records. Do not force OOP classes or introduce generic repositories solely to satisfy a style checklist.
8. **Medium, confirmed:** `controllers/depotController.ts` uses permissive numeric parsing without complete coordinate/type validation. Add bounded latitude/longitude validation, strict positive IDs, and malformed-input route tests before further depot changes.
9. **Medium, confirmed:** `services/settingsService.ts` writes scheduling settings with separate upserts. Move merged-rule validation and writes into one transaction to avoid partially applied or racing configuration updates; verify rollback and concurrent updates with an isolated database.
10. **Medium, confirmed:** Timesheet approval attribution falls back to a generic supervisor label because the employee actor exposes first/last names, not `name`. Carry the authenticated employee ID and display name into the audit event and test the route-to-service boundary. Approval lookup also repeatedly scans logs and sorts wage tiers; optimize with snapshot-key indexing only with equivalence fixtures.
11. **Medium, review required:** Existing stored charter pricing still uses the legacy fallback loader. New writes are validated, but previously malformed configuration is not migrated or silently repaired. Inspect stored configuration in staging and define an explicit invalid-configuration error/recovery policy before changing read behavior.

## Release requirements

Configure `PUBLIC_APP_URL` to the actual frontend URL and `ALLOWED_ORIGINS` to any additional exact comma-separated browser origins before release. Production starts fail if no origins are configured. The inspected local environment contains only localhost, so production compatibility is not yet certified. No-origin requests still require the normal authentication/authorization; forged Origin headers do not grant access.

For direct Resend delivery, set `RESEND_WEBHOOK_SECRET` to the dashboard's `whsec_` signing secret. Verify delivery with a signed staging event. Existing non-`whsec_` shared-secret integrations remain supported but should migrate to signed payloads. Never put backend secrets in `NEXT_PUBLIC_` variables.

On staging, verify Clerk sign-in/out and account switching, anonymous quotation acceptance/PDF access, office pricing, role-change denials, booking creation/editing, dispatch drag/drop, WebSocket reconnect, attachments, and background scheduling. Check CORS preflights from each legitimate host. Validate session-cookie settings in Clerk and the browser, CDN cache behavior, and HTTPS termination. Keep the previous application artifact available for rollback; no schema migration is introduced by this cleanup.

References: [Express CORS behavior](https://expressjs.com/en/resources/middleware/cors/), [Resend webhook verification guidance](https://github.com/resend/resend-skills/blob/main/skills/resend/references/webhooks.md).

See `verification.md` for final command results and dependency-audit limitations. Regenerate the ledger after edits with `node scripts/audit-inventory.mjs --write` from the repository root.
