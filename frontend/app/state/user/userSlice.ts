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
