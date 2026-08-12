-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bookingType" TEXT NOT NULL DEFAULT 'one_way',
ADD COLUMN     "dropoffLat" DOUBLE PRECISION,
ADD COLUMN     "dropoffLng" DOUBLE PRECISION,
ADD COLUMN     "dropoffPlaceId" TEXT,
ADD COLUMN     "pickupLat" DOUBLE PRECISION,
ADD COLUMN     "pickupLng" DOUBLE PRECISION,
ADD COLUMN     "pickupPlaceId" TEXT,
ADD COLUMN     "recurrenceRule" JSONB,
ADD COLUMN     "returnDateTime" TIMESTAMP(3),
ADD COLUMN     "waitingDuration" INTEGER;

-- CreateIndex
CREATE INDEX "Booking_bookingType_idx" ON "Booking"("bookingType");
