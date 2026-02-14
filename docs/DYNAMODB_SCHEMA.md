# Deluge - DynamoDB Schema

## Overview

This document defines the complete DynamoDB table schemas, including partition keys, sort keys, global secondary indexes, and access patterns.

## Table Naming Convention

- **Development:** `deluge-dev-{table}`
- **Staging:** `deluge-staging-{table}`
- **Production:** `deluge-prod-{table}`

---

## Table: `deluge-{env}-deceased`

Stores deceased clergy and religious persons.

### Schema

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `PK` | String | Partition Key | `PERSON#{personId}` |
| `SK` | String | Sort Key | `METADATA` |
| `personId` | String | - | UUID v4 |
| `firstName` | String | - | First name |
| `lastInitial` | String | - | Last initial |
| `yearOfDeath` | Number | - | Year of death |
| `role` | String | - | `priest` \| `bishop` \| `religious` \| `layperson` |
| `cemeteryId` | String | - | FK to cemetery |
| `cemeteryName` | String | - | Denormalized cemetery name |
| `prayerCount` | Number | - | Total prayers (computed) |
| `lastPrayedAt` | String | - | ISO timestamp (computed) |
| `createdAt` | String | - | ISO timestamp |
| `updatedAt` | String | - | ISO timestamp |
| `deletedAt` | String | - | ISO timestamp (soft delete, optional) |

### Global Secondary Indexes

#### GSI: `cemetery-index`
Query all deceased persons at a specific cemetery.

| Attribute | Key Type |
|-----------|----------|
| `cemeteryId` | Partition Key |
| `personId` | Sort Key |

**Projection:** ALL

**Access Pattern:**
```typescript
// Get all deceased at a cemetery
params = {
  TableName: 'deluge-prod-deceased',
  IndexName: 'cemetery-index',
  KeyConditionExpression: 'cemeteryId = :cemeteryId',
  FilterExpression: 'attribute_not_exists(deletedAt)',
  ExpressionAttributeValues: {
    ':cemeteryId': 'cemetery-uuid'
  }
}
```

#### GSI: `role-index`
Filter deceased persons by role (future use).

| Attribute | Key Type |
|-----------|----------|
| `role` | Partition Key |
| `personId` | Sort Key |

**Projection:** KEYS_ONLY

### Capacity

- **Billing Mode:** PAY_PER_REQUEST (on-demand)
- **Estimated reads:** ~100/day
- **Estimated writes:** ~50/day (mostly computed field updates)

---

## Table: `deluge-{env}-cemeteries`

Stores cemetery locations and aggregate statistics.

### Schema

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `PK` | String | Partition Key | `CEMETERY#{cemeteryId}` |
| `SK` | String | Sort Key | `METADATA` |
| `cemeteryId` | String | - | UUID v4 |
| `name` | String | - | Cemetery name |
| `address` | String | - | Street address (optional) |
| `city` | String | - | City |
| `state` | String | - | State code |
| `zipCode` | String | - | ZIP code (optional) |
| `latitude` | Number | - | Latitude coordinate |
| `longitude` | Number | - | Longitude coordinate |
| `archdiocese` | String | - | Archdiocese name |
| `totalDeceased` | Number | - | Count of deceased (computed) |
| `totalPrayers` | Number | - | Total prayers (computed) |
| `uniquePrayedFor` | Number | - | Unique deceased prayed for (computed) |
| `createdAt` | String | - | ISO timestamp |
| `updatedAt` | String | - | ISO timestamp |
| `deletedAt` | String | - | ISO timestamp (soft delete, optional) |

### Global Secondary Indexes

#### GSI: `archdiocese-index`
Query all cemeteries in an archdiocese.

| Attribute | Key Type |
|-----------|----------|
| `archdiocese` | Partition Key |
| `cemeteryId` | Sort Key |

**Projection:** ALL

**Access Pattern:**
```typescript
// Get all cemeteries in Atlanta archdiocese
params = {
  TableName: 'deluge-prod-cemeteries',
  IndexName: 'archdiocese-index',
  KeyConditionExpression: 'archdiocese = :archdiocese',
  FilterExpression: 'attribute_not_exists(deletedAt)',
  ExpressionAttributeValues: {
    ':archdiocese': 'Atlanta'
  }
}
```

### Capacity

