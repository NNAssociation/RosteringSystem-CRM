# Notice Board, Incidents and Lost Property

## What is included

The dashboard now includes three independently enabled modules, role-scoped APIs,
responsive lists/details, private photo/PDF attachments, and persistent in-app
notifications. The existing dashboard, fleet, dispatch and booking views link to
the new workflows. No email, public reporting, offline synchronization or automatic
property disposal is introduced.

Routes:

- `/dashboard/notices` and `/dashboard/notices/:id`
- `/dashboard/incidents` and `/dashboard/incidents/:id`
- `/dashboard/lost-property`, `/dashboard/lost-property/reports/:id`,
  `/dashboard/lost-property/items/:id`

API families: `/me`, `/workplace/lookups`, `/notices`, `/incidents`,
`/lost-property/reports`, `/lost-property/items`, `/lost-property/matches`,
`/attachments`, `/notifications`. Lists default to 25 records, maximum 100.

## Deployment sequence

1. Back up the database and apply the checked-in additive migration using
   `npx prisma migrate deploy` from `backendServer`. This is required even when
   all feature flags are false: employee authorization now uses `User.clerkId`,
   and deletion eligibility accounts for the new historical references.
2. Verify that every existing office user has an **ACTIVE** employee record and
   a database role of ADMIN, MANAGER, or DISPATCHER. Clerk metadata is no longer
   an authorization override. The first authenticated request links a verified
   primary Clerk email to the matching employee email; subsequent requests use
   the unique Clerk ID. An unverified/unmatched email or inactive employee is
   denied. Resolve mappings before deploying the new access gate.
3. Create a dedicated **private** Supabase Storage bucket. Set the bucket size
   limit to 10 MB and allowed MIME types to image/jpeg, image/png, image/webp,
   application/pdf. Do not add public/anonymous/authenticated object-access
   policies for this bucket. All access goes through the backend's record checks.
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `SUPABASE_WORKPLACE_BUCKET` in the backend environment. Never put the service
   key in a `NEXT_PUBLIC_*` variable. The service checks that the bucket is private
   before upload/download and refuses public buckets.
5. Enable `NOTICES_ENABLED`, `INCIDENTS_ENABLED`, and `LOST_PROPERTY_ENABLED`
   individually, using the literal value `true`. Set their corresponding
   `NEXT_PUBLIC_*` frontend flags to `true` and rebuild the frontend. Examples are
   in each application's `.env.workplace.example`. Defaults are disabled.
6. Build both applications (`npm run build` in each directory), deploy the backend
   and frontend, and pilot with office staff plus a driver and mechanic. These
   changes do not create Clerk accounts, provision storage, or run production
   migrations automatically.

## Permissions and workflows

- Drivers/mechanics see targeted notices and reports they submitted, own, or
  currently hold custody of. Office staff manage all records. Existing office-only
  APIs are now authenticated and role-guarded; public quotation endpoints retain
  their existing capability-based access.
- Notice content revisions are immutable. Publication captures active recipients;
  later readers do not change the historical acknowledgement denominator. Every
  acknowledgement checks the record version to reject stale revisions. Files are
  attached to notice drafts before publishing; published files remain immutable.
- Incident submission details remain intact; corrections are attributed updates.
  Private investigation notes and their files never appear in employee responses.
  Resolution requires completed corrective actions. Reopening requires a reason.
- Unsafe vehicle reports raise office attention. Only an explicit office fleet
  decision applies MAINTENANCE. It preserves existing assignments and prevents
  new allocations using the existing eligibility rules. Incident closure does not
  restore a vehicle to service.
- Lost reports and found items are separate. One active match per item/report is
  enforced by PostgreSQL partial unique indexes. Returning a matched item updates
  both records and records custody/verification atomically. Only ADMIN/MANAGER can
  dispose, with a reason. Custody and claimant verification details are retained;
  verification and contact information are office-only.
- Mandatory audit and notification writes share the workflow transaction. Stale
  writes and concurrency conflicts return 409; refresh the record before retrying.

## Storage and scheduled work

Files are limited to ten per record/update and 10 MB each. The backend checks
signatures, uses generated storage keys and reauthorizes downloads. A failed
upload is recorded for cleanup; incomplete uploads older than an hour and removed
files are cleaned by the workplace worker. Uploads never publish storage URLs or
credentials to the browser. Removal of draft attachments is explicit; closed
records retain their attachments.

The backend's 30-second worker publishes scheduled notices, expires notices, and
cleans abandoned files. Serialized transactions and recipient uniqueness prevent
duplicate scheduled publications across instances. Notifications poll every 30
seconds while the app is focused, refresh on focus, and remain stored in the
database. Recipient access is checked again when listing notifications and opening
their records. No sensitive content is broadcast on the Dispatch socket.

All event times are UTC in storage. Entry/display uses `BUSINESS_TIMEZONE`,
defaulting to Australia/Sydney. Nonexistent daylight-saving local times are rejected.

## Validation and pilot checklist

Run `npm test` in both applications. For faster bounded frontend execution use
`npx vitest run --maxWorkers=2` plus the existing Node tests. `npm run build` checks
both TypeScript applications. `npx prisma validate` checks the schema.

Database integration tests are opt-in: provide `TEST_DATABASE_URL` for a dedicated
database whose name ends in `_test`, apply all migrations to it, then run backend
tests. Never point this variable at production. The tests cover SQL notice lists,
publication/acknowledgement, mandatory-audit rollback, competing property matches,
and duplicate returns. They create and remove only their own fixtures.

Pilot scenarios:

1. Publish a driver-only notice; check that a mechanic cannot open its URL/file.
   Acknowledge it, revise it, and confirm that a new acknowledgement is required.
2. Submit an incident as a driver, assign a mechanic, add an office-only note and
   attachment, complete corrective actions, resolve and close. Confirm existing
   assignments remain after an explicit maintenance decision.
3. Register a found item and loss report, match them, transfer custody, verify the
   claimant and return once. Attempt a second return from a stale browser.
4. Test mobile navigation, record deep links, failed-save retry, unconfigured
   employee access, feature-disabled URLs and failed storage uploads.

Monitor `[Workplace]` request/worker failures, authentication failures, failed
storage requests and worker cadence. Keep flags disabled until the migration,
identity mappings, private bucket and the pilot have been verified. Rollback by
disabling the feature flags and redeploying/rebuilding; retain the additive schema
and historical records. Do not drop tables to roll back a feature.

Supabase access-control reference:
https://supabase.com/docs/guides/storage/security/access-control
