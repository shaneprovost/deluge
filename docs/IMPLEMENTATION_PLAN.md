# Deluge - Implementation Plan

## Phase Overview

| Phase | Focus | Deliverable |
|-------|-------|-------------|
| 1 | Foundation | Project setup, types, DynamoDB infrastructure |
| 2 | Data Layer | Repository pattern, DynamoDB operations, seed data |
| 3 | API Layer | Next.js API routes with validation |
| 4 | Frontend Core | Prayer flow UI, basic map |
| 5 | Polish | Rate limiting, error handling, responsive design |
| 6 | Deploy | Vercel deployment, AWS infrastructure |

---

## Phase 1: Foundation

### 1.1 Project Setup

```bash
# Create Next.js project
npx create-next-app@latest deluge --typescript --tailwind --app --eslint

# Install dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
npm install zod uuid
npm install mapbox-gl @types/mapbox-gl
npm install -D @types/uuid
```

### 1.2 Project Structure

```
deluge/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Home page with prayer flow
│   ├── map/
│   │   └── page.tsx             # Map view
│   ├── api/
│   │   ├── assign/
│   │   │   └── route.ts         # GET /api/assign
│   │   ├── pray/
│   │   │   └── route.ts         # POST /api/pray
│   │   ├── cemeteries/
│   │   │   ├── route.ts         # GET /api/cemeteries
│   │   │   └── [cemeteryId]/
│   │   │       └── route.ts     # GET /api/cemeteries/:id
│   │   └── stats/
│   │       └── route.ts         # GET /api/stats
├── components/
│   ├── ui/                      # Shared UI components
│   ├── prayer/
│   │   ├── PrayerFlow.tsx       # Main prayer flow container
│   │   ├── PersonCard.tsx       # Display assigned person
│   │   ├── PrayerTypeSelector.tsx
│   │   └── CooldownTimer.tsx
│   └── map/
│       ├── CemeteryMap.tsx      # Mapbox map component
│       ├── CemeteryMarker.tsx
│       └── CemeteryPopup.tsx
├── lib/
│   ├── db/
│   │   ├── client.ts            # DynamoDB client
│   │   ├── deceased.ts          # Deceased repository
│   │   ├── cemeteries.ts        # Cemeteries repository
│   │   ├── prayers.ts           # Prayers repository
│   │   ├── assignment.ts        # Assignment logic
│   │   └── rate-limit.ts        # Rate limiting
│   ├── types/
│   │   └── index.ts             # Type definitions
│   ├── validation/
│   │   └── schemas.ts           # Zod schemas
│   └── utils/
│       ├── hash.ts              # IP hashing
│       └── id.ts                # UUID generation
├── hooks/
│   ├── usePrayerFlow.ts         # Prayer flow state management
│   └── useCooldown.ts           # Cooldown timer hook
└── config/
    └── constants.ts             # App constants
```

### 1.3 Environment Variables

```bash
# .env.local
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
DYNAMODB_TABLE_PREFIX=deluge-dev
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

### 1.4 Type Definitions

Create `lib/types/index.ts` with all types from TYPE_DEFINITIONS.md.

### 1.5 Validation Schemas

Create `lib/validation/schemas.ts` with Zod schemas.

---

## Phase 2: Data Layer

### 2.1 DynamoDB Client

```typescript
// lib/db/client.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

export const dynamodb = DynamoDBDocumentClient.from(client);

export const getTableName = (table: string) => 
  `${process.env.DYNAMODB_TABLE_PREFIX}-${table}`;
```

### 2.2 Repository Pattern

Each entity gets a repository with standard CRUD operations:

```typescript
// lib/db/deceased.ts
export const deceasedRepository = {
  async getById(personId: string): Promise<DeceasedPerson | null> { ... },
  async create(data: CreateDeceasedPerson): Promise<DeceasedPerson> { ... },
  async update(personId: string, updates: Partial<DeceasedPerson>): Promise<DeceasedPerson> { ... },
  async softDelete(personId: string): Promise<void> { ... },
  async listByCemetery(cemeteryId: string): Promise<DeceasedPerson[]> { ... },
  async incrementPrayerCount(personId: string, timestamp: string): Promise<void> { ... },
};
```

### 2.3 Assignment Algorithm

```typescript
// lib/db/assignment.ts
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let candidateCache: AssignmentPriority[] = [];
let cacheTimestamp = 0;