- **Billing Mode:** PAY_PER_REQUEST
- **Estimated reads:** ~500/day (map loads)
- **Estimated writes:** ~50/day (computed field updates)

---

## Table: `deluge-{env}-prayers`

Stores individual prayer records (event log).

### Schema

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `PK` | String | Partition Key | `PRAYER#{prayerId}` |
| `SK` | String | Sort Key | `METADATA` |
| `prayerId` | String | - | UUID v4 |
| `personId` | String | - | FK to deceased |
| `cemeteryId` | String | - | Denormalized FK to cemetery |
| `prayerType` | String | - | Prayer type enum |
| `sessionId` | String | - | Browser session ID (optional) |
| `ipAddressHash` | String | - | SHA-256 of IP (optional) |
| `userAgent` | String | - | User agent string (optional) |
| `userId` | String | - | Future: user ID when auth added |
| `metadata` | Map | - | Future: extensible metadata |
| `createdAt` | String | - | ISO timestamp |
| `deletedAt` | String | - | ISO timestamp (soft delete, optional) |

### Global Secondary Indexes

#### GSI: `person-prayers-index`
Query all prayers for a specific person.

| Attribute | Key Type |
|-----------|----------|
| `personId` | Partition Key |
| `createdAt` | Sort Key |

**Projection:** ALL

**Access Pattern:**
```typescript
// Get all prayers for a person, most recent first
params = {
  TableName: 'deluge-prod-prayers',
  IndexName: 'person-prayers-index',
  KeyConditionExpression: 'personId = :personId',
  FilterExpression: 'attribute_not_exists(deletedAt)',
  ExpressionAttributeValues: {
    ':personId': 'person-uuid'
  },
  ScanIndexForward: false,  // Descending order
  Limit: 10
}
```

#### GSI: `cemetery-prayers-index`
Query recent prayers at a cemetery (for activity feed).

| Attribute | Key Type |
|-----------|----------|
| `cemeteryId` | Partition Key |
| `createdAt` | Sort Key |

**Projection:** KEYS_ONLY (reduces storage, can fetch full record if needed)

**Access Pattern:**
```typescript
// Get recent prayers at a cemetery
params = {
  TableName: 'deluge-prod-prayers',
  IndexName: 'cemetery-prayers-index',
  KeyConditionExpression: 'cemeteryId = :cemeteryId',
  ExpressionAttributeValues: {
    ':cemeteryId': 'cemetery-uuid'
  },
  ScanIndexForward: false,
  Limit: 5
}
```

### DynamoDB Stream

- **Stream Type:** NEW_IMAGE
- **Purpose:** Trigger Lambda to update computed fields
- **Lambda Function:** `deluge-{env}-update-aggregates`

### Capacity

- **Billing Mode:** PAY_PER_REQUEST
- **Estimated writes:** ~100-500/day (prayers)
- **Estimated reads:** ~50/day (recent activity queries)

---

## Table: `deluge-{env}-assignment-priority`

Lightweight table for efficient person assignment algorithm.

### Schema

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `PK` | String | Partition Key | `PERSON#{personId}` |
| `personId` | String | - | UUID v4 (matches deceased table) |
| `prayerCount` | Number | - | Mirrors deceased.prayerCount |
| `lastPrayedAt` | String | - | ISO timestamp (optional) |
| `cemeteryId` | String | - | For potential filtering |
| `role` | String | - | For potential filtering |
| `isActive` | Boolean | - | False if person is soft-deleted |

### Access Patterns

#### Scan for Assignment Candidates
```typescript
// Get 50 people with lowest prayer counts
params = {
  TableName: 'deluge-prod-assignment-priority',
  FilterExpression: 'isActive = :active AND prayerCount < :maxCount',
  ExpressionAttributeValues: {
    ':active': true,
    ':maxCount': 100  // Exclude heavily-prayed-for people
  },
  Limit: 100  // Scan limit, not result limit
}

// Then sort in application code by prayerCount
// Select randomly from bottom 50
```

### Capacity

- **Billing Mode:** PAY_PER_REQUEST
- **Estimated reads:** ~100/day (scans for assignment)
- **Estimated writes:** ~50/day (mirrors prayer updates)

### Migration Path

When this table grows beyond ~1000 records and scan performance degrades:
1. Deploy ElastiCache Redis
2. Create sorted set: `ZADD deceased:priority {prayerCount} {personId}`
3. Query: `ZRANGEBYSCORE deceased:priority 0 10 LIMIT 0 50`
4. Keep DynamoDB table as source of truth, Redis as cache

