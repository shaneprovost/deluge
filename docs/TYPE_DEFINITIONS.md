# Deluge - TypeScript Type Definitions

These types serve as the single source of truth for all data contracts across the application.

## Core Domain Types

```typescript
// ============================================================================
// ENUMS
// ============================================================================

/**
 * Role of the deceased person within the church
 */
export type PersonRole = 'priest' | 'bishop' | 'religious' | 'layperson';

/**
 * Types of prayers that can be offered
 * Extensible for future prayer types
 */
export type PrayerType =
  | 'our_father'
  | 'hail_mary'
  | 'decade_rosary'
  | 'full_rosary'
  | 'mass'
  | 'divine_mercy_chaplet'
  | 'other';

/**
 * Human-readable labels for prayer types
 */
export const PRAYER_TYPE_LABELS: Record<PrayerType, string> = {
  our_father: 'Our Father',
  hail_mary: 'Hail Mary',
  decade_rosary: 'Decade of the Rosary',
  full_rosary: 'Full Rosary',
  mass: 'Mass Offering',
  divine_mercy_chaplet: 'Divine Mercy Chaplet',
  other: 'Other Prayer',
};

/**
 * Human-readable labels for person roles
 */
export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  priest: 'Priest',
  bishop: 'Bishop',
  religious: 'Religious',
  layperson: 'Layperson',
};

// ============================================================================
// DOMAIN ENTITIES
// ============================================================================

/**
 * Deceased person record
 * Represents clergy/religious in the database
 */
export interface DeceasedPerson {
  // Identity
  personId: string;
  firstName: string;
  lastInitial: string;
  yearOfDeath: number;
  role: PersonRole;

  // Location (denormalized)
  cemeteryId: string;
  cemeteryName: string;

  // Computed fields (updated via events)
  prayerCount: number;
  lastPrayedAt: string | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Cemetery location record
 */
export interface Cemetery {
  // Identity
  cemeteryId: string;
  name: string;

  // Location
  address: string | null;
  city: string;
  state: string;
  zipCode: string | null;
  latitude: number;
  longitude: number;

  // Diocese context
  archdiocese: string;

  // Computed fields
  totalDeceased: number;
  totalPrayers: number;
  uniquePrayedFor: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Prayer record (event log)
 */
export interface Prayer {
  // Identity
  prayerId: string;

  // Relationships
  personId: string;
  cemeteryId: string;

  // Prayer details
  prayerType: PrayerType;

  // Abuse prevention
  sessionId: string | null;
  ipAddressHash: string | null;
  userAgent: string | null;

  // Future extensibility
  userId: string | null;
  metadata: Record<string, unknown> | null;

  // Metadata
  createdAt: string;
  deletedAt: string | null;
}

/**
 * Assignment priority record
 * Lightweight table for efficient assignment queries
 */
export interface AssignmentPriority {
  personId: string;
  prayerCount: number;
  lastPrayedAt: string | null;
  cemeteryId: string;
  role: PersonRole;
  isActive: boolean;
}

/**
 * Rate limit entry
 */
export interface RateLimitEntry {
  identifier: string;
  windowStart: string;
  requestCount: number;
  expiresAt: number;
}

// ============================================================================
// API REQUEST TYPES
// ============================================================================

/**
 * Request body for POST /api/pray
 */
export interface PrayRequest {
  personId: string;
  prayerType: PrayerType;
}

/**
 * Request body for POST /api/admin/deceased
 */
export interface CreateDeceasedRequest {
  firstName: string;
  lastInitial: string;
  yearOfDeath: number;
  role: PersonRole;
  cemeteryId: string;
}

/**
 * Request body for POST /api/admin/cemeteries
 */
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

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
}

/**
 * Standard API error structure
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ValidationError[];
}

/**
 * Validation error detail
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Standard error codes
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'PERSON_NOT_FOUND'
  | 'CEMETERY_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NO_CANDIDATES'
  | 'INTERNAL_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

/**
 * Response for GET /api/assign
 */
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

/**
 * Response for POST /api/pray
 */
export interface PrayResponse {
  prayerId: string;
  personId: string;
  prayerType: PrayerType;
  createdAt: string;
}

/**
 * Prayer response metadata
 */
export interface PrayResponseMeta {
  cooldownSeconds: number;
  canRequestNewAssignmentAt: string;
}

/**
 * Cemetery with stats for map display
 */
export interface CemeteryWithStats {
  cemeteryId: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  stats: CemeteryStats;
}

/**
 * Cemetery statistics
 */
export interface CemeteryStats {
  totalDeceased: number;
  uniquePrayedFor: number;
  totalPrayers: number;
  coveragePercent: number;
}

/**
 * Detailed cemetery response
 */
export interface CemeteryDetailResponse extends CemeteryWithStats {
  address: string | null;
  zipCode: string | null;
  archdiocese: string;
  recentActivity: RecentPrayerActivity[];
}

/**
 * Recent prayer activity (anonymized)
 */
export interface RecentPrayerActivity {
  prayerType: PrayerType;
  createdAt: string;
}

/**
 * Global statistics response
 */
export interface GlobalStats {
  totalDeceased: number;
  totalPrayers: number;
  uniquePrayedFor: number;
  coveragePercent: number;
  totalCemeteries: number;
  prayersByType: Record<PrayerType, number>;
  recentActivity: GlobalRecentActivity[];
}

/**
 * Global recent activity item
 */
export interface GlobalRecentActivity {
  cemeteryName: string;
  prayerType: PrayerType;
  createdAt: string;
}

// ============================================================================
// DYNAMODB TYPES
// ============================================================================

/**
 * DynamoDB item for deceased person
 */
export interface DeceasedDynamoItem {
  PK: string; // PERSON#{personId}
  SK: string; // METADATA
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

/**
 * DynamoDB item for cemetery
 */
export interface CemeteryDynamoItem {
  PK: string; // CEMETERY#{cemeteryId}
  SK: string; // METADATA
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

/**
 * DynamoDB item for prayer
 */
export interface PrayerDynamoItem {
  PK: string; // PRAYER#{prayerId}
  SK: string; // METADATA
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

/**
 * DynamoDB item for assignment priority
 */
export interface AssignmentPriorityDynamoItem {
  PK: string; // PERSON#{personId}
  personId: string;
  prayerCount: number;
  lastPrayedAt?: string;
  cemeteryId: string;
  role: PersonRole;
  isActive: boolean;
}

/**
 * DynamoDB item for rate limit
 */
export interface RateLimitDynamoItem {
  PK: string; // {type}:{identifier}
  SK: string; // {hourBucket}
  requestCount: number;
  expiresAt: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Create type (omit computed and system fields)
 */
export type CreateDeceasedPerson = Omit<
  DeceasedPerson,
  'personId' | 'prayerCount' | 'lastPrayedAt' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/**
 * Create type for cemetery
 */
export type CreateCemetery = Omit<
  Cemetery,
  'cemeteryId' | 'totalDeceased' | 'totalPrayers' | 'uniquePrayedFor' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/**
 * Create type for prayer
 */
export type CreatePrayer = Pick<Prayer, 'personId' | 'cemeteryId' | 'prayerType'> & {
  sessionId?: string;
  ipAddressHash?: string;
  userAgent?: string;
};

/**
 * Coordinates for map
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Map bounds
 */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ============================================================================
// VALIDATION SCHEMAS (Zod-style for reference)
// ============================================================================

/**
 * Validation rules for PrayRequest
 * - personId: UUID v4 format
 * - prayerType: One of valid PrayerType values
 */

/**
 * Validation rules for CreateDeceasedRequest
 * - firstName: 1-50 characters, letters only
 * - lastInitial: Single letter A-Z
 * - yearOfDeath: 1800-current year
 * - role: One of valid PersonRole values
 * - cemeteryId: UUID v4 format, must exist
 */

/**
 * Validation rules for CreateCemeteryRequest
 * - name: 1-100 characters
 * - city: 1-50 characters
 * - state: 2 character state code
 * - latitude: -90 to 90
 * - longitude: -180 to 180
 * - archdiocese: 1-50 characters
 */
```

