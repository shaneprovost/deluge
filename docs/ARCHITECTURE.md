# Deluge - Architecture & Data Contracts

## Overview

Deluge is a prayer tracking application that connects users with deceased clergy and religious of the Atlanta Archdiocese. Users anonymously offer prayers for the deceased, and the application visualizes prayer coverage across cemeteries on a map.

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14 (App Router) | SSR, API routes, easy auth integration later |
| Hosting | Vercel (Free Tier) | Zero-config deploys, edge functions |
| Database | DynamoDB | Free tier generous, scales infinitely, you know it well |
| Maps | Mapbox GL JS | 50k free loads/month, beautiful styling |
| Future Auth | AWS Cognito or NextAuth | When accounts are needed |

---

## Entity Definitions

### DeceasedPerson

Represents a deceased member of clergy or religious order.

```typescript
interface DeceasedPerson {
  // ===== Identity =====
  personId: string;              // UUID v4, Primary Key
  firstName: string;             // "John"
  lastInitial: string;           // "D"
  yearOfDeath: number;           // 1987
  role: PersonRole;              // Enum: priest | bishop | religious | layperson
  
  // ===== Location (Denormalized) =====
  cemeteryId: string;            // FK to Cemetery
  cemeteryName: string;          // "Holy Spirit Cemetery" - denormalized for display
  
  // ===== Metadata =====
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  deletedAt?: string;            // ISO 8601 timestamp, null if active (soft delete)
  
  // ===== Computed (Updated via DynamoDB Stream → Lambda) =====
  prayerCount: number;           // Total prayers offered for this person
  lastPrayedAt?: string;         // ISO 8601 timestamp, null if never prayed for
}

type PersonRole = 'priest' | 'bishop' | 'religious' | 'layperson';
```

### Cemetery

Represents a cemetery location within the archdiocese.

```typescript
interface Cemetery {
  // ===== Identity =====
  cemeteryId: string;            // UUID v4, Primary Key
  name: string;                  // "Holy Spirit Cemetery"
  
  // ===== Location =====
  address?: string;              // Street address (optional)
  city: string;                  // "Atlanta"
  state: string;                 // "GA"
  zipCode?: string;              // "30301"
  latitude: number;              // 33.7490
  longitude: number;             // -84.3880
  
  // ===== Diocese Context =====
  archdiocese: string;           // "Atlanta"
  
  // ===== Metadata =====
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  deletedAt?: string;            // ISO 8601 timestamp (soft delete)
  
  // ===== Computed (Updated via DynamoDB Stream → Lambda) =====
  totalDeceased: number;         // Count of people in this cemetery
  totalPrayers: number;          // Aggregate prayers for all people here
  uniquePrayedFor: number;       // Count of people prayed for at least once
}
```

### Prayer

Represents a single prayer offering event.

```typescript
interface Prayer {
  // ===== Identity =====
  prayerId: string;              // UUID v4, Primary Key
  
  // ===== Relationships (Denormalized) =====
  personId: string;              // FK to DeceasedPerson
  cemeteryId: string;            // Denormalized for aggregation queries
  
  // ===== Prayer Details =====
  prayerType: PrayerType;        // Type of prayer offered
  
  // ===== Metadata =====
  createdAt: string;             // ISO 8601 timestamp
  deletedAt?: string;            // ISO 8601 timestamp (soft delete)
  
  // ===== Abuse Prevention (Anonymous-friendly) =====
  sessionId?: string;            // Browser fingerprint or session token
  ipAddressHash?: string;        // SHA-256 hash of IP (privacy-preserving)
  userAgent?: string;            // For bot detection patterns
  
  // ===== Future Extensibility =====
  userId?: string;               // Null for anonymous, populated when auth added
  metadata?: Record<string, any>; // For future features (intentions, notes)
}

type PrayerType = 
  | 'our_father'
  | 'hail_mary'
  | 'decade_rosary'
  | 'full_rosary'
  | 'mass'
  | 'divine_mercy_chaplet'       // Future
  | 'other';                     // Extensibility
```

### AssignmentPriority

Lightweight table for efficient person assignment queries.

```typescript
interface AssignmentPriority {
  // ===== Identity =====
  personId: string;              // PK, same as DeceasedPerson.personId
  
  // ===== Priority Data =====
  prayerCount: number;           // Mirrors DeceasedPerson.prayerCount
  lastPrayedAt?: string;         // ISO 8601 timestamp
  
  // ===== Denormalized for Filtering =====
  cemeteryId: string;            // For potential cemetery-specific assignment
  role: PersonRole;              // For potential role-specific assignment
  
  // ===== Active Status =====
  isActive: boolean;             // False if person soft-deleted
}
```

### RateLimitEntry

