export interface ProposedAssignment {
  jobId: number;
  jobStartLocation?: string | null;
  jobEndLocation?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  driverId: number;
  driverName: string;
  vehicleId?: number;
  vehicleName?: string | null;
  travelFromLocation?: string;
  travelToMinutes?: number;
  travelToKm?: number;
  bufferMinutes?: number;
}
export interface SkippedJob {
  jobId: number;
  jobStartLocation?: string | null;
  reason: string;
}
export interface AutoSchedulePreview {
  preview: true;
  date: string;
  proposed: ProposedAssignment[];
  skipped: SkippedJob[];
  totalJobs: number;
  assignableCount: number;
  skippedCount: number;
}
export interface DriverLoad {
  driverId: number;
  weeklyHours: number;
  weeklyEarnings: number;
}