## Usage in Application

### Import Types

```typescript
// In any TypeScript file
import type {
  DeceasedPerson,
  Cemetery,
  Prayer,
  PrayRequest,
  ApiResponse,
  CemeteryWithStats,
} from '@/types';
```

### Type Guards

```typescript
// Type guard for PrayerType
export function isPrayerType(value: string): value is PrayerType {
  return [
    'our_father',
    'hail_mary',
    'decade_rosary',
    'full_rosary',
    'mass',
    'divine_mercy_chaplet',
    'other',
  ].includes(value);
}

// Type guard for PersonRole
export function isPersonRole(value: string): value is PersonRole {
  return ['priest', 'bishop', 'religious', 'layperson'].includes(value);
}
```

### Runtime Validation (with Zod)

```typescript
import { z } from 'zod';

export const PrayRequestSchema = z.object({
  personId: z.string().uuid(),
  prayerType: z.enum([
    'our_father',
    'hail_mary',
    'decade_rosary',
    'full_rosary',
    'mass',
    'divine_mercy_chaplet',
    'other',
  ]),
});

export const CreateDeceasedRequestSchema = z.object({
  firstName: z.string().min(1).max(50).regex(/^[A-Za-z]+$/),
  lastInitial: z.string().length(1).regex(/^[A-Z]$/),
  yearOfDeath: z.number().int().min(1800).max(new Date().getFullYear()),
  role: z.enum(['priest', 'bishop', 'religious', 'layperson']),
  cemeteryId: z.string().uuid(),
});

export const CreateCemeteryRequestSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(200).optional(),
  city: z.string().min(1).max(50),
  state: z.string().length(2).regex(/^[A-Z]{2}$/),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  archdiocese: z.string().min(1).max(50),
});
```