Tracks request rates for abuse prevention.

```typescript
interface RateLimitEntry {
  // ===== Identity =====
  identifier: string;            // PK: "session:{sessionId}" or "ip:{ipHash}"
  windowStart: string;           // SK: ISO 8601 timestamp (truncated to hour)
  
  // ===== Counters =====
  requestCount: number;          // Number of prayers in this window
  
  // ===== TTL =====
  expiresAt: number;             // Unix timestamp for DynamoDB TTL (auto-delete)
}
```

---

## DynamoDB Table Designs

### Table: `deluge-deceased`

| Attribute | Type | Description |
|-----------|------|-------------|
| `PK` | String | `PERSON#{personId}` |
| `SK` | String | `METADATA` |
| All DeceasedPerson fields | - | Stored as top-level attributes |

**Global Secondary Indexes:**

| Index Name | PK | SK | Projection | Purpose |
|------------|----|----|------------|---------|
| `cemetery-index` | `cemeteryId` | `personId` | ALL | List all deceased at a cemetery |
| `role-index` | `role` | `personId` | KEYS_ONLY | Filter by role if needed |

### Table: `deluge-cemeteries`

| Attribute | Type | Description |
|-----------|------|-------------|
| `PK` | String | `CEMETERY#{cemeteryId}` |
| `SK` | String | `METADATA` |
| All Cemetery fields | - | Stored as top-level attributes |

**Global Secondary Indexes:**

| Index Name | PK | SK | Projection | Purpose |
|------------|----|----|------------|---------|
| `archdiocese-index` | `archdiocese` | `cemeteryId` | ALL | List all cemeteries in archdiocese |

### Table: `deluge-prayers`

| Attribute | Type | Description |
|-----------|------|-------------|
| `PK` | String | `PRAYER#{prayerId}` |
| `SK` | String | `METADATA` |
| All Prayer fields | - | Stored as top-level attributes |

**Global Secondary Indexes:**

| Index Name | PK | SK | Projection | Purpose |
|------------|----|----|------------|---------|
| `person-prayers-index` | `personId` | `createdAt` | ALL | Get all prayers for a person |
| `cemetery-prayers-index` | `cemeteryId` | `createdAt` | KEYS_ONLY | Recent prayers at cemetery |

**DynamoDB Stream:** Enabled (NEW_IMAGE) → Triggers Lambda for computed field updates

### Table: `deluge-assignment-priority`

| Attribute | Type | Description |
|-----------|------|-------------|
| `PK` | String | `PERSON#{personId}` |
| `prayerCount` | Number | For sorting/filtering |
| `isActive` | Boolean | Filter out soft-deleted |

**Note:** This table is scanned with filters for MVP. At scale, migrate to Redis sorted set.

### Table: `deluge-rate-limits`

| Attribute | Type | Description |
|-----------|------|-------------|
| `PK` | String | `identifier` (session or IP hash) |
| `SK` | String | `windowStart` (hourly bucket) |
| `requestCount` | Number | Counter |
| `expiresAt` | Number | TTL attribute |

**TTL:** Enabled on `expiresAt` attribute (auto-cleanup)

---

## Access Patterns

### Read Patterns

| Pattern | Table | Query | Index |
|---------|-------|-------|-------|
| Get person by ID | deceased | PK = `PERSON#{id}` | - |
| List people at cemetery | deceased | cemeteryId = X | cemetery-index |
| Get cemetery by ID | cemeteries | PK = `CEMETERY#{id}` | - |
| List all cemeteries | cemeteries | archdiocese = "Atlanta" | archdiocese-index |
| Get prayers for person | prayers | personId = X | person-prayers-index |
| Get assignment candidates | assignment-priority | Scan, filter prayerCount < N, isActive = true | - |
| Check rate limit | rate-limits | PK = identifier, SK = windowStart | - |

### Write Patterns

| Pattern | Table | Operation |
|---------|-------|-----------|
| Create person | deceased | PutItem |
| Record prayer | prayers | PutItem → Stream → Lambda |
| Update computed fields | deceased, cemeteries | UpdateItem (atomic increment) |
| Update assignment priority | assignment-priority | PutItem (upsert) |
| Increment rate limit | rate-limits | UpdateItem (atomic ADD) |

---

