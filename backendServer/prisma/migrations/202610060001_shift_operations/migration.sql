-- AlterEnum
ALTER TYPE "EmployeeRole" ADD VALUE 'YARD';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "busRequirements" JSONB;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "yardManaged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FleetVehicle" ADD COLUMN     "facilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "allocationId" INTEGER,
ADD COLUMN     "shiftId" INTEGER,
ADD COLUMN     "slotIndex" INTEGER;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "estimateReference" JSONB;

-- AlterTable
ALTER TABLE "RoutingProfile" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "facilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "DriverShift" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "depotId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentAllocationId" INTEGER,
    "requestKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "planningIssues" JSONB NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftVehicleAllocation" (
    "id" SERIAL NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'SELECTED',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releasedBy" INTEGER,
    "releaseFingerprint" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" INTEGER,
    "acknowledgementKey" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftVehicleAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistVersion" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionChecklistVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleInspection" (
    "id" SERIAL NOT NULL,
    "allocationId" INTEGER NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "notes" TEXT NOT NULL,
    "photos" JSONB,
    "passed" BOOLEAN NOT NULL,
    "checkedBy" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,

    CONSTRAINT "VehicleInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDefect" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "inspectionId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedBy" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "recheckInspectionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationAssessment" (
    "id" SERIAL NOT NULL,
    "allocationId" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "routes" JSONB NOT NULL,
    "assessedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCardVersion" (
    "id" SERIAL NOT NULL,
    "classKey" TEXT NOT NULL,
    "profileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "minimumMinor" INTEGER NOT NULL,
    "baseMinor" INTEGER NOT NULL,
    "hourlyMinor" INTEGER NOT NULL,
    "perKmMinor" INTEGER NOT NULL,
    "chargePositioning" BOOLEAN NOT NULL DEFAULT true,
    "chargeLoading" BOOLEAN NOT NULL DEFAULT true,
    "chargeWaiting" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateCardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteEstimate" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "bookingRevision" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverShift_requestKey_key" ON "DriverShift"("requestKey");

-- CreateIndex
CREATE INDEX "DriverShift_driverId_startAt_endAt_idx" ON "DriverShift"("driverId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftVehicleAllocation_requestKey_key" ON "ShiftVehicleAllocation"("requestKey");
CREATE UNIQUE INDEX "ShiftVehicleAllocation_acknowledgementKey_key" ON "ShiftVehicleAllocation"("acknowledgementKey");

-- CreateIndex
CREATE INDEX "ShiftVehicleAllocation_vehicleId_effectiveAt_endAt_idx" ON "ShiftVehicleAllocation"("vehicleId", "effectiveAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftVehicleAllocation_shiftId_revision_key" ON "ShiftVehicleAllocation"("shiftId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistVersion_version_key" ON "InspectionChecklistVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleInspection_requestKey_key" ON "VehicleInspection"("requestKey");

-- CreateIndex
CREATE INDEX "VehicleInspection_vehicleId_checkedAt_idx" ON "VehicleInspection"("vehicleId", "checkedAt");

-- CreateIndex
CREATE INDEX "VehicleDefect_vehicleId_status_idx" ON "VehicleDefect"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "AllocationAssessment_allocationId_createdAt_idx" ON "AllocationAssessment"("allocationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateCardVersion_classKey_version_key" ON "RateCardVersion"("classKey", "version");

-- CreateIndex
CREATE INDEX "QuoteEstimate_bookingId_bookingRevision_idx" ON "QuoteEstimate"("bookingId", "bookingRevision");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "DriverShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ShiftVehicleAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftVehicleAllocation" ADD CONSTRAINT "ShiftVehicleAllocation_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "DriverShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftVehicleAllocation" ADD CONSTRAINT "ShiftVehicleAllocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ShiftVehicleAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "InspectionChecklistVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDefect" ADD CONSTRAINT "VehicleDefect_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDefect" ADD CONSTRAINT "VehicleDefect_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "VehicleInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDefect" ADD CONSTRAINT "VehicleDefect_recheckInspectionId_fkey" FOREIGN KEY ("recheckInspectionId") REFERENCES "VehicleInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationAssessment" ADD CONSTRAINT "AllocationAssessment_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ShiftVehicleAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enrolled jobs have one active assignment per requested bus slot.
CREATE UNIQUE INDEX "Assignment_active_job_slot" ON "Assignment" ("jobId", "slotIndex")
WHERE "shiftId" IS NOT NULL AND "status" <> 'CANCELLED';
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_positive_window" CHECK ("endAt" > "startAt");
ALTER TABLE "ShiftVehicleAllocation" ADD CONSTRAINT "Allocation_positive_window" CHECK ("endAt" >= "effectiveAt");
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shift_slot_required" CHECK ("shiftId" IS NULL OR ("slotIndex" IS NOT NULL AND "slotIndex" >= 0 AND "driverId" IS NOT NULL));

-- AddForeignKey
ALTER TABLE "RateCardVersion" ADD CONSTRAINT "RateCardVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RoutingProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteEstimate" ADD CONSTRAINT "QuoteEstimate_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
