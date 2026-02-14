// ============================================================================
// ENUMS
// ============================================================================

export type PersonRole = "priest" | "bishop" | "religious" | "layperson";

export type PrayerType =
  | "our_father"
  | "hail_mary"
  | "decade_rosary"
  | "full_rosary"
  | "mass"
  | "divine_mercy_chaplet"
  | "other";

export const PRAYER_TYPE_LABELS: Record<PrayerType, string> = {
  our_father: "Our Father",
  hail_mary: "Hail Mary",
  decade_rosary: "Decade of the Rosary",
  full_rosary: "Full Rosary",
  mass: "Mass Offering",
  divine_mercy_chaplet: "Divine Mercy Chaplet",
  other: "Other Prayer",
};

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  priest: "Priest",
  bishop: "Bishop",
  religious: "Religious",
  layperson: "Layperson",
};

// ============================================================================
// DOMAIN ENTITIES
// ============================================================================

export interface DeceasedPerson {
  personId: string;
  firstName: string;
  lastInitial: string;
  yearOfDeath: number;
  role: PersonRole;
  cemeteryId: string;
  cemeteryName: string;
  prayerCount: number;
  lastPrayedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Cemetery {
  cemeteryId: string;
  name: string;
  address: string | null;
  city: string;
  state: string;
  zipCode: string | null;
  latitude: number;
  longitude: number;
  archdiocese: string;
  totalDeceased: number;
  totalPrayers: number;
  uniquePrayedFor: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Prayer {
  prayerId: string;
  personId: string;
  cemeteryId: string;
  prayerType: PrayerType;
  sessionId: string | null;
  ipAddressHash: string | null;
  userAgent: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface AssignmentPriority {
  personId: string;
  prayerCount: number;
  lastPrayedAt: string | null;
  cemeteryId: string;
  role: PersonRole;
  isActive: boolean;
}

export interface RateLimitEntry {
  identifier: string;
  windowStart: string;
  requestCount: number;
  expiresAt: number;
}

// ============================================================================
// API REQUEST TYPES
// ============================================================================

export interface PrayRequest {
  personId: string;
  prayerType: PrayerType;
}

export interface CreateDeceasedRequest {
  firstName: string;
  lastInitial: string;
  yearOfDeath: number;
  role: PersonRole;
  cemeteryId: string;
}

export interface CreateCemeteryRequest {
  name: string;
  address?: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
  archdiocese: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ValidationError[];
  retryAfterSeconds?: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PERSON_NOT_FOUND"
  | "CEMETERY_NOT_FOUND"
  | "RATE_LIMITED"
  | "NO_CANDIDATES"
  | "INTERNAL_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN";

export interface AssignResponse {
  personId: string;
  firstName: string;
  lastInitial: string;
  yearOfDeath: number;
  role: PersonRole;
  cemetery: {
    cemeteryId: string;
    name: string;
    city: string;
    state: string;
  };
}

export interface PrayResponse {
  prayerId: string;
  personId: string;
  prayerType: PrayerType;
  createdAt: string;
}

export interface PrayResponseMeta {
  cooldownSeconds: number;
  canRequestNewAssignmentAt: string;
}

export interface CemeteryWithStats {
  cemeteryId: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  stats: CemeteryStats;
}

export interface CemeteryStats {
  totalDeceased: number;
  uniquePrayedFor: number;
  totalPrayers: number;
  coveragePercent: number;
}

export interface CemeteryDetailResponse extends CemeteryWithStats {
  address: string | null;
  zipCode: string | null;
  archdiocese: string;
  recentActivity: RecentPrayerActivity[];
}

export interface RecentPrayerActivity {
  prayerType: PrayerType;
  createdAt: string;
}

export interface GlobalStats {
  totalDeceased: number;
  totalPrayers: number;
  uniquePrayedFor: number;
  coveragePercent: number;
  totalCemeteries: number;
  prayersByType: Record<PrayerType, number>;
  recentActivity: GlobalRecentActivity[];
}

export interface GlobalRecentActivity {
  cemeteryName: string;
  prayerType: PrayerType;
  createdAt: string;
}

// ============================================================================
// DYNAMODB TYPES
// ============================================================================

export interface DeceasedDynamoItem {
  PK: string;
  SK: string;
  personId: string;
  firstName: string;
  lastInitial: string;
  yearOfDeath: number;
  role: PersonRole;
  cemeteryId: string;
  cemeteryName: string;
  prayerCount: number;
  lastPrayedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CemeteryDynamoItem {
  PK: string;
  SK: string;
  cemeteryId: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude: number;
  longitude: number;
  archdiocese: string;
  totalDeceased: number;
  totalPrayers: number;
  uniquePrayedFor: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PrayerDynamoItem {
  PK: string;
  SK: string;
  prayerId: string;
  personId: string;
  cemeteryId: string;
  prayerType: PrayerType;
  sessionId?: string;
  ipAddressHash?: string;
  userAgent?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  deletedAt?: string;
}

export interface AssignmentPriorityDynamoItem {
  PK: string;
  personId: string;
  prayerCount: number;
  lastPrayedAt?: string;
  cemeteryId: string;
  role: PersonRole;
  isActive: boolean;
}

export interface RateLimitDynamoItem {
  PK: string;
  SK: string;
  requestCount: number;
  expiresAt: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type CreateDeceasedPerson = Omit<
  DeceasedPerson,
  | "personId"
  | "prayerCount"
  | "lastPrayedAt"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>;

export type CreateCemetery = Omit<
  Cemetery,
  | "cemeteryId"
  | "totalDeceased"
  | "totalPrayers"
  | "uniquePrayedFor"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>;

export type CreatePrayer = Pick<Prayer, "personId" | "cemeteryId" | "prayerType"> & {
  sessionId?: string;
  ipAddressHash?: string;
  userAgent?: string;
};

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isPrayerType(value: string): value is PrayerType {
  return [
    "our_father",
    "hail_mary",
    "decade_rosary",
    "full_rosary",
    "mass",
    "divine_mercy_chaplet",
    "other",
  ].includes(value);
}

export function isPersonRole(value: string): value is PersonRole {
  return ["priest", "bishop", "religious", "layperson"].includes(value);
}