## Event Flow: Prayer Submission

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Client    │────▶│  API Route  │────▶│  Rate Limit     │
│  (Browser)  │     │ /api/pray   │     │  Check          │
└─────────────┘     └─────────────┘     └────────┬────────┘
                                                  │
                                                  ▼
                    ┌─────────────────────────────────────┐
                    │         DynamoDB: prayers           │
                    │         (PutItem)                   │
                    └────────────────┬────────────────────┘
                                     │
                                     ▼ DynamoDB Stream
                    ┌─────────────────────────────────────┐
                    │      Lambda: updateAggregates       │
                    │                                     │
                    │  1. Increment DeceasedPerson.       │
                    │     prayerCount                     │
                    │  2. Update DeceasedPerson.          │
                    │     lastPrayedAt                    │
                    │  3. Increment Cemetery.             │
                    │     totalPrayers                    │
                    │  4. Update Cemetery.                │
                    │     uniquePrayedFor (if first)      │
                    │  5. Update AssignmentPriority       │
                    └─────────────────────────────────────┘
```

---

## Assignment Algorithm

### MVP Implementation (In-Memory Cache + DynamoDB Scan)

```typescript
// Pseudocode for person assignment

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let candidateCache: { personId: string; prayerCount: number }[] = [];
let cacheTimestamp: number = 0;

async function getPersonToAssign(): Promise<DeceasedPerson> {
  // Refresh cache if stale
  if (Date.now() - cacheTimestamp > CACHE_TTL_MS || candidateCache.length < 10) {
    candidateCache = await scanLowPrayerCountPeople(limit: 50);
    cacheTimestamp = Date.now();
  }
  
  // 70% chance: pick from least-prayed-for
  // 30% chance: pick randomly from cache (allows repeat prayers)
  const useLowest = Math.random() < 0.7;
  
  if (useLowest) {
    // Sort by prayerCount, pick from bottom 10
    const sorted = candidateCache.sort((a, b) => a.prayerCount - b.prayerCount);
    const candidates = sorted.slice(0, 10);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    return getPersonById(selected.personId);
  } else {
    // Random from full cache
    const selected = candidateCache[Math.floor(Math.random() * candidateCache.length)];
    return getPersonById(selected.personId);
  }
}
```

### Migration Path to Redis

When scan performance degrades (~1000+ records):

1. Provision ElastiCache Redis cluster
2. Backfill: `ZADD deceased:priority {prayerCount} {personId}`
3. Update Lambda to dual-write to DynamoDB + Redis
4. Update assignment API: `ZRANGEBYSCORE deceased:priority 0 5 LIMIT 0 10`
5. Remove in-memory cache logic

---

## Rate Limiting Strategy

### Rules
- Max 20 prayers per session per hour
- Max 50 prayers per IP per hour
- 30-second cooldown between prayers (enforced client-side + server-side)

### Implementation

```typescript
async function checkRateLimit(sessionId: string, ipHash: string): Promise<boolean> {
  const hourBucket = new Date().toISOString().slice(0, 13); // "2024-01-15T14"
  
  // Check both session and IP limits
  const [sessionCount, ipCount] = await Promise.all([
    getRateLimitCount(`session:${sessionId}`, hourBucket),
    getRateLimitCount(`ip:${ipHash}`, hourBucket),
  ]);
  
  if (sessionCount >= 20 || ipCount >= 50) {
    return false; // Rate limited
  }
  
  // Increment counters
  await Promise.all([
    incrementRateLimit(`session:${sessionId}`, hourBucket),
    incrementRateLimit(`ip:${ipHash}`, hourBucket),
  ]);
  
  return true;
}
```

---

## Soft Delete Strategy

All entities support soft deletion via `deletedAt` field.

### Query Filtering
- All read operations include filter: `deletedAt IS NULL` or `attribute_not_exists(deletedAt)`
- GSI projections include `deletedAt` for efficient filtering

### Restoration
- Admin API can restore by setting `deletedAt = null`
- Audit log (future) would track delete/restore events

---

## Future Migration Paths

| Component | MVP | Optimal | Migration Lift | Trigger Point |
|-----------|-----|---------|----------------|---------------|
| Computed fields | DynamoDB Stream → Lambda | EventBridge + consumers | Medium | Complex aggregations needed |
| Assignment queue | DynamoDB scan + cache | Redis sorted set | Small | >1000 deceased records |
| Rate limiting | DynamoDB counters | Redis with TTL | Small | High traffic spikes |
| Authentication | Anonymous only | Cognito/NextAuth | Medium | User requests accounts |
| Analytics | Basic counters | EventBridge → S3 → Athena | Medium | Reporting needs |

---

## Security Considerations

### Data Privacy
- No PII stored (only first name, last initial of deceased)
- IP addresses stored as SHA-256 hashes only
- Session IDs are ephemeral browser fingerprints

### Abuse Prevention
- Rate limiting per session and IP
- 30-second cooldown between prayers
- Bot detection via User-Agent analysis (future)
- Manual review capability via soft-delete

### Infrastructure
- All data encrypted at rest (DynamoDB default)
- HTTPS only (Vercel default)
- No public access to DynamoDB (IAM-based access)
