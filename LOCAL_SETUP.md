# Run the CRM locally on Windows

## 1. Keep the existing database and Clerk settings

The application uses these two environment files:

- `backendServer/.env` — database, Clerk backend keys and private storage keys.
- `frontend/.env.local` — frontend API URL, Clerk settings and UI feature flags.

Do not replace either file with an example file. Add/update the settings below
and preserve the existing database, Clerk and quotation settings. For map configuration, follow MAPBOX_SETUP.md; Google Maps settings have been replaced by Mapbox.

## 2. Enable the frontend modules

Add to `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_NOTICES_ENABLED=true
NEXT_PUBLIC_INCIDENTS_ENABLED=true
NEXT_PUBLIC_LOST_PROPERTY_ENABLED=true
```

Keep the existing API URL pointing to `http://localhost:8000`.

## 3. Configure private attachments

In your Supabase project, copy the project URL from Connect. In Settings → API
Keys, use the legacy `service_role` key for the current storage integration
(`SUPABASE_SERVICE_ROLE_KEY`). Do not use the anon/publishable key.

Add/update in `backendServer/.env`:

```dotenv
NOTICES_ENABLED=true
INCIDENTS_ENABLED=true
LOST_PROPERTY_ENABLED=true
SUPABASE_URL=https://YOUR_PROJECT_REFERENCE.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_WORKPLACE_BUCKET=workplace-private
```

Store the service-role key only in the backend environment. It must not be put
in the frontend or shared in chat. These values are separate from DATABASE_URL.

In Supabase Storage, create a bucket named `workplace-private` with Public
disabled. Set a 10 MB file limit and allow image/jpeg, image/png, image/webp,
application/pdf. The backend handles file authorization; no public read/upload
policy is needed. The text workflows can run without storage credentials, but
attachments will report that private storage is not configured.

Supabase reference: https://supabase.com/docs/guides/getting-started/api-keys

## 4. Install backend dependencies and apply migrations

Stop any previously running backend using Ctrl+C. Open PowerShell:

```powershell
cd D:\NN\RosteringSystem-CRM\backendServer
npm ci
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

Use the intended development database. Successful migration is required before
the new employee access check and modules can work. If migration fails, resolve
that error before starting; a database reset is not part of these steps.

## 5. Verify your employee record

The Clerk sign-in account needs a corresponding employee in the database's User
table. Its email must match the verified primary email on the Clerk account.
Set the employee status to ACTIVE and the correct role. The system owner can use
ADMIN; other roles are MANAGER, DISPATCHER, DRIVER and MECHANIC.

If you cannot reach Employees because access has not yet been configured, inspect
the record with Prisma Studio:

```powershell
npx prisma studio
```

Use the browser URL printed by Studio, open User, and check the existing employee
record. Leave clerkId empty on an unlinked record; the application links the
verified account on first access. Do not change an already linked identity to
another account. Stop Studio with Ctrl+C when done.

If you need Clerk keys for a fresh installation, open your existing Clerk
application's API keys page. Use matching keys from the same environment:

| File | Variables |
|---|---|
| backendServer/.env | CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY |
| frontend/.env.local | NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY |

The publishable key starts with pk_test_ for development and the secret with
sk_test_. Existing correctly configured keys do not need to be replaced.
Reference: https://clerk.com/docs/guides/development/clerk-environment-variables

## 6. Start the backend

In the backend PowerShell window:

```powershell
npm run dev
```

Keep this terminal open. The API should listen on port 8000. You can check the
basic health response at http://localhost:8000/.

## 7. Start the frontend in a second terminal

```powershell
cd D:\NN\RosteringSystem-CRM\frontend
npm ci
npm run dev
```

Keep both terminals open. Open http://localhost:3000/dashboard and sign in. If
Next.js prints another port, use the printed URL instead.

Modules:

- http://localhost:3000/dashboard/notices
- http://localhost:3000/dashboard/incidents
- http://localhost:3000/dashboard/lost-property

Restart both development servers after changing environment settings. Production
frontend deployments also need a rebuild because NEXT_PUBLIC flags are build-time
settings. The workspace loading fix is included in the source; restarting the
frontend and refreshing picks it up.