export async function getPersonToAssign(): Promise<DeceasedPerson> {
  // Refresh cache if stale
  if (Date.now() - cacheTimestamp > CACHE_TTL_MS || candidateCache.length < 10) {
    candidateCache = await scanAssignmentPriority();
    cacheTimestamp = Date.now();
  }

  // 70% lowest prayer count, 30% random
  const useLowest = Math.random() < 0.7;
  
  if (useLowest) {
    const sorted = [...candidateCache].sort((a, b) => a.prayerCount - b.prayerCount);
    const candidates = sorted.slice(0, Math.min(10, sorted.length));
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    return deceasedRepository.getById(selected.personId);
  } else {
    const selected = candidateCache[Math.floor(Math.random() * candidateCache.length)];
    return deceasedRepository.getById(selected.personId);
  }
}
```

### 2.4 Seed Data Script

Create `scripts/seed-data.ts` to populate initial data:

```typescript
// scripts/seed-data.ts
import { v4 as uuidv4 } from 'uuid';

const CEMETERIES = [
  {
    name: 'Holy Spirit Cemetery',
    city: 'Atlanta',
    state: 'GA',
    latitude: 33.7490,
    longitude: -84.3880,
  },
  // ... more cemeteries
];

const DECEASED = [
  {
    firstName: 'John',
    lastInitial: 'D',
    yearOfDeath: 1987,
    role: 'priest',
    cemeteryName: 'Holy Spirit Cemetery',
  },
  // ... more deceased
];
```

---

## Phase 3: API Layer

### 3.1 API Route: GET /api/assign

```typescript
// app/api/assign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPersonToAssign } from '@/lib/db/assignment';
import { checkRateLimit } from '@/lib/db/rate-limit';
import { getSessionId, getIpHash } from '@/lib/utils/hash';

export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);
  const ipHash = getIpHash(request);

  // Check rate limit
  const isAllowed = await checkRateLimit(sessionId, ipHash);
  if (!isAllowed) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: '...' } },
      { status: 429 }
    );
  }

  // Get assignment
  const person = await getPersonToAssign();
  if (!person) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_CANDIDATES', message: '...' } },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      personId: person.personId,
      firstName: person.firstName,
      lastInitial: person.lastInitial,
      yearOfDeath: person.yearOfDeath,
      role: person.role,
      cemetery: {
        cemeteryId: person.cemeteryId,
        name: person.cemeteryName,
        // Fetch cemetery for city/state
      },
    },
  });
}
```

### 3.2 API Route: POST /api/pray

```typescript
// app/api/pray/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrayRequestSchema } from '@/lib/validation/schemas';
import { prayersRepository } from '@/lib/db/prayers';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Validate
  const result = PrayRequestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', ... } },
      { status: 400 }
    );
  }

  // Check rate limit
  // ...

  // Create prayer
  const prayer = await prayersRepository.create({
    personId: result.data.personId,
    prayerType: result.data.prayerType,
    sessionId,
    ipAddressHash,
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json(
    {
      success: true,
      data: prayer,
      meta: { cooldownSeconds: 30, canRequestNewAssignmentAt: '...' },
    },
    { status: 201 }
  );
}
```

### 3.3 API Tests

Create test files for each API route:

```typescript
// __tests__/api/assign.test.ts
describe('GET /api/assign', () => {
  it('returns a person to pray for', async () => { ... });
  it('returns 429 when rate limited', async () => { ... });
  it('returns 503 when no candidates', async () => { ... });
});
```

---

## Phase 4: Frontend Core

### 4.1 Prayer Flow Component

```typescript
// components/prayer/PrayerFlow.tsx
'use client';

import { useState } from 'react';
import { PersonCard } from './PersonCard';
import { PrayerTypeSelector } from './PrayerTypeSelector';
import { CooldownTimer } from './CooldownTimer';
import { usePrayerFlow } from '@/hooks/usePrayerFlow';

export function PrayerFlow() {
  const {
    state,
    assignedPerson,
    selectedPrayerType,
    cooldownRemaining,
    requestAssignment,
    selectPrayerType,
    confirmPrayer,
  } = usePrayerFlow();

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {state === 'idle' && (
        <button
          onClick={requestAssignment}
          className="btn-primary"
        >
          Pray for someone
        </button>
      )}

      {state === 'assigned' && assignedPerson && (
        <>
          <PersonCard person={assignedPerson} />
          <PrayerTypeSelector
            selected={selectedPrayerType}
            onSelect={selectPrayerType}
          />
          <button
            onClick={confirmPrayer}
            disabled={!selectedPrayerType}
            className="btn-primary"
          >
            I have prayed
          </button>
        </>
      )}

      {state === 'cooldown' && (
        <CooldownTimer
          remaining={cooldownRemaining}
          onComplete={requestAssignment}
        />
      )}
    </div>
  );
}
```

### 4.2 Map Component

```typescript
// components/map/CemeteryMap.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export function CemeteryMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [cemeteries, setCemeteries] = useState<CemeteryWithStats[]>([]);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-84.3880, 33.7490], // Atlanta
      zoom: 10,
    });

    // Load cemeteries and add markers
    fetch('/api/cemeteries')
      .then(res => res.json())
      .then(({ data }) => {
        setCemeteries(data);
        data.forEach((cemetery: CemeteryWithStats) => {
          // Add marker with coverage-based styling
          const marker = new mapboxgl.Marker({
            color: getCoverageColor(cemetery.stats.coveragePercent),
          })
            .setLngLat([cemetery.longitude, cemetery.latitude])
            .setPopup(new mapboxgl.Popup().setHTML(`
              <h3>${cemetery.name}</h3>
              <p>${cemetery.stats.coveragePercent}% prayed for</p>
            `))
            .addTo(map.current!);
        });
      });
  }, []);

  return <div ref={mapContainer} className="w-full h-[600px]" />;
}
```

### 4.3 UI Design

- **Color Palette:**
  - Primary: Deep purple (#4A1C6A) - reverent, spiritual
  - Secondary: Gold (#D4AF37) - hope, light
  - Background: Soft cream (#FDF8F0)
  - Text: Deep charcoal (#2D2D2D)

- **Typography:**
  - Headings: Serif (Georgia or similar)
  - Body: Clean sans-serif (Inter)

- **Components:**
  - Subtle cross icon in header
  - Soft shadows, rounded corners
  - Gentle animations for state transitions

---

## Phase 5: Polish

### 5.1 Rate Limiting Implementation

```typescript
// lib/db/rate-limit.ts
export async function checkRateLimit(
  sessionId: string,
  ipHash: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const hourBucket = new Date().toISOString().slice(0, 13);

  const [sessionCount, ipCount] = await Promise.all([
    getRateLimitCount(`session:${sessionId}`, hourBucket),
    getRateLimitCount(`ip:${ipHash}`, hourBucket),
  ]);

  if (sessionCount >= 20) {
    return { allowed: false, retryAfter: getSecondsUntilNextHour() };
  }

  if (ipCount >= 50) {
    return { allowed: false, retryAfter: getSecondsUntilNextHour() };
  }

  return { allowed: true };
}
```

### 5.2 Error Handling

- Global error boundary in layout
- API error responses follow standard format
- Client-side error display components
- Sentry integration (optional)

### 5.3 Responsive Design

- Mobile-first approach
- Prayer flow works on all screen sizes
- Map adapts to viewport
- Touch-friendly interactions

### 5.4 Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management during prayer flow

---

## Phase 6: Deploy

### 6.1 AWS Infrastructure (CloudFormation)

Create `infrastructure/template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Parameters:
  Environment:
    Type: String
    Default: dev

