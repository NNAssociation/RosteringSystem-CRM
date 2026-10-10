-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerkId" TEXT;

-- CreateTable
CREATE TABLE "Notice" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeRevision" (
    "id" SERIAL NOT NULL,
    "noticeId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "audience" "EmployeeRole"[],
    "acknowledgementRequired" BOOLEAN NOT NULL DEFAULT false,
    "authorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeRecipient" (
    "id" SERIAL NOT NULL,
    "revisionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "snapshot" BOOLEAN NOT NULL DEFAULT true,
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "immediateAction" TEXT NOT NULL DEFAULT '',
    "unsafeVehicle" BOOLEAN NOT NULL DEFAULT false,
    "fleetDecision" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reporterId" INTEGER NOT NULL,
    "ownerId" INTEGER,
    "dueAt" TIMESTAMP(3),
    "resolution" TEXT,
    "duplicateOfId" INTEGER,
    "vehicleId" INTEGER,
    "bookingId" INTEGER,
    "jobId" INTEGER,
    "assignmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentUpdate" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "officeOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAction" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostPropertyReport" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "identifyingDetails" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reporterId" INTEGER NOT NULL,
    "ownerId" INTEGER,
    "vehicleId" INTEGER,
    "bookingId" INTEGER,
    "jobId" INTEGER,
    "customerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostPropertyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyClaimant" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PropertyClaimant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoundPropertyItem" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "identifyingDetails" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FOUND',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reporterId" INTEGER NOT NULL,
    "ownerId" INTEGER,
    "custodianId" INTEGER NOT NULL,
    "storageLocation" TEXT NOT NULL,
    "depotId" INTEGER,
    "vehicleId" INTEGER,
    "bookingId" INTEGER,
    "jobId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoundPropertyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMatch" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "previousItemStatus" TEXT NOT NULL,
    "actorId" INTEGER NOT NULL,
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyCustodyEvent" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "fromCustodianId" INTEGER,
    "toCustodianId" INTEGER,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyCustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "uploaderId" INTEGER NOT NULL,
    "noticeId" INTEGER,
    "incidentId" INTEGER,
    "updateId" INTEGER,
    "reportId" INTEGER,
    "itemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_status_publishAt_idx" ON "Notice"("status", "publishAt");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeRevision_noticeId_revision_key" ON "NoticeRevision"("noticeId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeRecipient_revisionId_userId_key" ON "NoticeRecipient"("revisionId", "userId");

-- CreateIndex
CREATE INDEX "Incident_status_createdAt_idx" ON "Incident"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_reporterId_idx" ON "Incident"("reporterId");

-- CreateIndex
CREATE INDEX "Incident_ownerId_dueAt_idx" ON "Incident"("ownerId", "dueAt");

-- CreateIndex
CREATE INDEX "Incident_vehicleId_occurredAt_idx" ON "Incident"("vehicleId", "occurredAt");

-- CreateIndex
CREATE INDEX "Incident_bookingId_idx" ON "Incident"("bookingId");

-- CreateIndex
CREATE INDEX "Incident_jobId_idx" ON "Incident"("jobId");

-- CreateIndex
CREATE INDEX "LostPropertyReport_status_occurredAt_idx" ON "LostPropertyReport"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "LostPropertyReport_reporterId_idx" ON "LostPropertyReport"("reporterId");

-- CreateIndex
CREATE INDEX "LostPropertyReport_ownerId_idx" ON "LostPropertyReport"("ownerId");

-- CreateIndex
CREATE INDEX "LostPropertyReport_vehicleId_occurredAt_idx" ON "LostPropertyReport"("vehicleId", "occurredAt");

-- CreateIndex
CREATE INDEX "LostPropertyReport_bookingId_idx" ON "LostPropertyReport"("bookingId");

-- CreateIndex
CREATE INDEX "LostPropertyReport_jobId_idx" ON "LostPropertyReport"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyClaimant_reportId_key" ON "PropertyClaimant"("reportId");

-- CreateIndex
CREATE INDEX "FoundPropertyItem_status_occurredAt_idx" ON "FoundPropertyItem"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "FoundPropertyItem_reporterId_idx" ON "FoundPropertyItem"("reporterId");

-- CreateIndex
CREATE INDEX "FoundPropertyItem_ownerId_idx" ON "FoundPropertyItem"("ownerId");

-- CreateIndex
CREATE INDEX "FoundPropertyItem_vehicleId_occurredAt_idx" ON "FoundPropertyItem"("vehicleId", "occurredAt");

-- CreateIndex
CREATE INDEX "FoundPropertyItem_bookingId_idx" ON "FoundPropertyItem"("bookingId");

-- CreateIndex
CREATE INDEX "FoundPropertyItem_jobId_idx" ON "FoundPropertyItem"("jobId");

-- CreateIndex
CREATE INDEX "PropertyMatch_itemId_active_idx" ON "PropertyMatch"("itemId", "active");

-- CreateIndex
CREATE INDEX "PropertyMatch_reportId_active_idx" ON "PropertyMatch"("reportId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_state_createdAt_idx" ON "Attachment"("state", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_noticeId_idx" ON "Attachment"("noticeId");

-- CreateIndex
CREATE INDEX "Attachment_incidentId_idx" ON "Attachment"("incidentId");

-- CreateIndex
CREATE INDEX "Attachment_updateId_idx" ON "Attachment"("updateId");

-- CreateIndex
CREATE INDEX "Attachment_reportId_idx" ON "Attachment"("reportId");

-- CreateIndex
CREATE INDEX "Attachment_itemId_idx" ON "Attachment"("itemId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRevision" ADD CONSTRAINT "NoticeRevision_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRevision" ADD CONSTRAINT "NoticeRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "NoticeRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPropertyReport" ADD CONSTRAINT "LostPropertyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPropertyReport" ADD CONSTRAINT "LostPropertyReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPropertyReport" ADD CONSTRAINT "LostPropertyReport_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPropertyReport" ADD CONSTRAINT "LostPropertyReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPropertyReport" ADD CONSTRAINT "LostPropertyReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPropertyReport" ADD CONSTRAINT "LostPropertyReport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyClaimant" ADD CONSTRAINT "PropertyClaimant_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LostPropertyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundPropertyItem" ADD CONSTRAINT "FoundPropertyItem_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundPropertyItem" ADD CONSTRAINT "FoundPropertyItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundPropertyItem" ADD CONSTRAINT "FoundPropertyItem_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundPropertyItem" ADD CONSTRAINT "FoundPropertyItem_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundPropertyItem" ADD CONSTRAINT "FoundPropertyItem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundPropertyItem" ADD CONSTRAINT "FoundPropertyItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundPropertyItem" ADD CONSTRAINT "FoundPropertyItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LostPropertyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FoundPropertyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCustodyEvent" ADD CONSTRAINT "PropertyCustodyEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FoundPropertyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCustodyEvent" ADD CONSTRAINT "PropertyCustodyEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCustodyEvent" ADD CONSTRAINT "PropertyCustodyEvent_fromCustodianId_fkey" FOREIGN KEY ("fromCustodianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCustodyEvent" ADD CONSTRAINT "PropertyCustodyEvent_toCustodianId_fkey" FOREIGN KEY ("toCustodianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "IncidentUpdate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LostPropertyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FoundPropertyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A single active match per physical item and missing-item report.
CREATE UNIQUE INDEX "PropertyMatch_active_item" ON "PropertyMatch" ("itemId") WHERE "active" = true;
CREATE UNIQUE INDEX "PropertyMatch_active_report" ON "PropertyMatch" ("reportId") WHERE "active" = true;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_one_parent" CHECK (num_nonnulls("noticeId", "incidentId", "updateId", "reportId", "itemId") = 1);
