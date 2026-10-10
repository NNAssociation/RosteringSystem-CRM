ALTER TABLE "Booking" ADD COLUMN "routingProfileId" INTEGER, ADD COLUMN "outboundItinerary" JSONB, ADD COLUMN "returnItinerary" JSONB, ADD COLUMN "returnItineraryConfirmed" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "routingPreferences" JSONB;
ALTER TABLE "Booking" ADD COLUMN "returnEndDateTime" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "itinerary" JSONB, ADD COLUMN "direction" TEXT, ADD COLUMN "routingEnforced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Assignment" ADD COLUMN "routeRevisionId" INTEGER, ADD COLUMN "positioningRouteIds" JSONB;
ALTER TABLE "Quotation" ADD COLUMN "routingReferences" JSONB;

CREATE TABLE "RoutingProfile" (
 "id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL, "classKey" TEXT NOT NULL, "vehicleId" INTEGER REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "version" INTEGER NOT NULL, "heightMeters" DOUBLE PRECISION NOT NULL, "widthMeters" DOUBLE PRECISION NOT NULL, "lengthMeters" DOUBLE PRECISION NOT NULL,
 "operatingWeightKg" INTEGER NOT NULL, "weightBasis" TEXT NOT NULL, "axleWeightKg" INTEGER, "axles" INTEGER,
 "verificationEvidence" TEXT NOT NULL, "verifiedBy" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RoutingProfile_dimensions_check" CHECK ("heightMeters">0 AND "widthMeters">0 AND "lengthMeters">0 AND "operatingWeightKg">0)
);
CREATE UNIQUE INDEX "RoutingProfile_classKey_version_key" ON "RoutingProfile"("classKey", "version");
CREATE INDEX "RoutingProfile_vehicleId_idx" ON "RoutingProfile"("vehicleId");
CREATE TABLE "RouteRevision" (
 "id" SERIAL PRIMARY KEY, "bookingId" INTEGER REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "jobId" INTEGER REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "profileId" INTEGER NOT NULL REFERENCES "RoutingProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "vehicleId" INTEGER REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "purpose" TEXT NOT NULL, "direction" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "subjectVersion" TEXT,
 "input" JSONB NOT NULL, "result" JSONB NOT NULL, "createdBy" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RouteRevision_jobId_vehicleId_idx" ON "RouteRevision"("jobId", "vehicleId");
CREATE INDEX "RouteRevision_fingerprint_idx" ON "RouteRevision"("fingerprint");
CREATE TABLE "RouteReview" (
 "id" SERIAL PRIMARY KEY, "routeRevisionId" INTEGER NOT NULL REFERENCES "RouteRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "decision" TEXT NOT NULL, "reason" TEXT NOT NULL, "reviewedBy" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RouteReview_routeRevisionId_idx" ON "RouteReview"("routeRevisionId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_routingProfileId_fkey" FOREIGN KEY ("routingProfileId") REFERENCES "RoutingProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_routeRevisionId_fkey" FOREIGN KEY ("routeRevisionId") REFERENCES "RouteRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