Resources:
  DeceasedTable:
    Type: AWS::DynamoDB::Table
    # ... schema from DYNAMODB_SCHEMA.md

  PrayersTable:
    Type: AWS::DynamoDB::Table
    # ... with DynamoDB Stream enabled

  UpdateAggregatesFunction:
    Type: AWS::Lambda::Function
    # ... Lambda to process stream events
```

### 6.2 Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add AWS_REGION
vercel env add AWS_ACCESS_KEY_ID
vercel env add AWS_SECRET_ACCESS_KEY
vercel env add DYNAMODB_TABLE_PREFIX
vercel env add NEXT_PUBLIC_MAPBOX_TOKEN
```

### 6.3 Lambda for Aggregates

```typescript
// lambda/update-aggregates.ts
import { DynamoDBStreamHandler } from 'aws-lambda';

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT' && record.dynamodb?.NewImage) {
      const prayer = unmarshall(record.dynamodb.NewImage);
      
      await Promise.all([
        // Increment DeceasedPerson.prayerCount
        incrementPersonPrayerCount(prayer.personId),
        
        // Update Cemetery aggregates
        updateCemeteryAggregates(prayer.cemeteryId),
        
        // Update AssignmentPriority
        updateAssignmentPriority(prayer.personId),
      ]);
    }
  }
};
```

---

## Testing Strategy

### Unit Tests
- Repository functions
- Validation schemas
- Assignment algorithm
- Utility functions

### Integration Tests
- API routes with mocked DynamoDB
- Full prayer flow

### E2E Tests (Optional for MVP)
- Playwright for critical paths
- Prayer flow end-to-end
- Map interaction

---

## Monitoring (Post-MVP)

- Vercel Analytics (built-in)
- CloudWatch for Lambda/DynamoDB
- Custom metrics:
  - Prayers per hour
  - Coverage percentage trend
  - Rate limit hits

---

## Definition of Done

MVP is complete when:

1. [ ] User can click "Pray for someone" and receive an assignment
2. [ ] User can select prayer type and confirm prayer
3. [ ] 30-second cooldown enforced between prayers
4. [ ] Rate limiting prevents abuse
5. [ ] Map displays all cemeteries with coverage stats
6. [ ] Clicking cemetery shows aggregate stats
7. [ ] Responsive design works on mobile
8. [ ] Deployed to Vercel with live DynamoDB
9. [ ] Seeded with 50-100 deceased records
10. [ ] Basic error handling in place
