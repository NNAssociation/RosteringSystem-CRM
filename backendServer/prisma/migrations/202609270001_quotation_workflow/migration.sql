-- Preserve existing operational bookings explicitly; do not invent customer acceptance.
ALTER TABLE "Booking" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
 ADD COLUMN "stops" JSONB, ADD COLUMN "confirmedAt" TIMESTAMP(3),
 ADD COLUMN "confirmationSource" TEXT, ADD COLUMN "amendsBookingId" INTEGER,
 ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "DriverAvailability" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
-- Preserve usable legacy trip durations; new workflows require explicit end times.
UPDATE "Job" SET "jobEndDateTime" = "jobStartDateTime" + make_interval(secs => COALESCE("durationHours", 2)::double precision * 3600)
 WHERE "jobStartDateTime" IS NOT NULL AND "jobEndDateTime" IS NULL;
UPDATE "Assignment" a SET "scheduledEnd" = a."scheduledStart" + make_interval(secs => COALESCE(j."durationHours", 2)::double precision * 3600)
 FROM "Job" j WHERE a."jobId" = j.id AND a."scheduledEnd" IS NULL;
UPDATE "Booking" SET "endDateTime" = "startDateTime" + interval '2 hours' WHERE "endDateTime" IS NULL;

UPDATE "Booking" b SET "status" = 'CONFIRMED', "confirmationSource" = 'LEGACY_OPERATIONAL'
WHERE UPPER(b."status") <> 'CANCELLED' AND (UPPER(b."status") = 'CONFIRMED' OR EXISTS (
 SELECT 1 FROM "Job" j JOIN "Assignment" a ON a."jobId" = j.id
 WHERE j."bookingId" = b.id AND a.status <> 'CANCELLED'));
UPDATE "Booking" SET "status" = CASE WHEN UPPER("status") = 'CANCELLED' THEN 'CANCELLED' ELSE 'DRAFT' END
 WHERE "confirmationSource" IS NULL;
UPDATE "Assignment" a SET status = 'CANCELLED', version = version + 1
 FROM "Job" j JOIN "Booking" b ON b.id = j."bookingId"
 WHERE a."jobId" = j.id AND b.status = 'CANCELLED' AND a.status NOT IN ('COMPLETED', 'IN_PROGRESS', 'CANCELLED');

CREATE TABLE "Quotation" (
 "id" SERIAL PRIMARY KEY, "bookingId" INTEGER NOT NULL REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "revision" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "currency" TEXT NOT NULL DEFAULT 'AUD',
 "discountMinor" INTEGER NOT NULL DEFAULT 0, "taxBasisPoints" INTEGER NOT NULL DEFAULT 0,
 "subtotalMinor" INTEGER NOT NULL, "taxMinor" INTEGER NOT NULL, "totalMinor" INTEGER NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "terms" TEXT NOT NULL DEFAULT '', "message" TEXT NOT NULL DEFAULT '',
 "snapshot" JSONB NOT NULL, "tokenHash" TEXT, "tokenCipher" TEXT, "sentAt" TIMESTAMP(3), "respondedAt" TIMESTAMP(3),
 "respondentName" TEXT, "responseReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Quotation_tokenHash_key" ON "Quotation"("tokenHash");
CREATE UNIQUE INDEX "Quotation_bookingId_revision_key" ON "Quotation"("bookingId", "revision");
CREATE INDEX "Quotation_status_expiresAt_idx" ON "Quotation"("status", "expiresAt");
CREATE TABLE "QuotationItem" (
 "id" SERIAL PRIMARY KEY, "quotationId" INTEGER NOT NULL REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "position" INTEGER NOT NULL, "description" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
 "unitPriceMinor" INTEGER NOT NULL, "totalMinor" INTEGER NOT NULL
);
CREATE TABLE "EmailDelivery" (
 "id" TEXT PRIMARY KEY, "quotationId" INTEGER NOT NULL REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "kind" TEXT NOT NULL DEFAULT 'QUOTATION', "recipient" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED',
 "attempts" INTEGER NOT NULL DEFAULT 0, "providerMessageId" TEXT, "lastError" TEXT,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "claimedAt" TIMESTAMP(3),
 "deliveredAt" TIMESTAMP(3), "lastEventAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "EmailDelivery_providerMessageId_key" ON "EmailDelivery"("providerMessageId");
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");
CREATE TABLE "WorkflowEvent" (
 "id" SERIAL PRIMARY KEY, "type" TEXT NOT NULL, "payload" JSONB NOT NULL,
 "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WorkflowEvent_publishedAt_idx" ON "WorkflowEvent"("publishedAt");
