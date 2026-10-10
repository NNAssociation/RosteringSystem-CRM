# Verification results

Results from the local working tree on 2026-10-08. These are not production deployment results.

| Check | Result |
| --- | --- |
| Original backend unit-test baseline | 189 tests passed; database suites explicitly excluded. |
| Original frontend baseline | 34 Vitest tests and 11 Node timeline tests passed. |
| Original frontend lint | Failed: 11 errors and 288 warnings. |
| Original application type checks | Both passed. |
| Backend regression suite after security changes and scheduling extraction | 202 tests passed across 18 files; database suites excluded. |
| Queue and security tests after Redis correction | 13 tests passed across 3 files; includes two new queue tests. |
| Backend regression suite after pricing validation | 213 tests passed across 19 files; both database suites explicitly excluded. Backend type-check passed. |
| Final frontend regression suite | 40 Vitest tests across 12 files, plus 11 Node timeline tests, passed. |
| Frontend production build | Passed with Next.js 16.4.0, including TypeScript and static page generation. |
| Backend production build | Passed; generated Prisma Client 7.10.0 and compiled TypeScript. Subsequent Redis change passed type-checking and focused tests. |
| Frontend lint errors | Zero (`npm run lint -- --quiet`). Existing warnings remain. |
| Backend lint errors | Zero when checked with the new configuration; warnings remain. |
| Formatting | Both application-wide `format:check` commands passed. |

## Dependency audit

Before remediation, `npm audit --omit=dev` reported 15 frontend findings (3 critical, 9 high, 3 moderate) and 26 backend findings (1 critical, 16 high, 8 moderate, 1 low).

After compatible updates, frontend production dependencies report **zero known vulnerabilities**. Its development graph still reports 8 high findings propagated through `braces`, `fast-glob`, the Next ESLint plugin, and shadcn tooling. Do not expose development tooling to untrusted glob patterns; a forced shadcn downgrade is not applied.

Backend production dependency resolution still reports **4 high findings** through `prisma`, `@prisma/config`, `deepmerge-ts`, and `mysql2`. The full graph also reports one low esbuild finding. npm proposes a breaking Prisma downgrade for the high findings; that downgrade was not applied. This application uses PostgreSQL, but lack of a direct MySQL call is not proof of non-exploitability. Review deployment packaging and upstream patched versions before release.

Dependency findings are timestamped registry results, not a guarantee that packages have no undisclosed vulnerabilities. Both lockfiles were updated; no `--force` upgrade was used. A transient Windows lockfile-write failure on the frontend was resolved by retrying. npm also reported an old locked SWC directory it could not clean; the production build subsequently passed.

## Checks not performed

- Local PostgreSQL integration tests: no independently verified isolated test database was provisioned. Existing CI provides a dedicated PostgreSQL service for these suites.
- Production/staging deployment, migration, live Redis delivery, real Clerk account switching, browser cookie inspection, CDN behavior, external storage administration, and email-provider dashboard verification.
- Exhaustive manual semantic review of every source file. The inventory records precisely which files received targeted manual review and which received automated structural scans only.

The Next build reports the existing `middleware.ts` convention as deprecated in favor of `proxy.ts`; it still builds successfully. The migration was left separate from these authentication changes.

## Repeatable commands

Run `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build` in each application. Run `npm test` in the frontend. For local backend tests without an isolated database, run:

```sh
npm test -- --exclude src/tests/workplaceDatabase.test.ts --exclude src/tests/workflowDatabase.test.ts
```

From the repository root, run `node scripts/audit-inventory.mjs --write` to refresh the per-file ledger. Run `npm audit --omit=dev` and `npm audit` in each application to recheck current advisories. Review the release requirements in `README.md` before deploying.