---

## Table: `deluge-{env}-rate-limits`

Tracks rate limiting counters per session/IP.

### Schema

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `PK` | String | Partition Key | `{type}:{identifier}` |
| `SK` | String | Sort Key | `{hourBucket}` |
| `requestCount` | Number | - | Counter |
| `expiresAt` | Number | - | Unix timestamp for TTL |

### Key Format

- **PK Examples:**
  - `session:abc123def456`
  - `ip:sha256hashofip`
- **SK Examples:**
  - `2024-01-15T10` (hourly bucket)

### TTL

- **TTL Attribute:** `expiresAt`
- **Expiration:** 2 hours after window start
- DynamoDB automatically deletes expired items

### Access Patterns

#### Check Rate Limit
```typescript
// Get current count for a session in this hour
params = {
  TableName: 'deluge-prod-rate-limits',
  Key: {
    PK: 'session:abc123def456',
    SK: '2024-01-15T10'
  }
}
```

#### Increment Rate Limit
```typescript
// Atomic increment
params = {
  TableName: 'deluge-prod-rate-limits',
  Key: {
    PK: 'session:abc123def456',
    SK: '2024-01-15T10'
  },
  UpdateExpression: 'SET requestCount = if_not_exists(requestCount, :zero) + :inc, expiresAt = :ttl',
  ExpressionAttributeValues: {
    ':zero': 0,
    ':inc': 1,
    ':ttl': Math.floor(Date.now() / 1000) + 7200  // 2 hours from now
  }
}
```

### Capacity

- **Billing Mode:** PAY_PER_REQUEST
- **Estimated writes:** ~500/day
- **Estimated reads:** ~500/day
- **Note:** Items auto-expire, so storage stays minimal

---

## Global Statistics Table (Optional)

For caching expensive aggregate queries.

### Table: `deluge-{env}-stats`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `PK` | String | Partition Key | `STATS#{scope}` |
| `SK` | String | Sort Key | `CURRENT` |
| `totalDeceased` | Number | - | Total across all cemeteries |
| `totalPrayers` | Number | - | Total prayers offered |
| `uniquePrayedFor` | Number | - | Unique people prayed for |
| `prayersByType` | Map | - | Breakdown by prayer type |
| `updatedAt` | String | - | ISO timestamp |

### Key Examples
- `STATS#global` - Global statistics
- `STATS#archdiocese#Atlanta` - Archdiocese-specific stats

### Update Strategy
- Updated by same Lambda that handles prayer aggregations
- Read directly for stats API endpoint
- Avoids expensive scans/aggregations on read

---

## Infrastructure as Code

### CloudFormation Template Structure

```yaml
# cloudformation/dynamodb.yaml
AWSTemplateFormatVersion: '2010-09-09'
Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]

Resources:
  DeceasedTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub 'deluge-${Environment}-deceased'
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: cemeteryId
          AttributeType: S
        - AttributeName: personId
          AttributeType: S
        - AttributeName: role
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: cemetery-index
          KeySchema:
            - AttributeName: cemeteryId
              KeyType: HASH
            - AttributeName: personId
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
        - IndexName: role-index
          KeySchema:
            - AttributeName: role
              KeyType: HASH
            - AttributeName: personId
              KeyType: RANGE
          Projection:
            ProjectionType: KEYS_ONLY

  # ... similar for other tables
```

---

## Cost Estimation (Free Tier)

| Table | Reads/Day | Writes/Day | Storage | Free Tier? |
|-------|-----------|------------|---------|------------|
| deceased | ~100 | ~50 | <1 MB | ✅ |
| cemeteries | ~500 | ~50 | <1 MB | ✅ |
| prayers | ~50 | ~500 | ~10 MB/month | ✅ |
| assignment-priority | ~100 | ~50 | <1 MB | ✅ |
| rate-limits | ~500 | ~500 | <1 MB (TTL cleanup) | ✅ |

**Total estimated:** Well within free tier (25 GB storage, 25 RCU, 25 WCU equivalent)

---

## Backup Strategy

- **Point-in-Time Recovery:** Enable for all tables
- **On-Demand Backups:** Weekly automated via AWS Backup
- **Cross-Region:** Not needed for MVP, consider for prod scale
