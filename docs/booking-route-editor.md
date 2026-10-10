# Booking route editor deployment

Apply the additive Prisma migration `20261006120000_booking_route_calculation` using the existing deployment migration procedure (`npx prisma migrate deploy` from backendServer), then regenerate Prisma Client and deploy the backend and frontend together. Existing rows retain a null calculation; no route or accepted quotation is rewritten by the migration.

Set `MAPBOX_ACCESS_TOKEN` on the backend for Directions API calls. The frontend still requires `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` for map tiles and address search. Never expose a secret server token through the frontend environment. Routing fails visibly and incomplete drafts remain saveable if the server token is missing.

The authenticated office endpoint is `POST /bookings/route-preview`. It accepts full ordered `outboundItinerary` and optional `returnItinerary` arrays with 2–22 points each. STOP points create routing legs and add dwell time; VIA points shape the path without dwell. The persisted server calculation is authoritative. Price review is captured with the fingerprint in each new quotation snapshot. Existing confirmed bookings require amendments, and existing jobs change only at amendment acceptance.

Monitor structured `booking.route_calculation` events: `outcome` (ok/failed) and `latencyMs`. Alert on increasing failure rate and high latency; the provider timeout is 12 seconds. Events deliberately omit addresses, coordinates, customer IDs, request URLs and tokens. Use the application's existing request monitoring for rejected validation and access requests.

Before production rollout, verify with a configured Mapbox account: an actual road detour via point; return routing on one-way roads; touch pin dragging; map cleanup on navigation; and a draft save/reopen, quotation review, amendment acceptance sequence against the migrated database. Automated tests stub provider and database boundaries; they do not prove live provider availability or coach road suitability.
