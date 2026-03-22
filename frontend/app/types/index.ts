// Shared Types and Interfaces

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
