export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  paidCredits?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  paidCredits?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserUsage {
  userId: string;
  role: UserRole;
  totalTrips: number;
  freeLimit: number;
  freeRemaining: number;
  paidCredits: number;
  costPerItinerary: number;
  currency: string;
  canGenerate: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  adminSecret?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
