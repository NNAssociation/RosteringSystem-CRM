// Shared Types and Interfaces

export interface NavItem {
  name: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    strokeWidth?: number;
  }>;
  href: string;
  subItems?: { name: string; href: string }[];
}

export interface User {
  id: number;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  profile?: UserProfile;
  roles?: UserRole[];
}

export interface CreateUserRequest {
  email: string;
  name?: string;
  phone?: string;
  phoneNumber1?: string;
  phoneNumber2?: string;
  address?: string;
  licenseNumber?: string;
  driverLicense?: string;
  driverLicenseExpiry?: string;
  driverLicenseState?: string;
  dateOfBirth?: string;
  maxfatigueMinutes?: number;
  avatarUrl?: string;
  roleName?: string;
  status?: string;
}

export interface ApiResponseError {
  data?: {
    error?: string;
    message?: string;
  };
}

export interface UserProfile {
  id: number;
  address?: string;
  avatarUrl?: string;
  phoneNumber1?: string;
  phoneNumber2?: string;
  driverLicense?: string;
  driverLicenseExpiry?: string;
  driverLicenseState?: string;
  bankName?: string;
  bankBSB?: string;
  bankAccount?: string;
  taxFileNumber?: string;
  dateOfBirth?: string;
  occupation?: string;
  maxfatigueMinutes: number;
  userId: number;
}

export interface UserRole {
  userId: number;
  roleId: number;
  role?: Role;
}

export interface Role {
  id: number;
  roleName: string;
}

export interface Booking {
  id: number | string;
  customerName: string;
  customerEmail: string;
  subject?: string;
  bookingDetails?: string;
  pickupLocation: string;
  dropoffLocation: string;
  passengerCount?: number;
  noOfVehicles?: number;
  tripCount?: number;
  date: string;
  startTime: string;
  endTime?: string;
  endDate?: string;
  status: 'Confirmed' | 'Cancelled' | 'Pending' | string;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: number | string;
  name?: string;
  email: string;
  phoneNumber1?: string;
  phoneNumber2?: string;
  status?: 'Active' | 'Inactive' | 'On Trip' | string;
  driverLicense?: string;
  driverLicenseExpiry?: string;
  driverLicenseState?: string;
  bankName?: string;
  bankBSB?: string;
  bankAccount?: string;
  taxFileNumber?: string;
  dateOfBirth?: string;
  address?: string;
  avatarUrl?: string;
  occupation?: string;
  maxfatigueMinutes?: number;
  joinedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vehicle {
  id: number | string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  regoState: string;
  vin?: string;
  maxPassengers: number;
  maxCargoVolume?: number;
  status: 'Available' | 'Maintenance' | 'On Trip' | string;
  availableFrom?: string;
  availableTo?: string;
  homeDepotId?: number;
  assignedDriverId?: number;
  assignedDriver?: { id: number; name?: string; email: string };
  homeDepot?: { id: number; name: string; address?: string };
  fleetJobs?: Array<{
    jobId: number | string;
    job?: {
      status?: string;
      jobStartDateTime?: string;
      jobStartLocation?: string;
      jobEndLocation?: string;
    };
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: number | string;
  name?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone1?: string;
  phone2?: string;
  address?: string;
  company?: string;
  status?: 'Active' | 'Inactive' | string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Booking Flow Types ────────────────────────────────────

export type BookingCategory = 'one_way' | 'round_trip' | 'repeatable';
export type RepeatType = 'daily' | 'weekly' | 'monthly';

export interface StructuredLocation {
  address: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

export interface BookingFormData {
  // Category
  bookingType: BookingCategory;

  // Customer
  customerId?: number | string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;

  // Locations
  pickupLocation: StructuredLocation;
  dropLocation: StructuredLocation;

  // Schedule
  pickupDate: string;
  pickupTime: string;

  // Round Trip additions
  returnDate?: string;
  returnTime?: string;
  waitingDuration?: number; // minutes

  // Repeatable additions
  repeatType?: RepeatType;
  repeatDays?: number[]; // 0=Sun..6=Sat
  repeatStartDate?: string;
  repeatEndDate?: string;

  // Transport
  paxCount: number;
  busCount: number;

  // Estimation
  estimatedDuration?: number; // in minutes
  estimatedDistance?: string;
  calculatedEndTime?: string;

  // Notes
  notes?: string;
  subject?: string;
}

export interface CustomerSearchResult {
  id: number | string;
  name?: string;
  email: string;
  phone1?: string;
  company?: string;
}

