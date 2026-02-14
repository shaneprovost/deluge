# Deluge - API Contracts

## Base URL

- **Development:** `http://localhost:3000/api`
- **Production:** `https://deluge.vercel.app/api`

## Authentication

MVP: Anonymous (no authentication required)

Future: Bearer token via `Authorization: Bearer {token}` header

---

## Endpoints

### Prayer Flow

#### `GET /api/assign`

Get a person to pray for. Implements weighted random selection favoring those with fewer prayers.

**Request:**
```http
GET /api/assign
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "John",
    "lastInitial": "D",
    "yearOfDeath": 1987,
    "role": "priest",
    "cemetery": {
      "cemeteryId": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Holy Spirit Cemetery",
      "city": "Atlanta",
      "state": "GA"
    }
  }
}
```

**Response: 429 Too Many Requests**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Please wait before requesting another assignment.",
    "retryAfterSeconds": 30
  }
}
```

**Response: 503 Service Unavailable**
```json
{
  "success": false,
  "error": {
    "code": "NO_CANDIDATES",
    "message": "No prayer candidates available at this time."
  }
}
```

---

#### `POST /api/pray`

Record that a prayer has been offered for a person.

**Request:**
```http
POST /api/pray
Content-Type: application/json

{
  "personId": "550e8400-e29b-41d4-a716-446655440000",
  "prayerType": "our_father"
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `personId` | string (UUID) | Yes | ID of person prayed for |
| `prayerType` | PrayerType | Yes | Type of prayer offered |

**Valid `prayerType` values:**
- `our_father`
- `hail_mary`
- `decade_rosary`
- `full_rosary`
- `mass`
- `divine_mercy_chaplet`
- `other`

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "prayerId": "770e8400-e29b-41d4-a716-446655440002",
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "prayerType": "our_father",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "meta": {
    "cooldownSeconds": 30,
    "canRequestNewAssignmentAt": "2024-01-15T10:30:30.000Z"
  }
}
```

**Response: 400 Bad Request**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "prayerType",
        "message": "Must be one of: our_father, hail_mary, decade_rosary, full_rosary, mass, divine_mercy_chaplet, other"
      }
    ]
  }
}
```

**Response: 404 Not Found**
```json
{
  "success": false,
  "error": {
    "code": "PERSON_NOT_FOUND",
    "message": "The specified person does not exist."
  }
}
```

**Response: 429 Too Many Requests**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "You have exceeded the prayer submission limit. Please try again later.",
    "retryAfterSeconds": 1800
  }
}
```

---

### Map Data

#### `GET /api/cemeteries`

Get all cemeteries with aggregate prayer statistics for map display.

**Request:**
```http
GET /api/cemeteries
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `archdiocese` | string | No | `"Atlanta"` | Filter by archdiocese |

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "cemeteryId": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Holy Spirit Cemetery",
      "city": "Atlanta",
      "state": "GA",
      "latitude": 33.7490,
      "longitude": -84.3880,
      "stats": {
        "totalDeceased": 15,
        "uniquePrayedFor": 12,
        "totalPrayers": 47,
        "coveragePercent": 80.0
      }
    },
    {
      "cemeteryId": "660e8400-e29b-41d4-a716-446655440002",
      "name": "Arlington Memorial Park",
      "city": "Sandy Springs",
      "state": "GA",
      "latitude": 33.9304,
      "longitude": -84.3733,
      "stats": {
        "totalDeceased": 8,
        "uniquePrayedFor": 3,
        "totalPrayers": 5,
        "coveragePercent": 37.5
      }
    }
  ],
  "meta": {
    "totalCemeteries": 2,
    "archdiocese": "Atlanta"
  }
}
```

---

#### `GET /api/cemeteries/{cemeteryId}`

Get detailed information about a specific cemetery.

**Request:**
```http
GET /api/cemeteries/660e8400-e29b-41d4-a716-446655440001
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "cemeteryId": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Holy Spirit Cemetery",
    "address": "4465 Northside Dr NW",
    "city": "Atlanta",
    "state": "GA",
    "zipCode": "30327",
    "latitude": 33.7490,
    "longitude": -84.3880,
    "archdiocese": "Atlanta",
    "stats": {
      "totalDeceased": 15,
      "uniquePrayedFor": 12,
      "totalPrayers": 47,
      "coveragePercent": 80.0
    },
    "recentActivity": [
      {
        "prayerType": "our_father",
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "prayerType": "full_rosary",
        "createdAt": "2024-01-15T09:15:00.000Z"
      }
    ]
  }
}
```

**Response: 404 Not Found**
```json
{
  "success": false,
  "error": {
    "code": "CEMETERY_NOT_FOUND",
    "message": "The specified cemetery does not exist."
  }
}
```

---

### Statistics

#### `GET /api/stats`

Get global statistics for the application.

**Request:**
```http
GET /api/stats
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "totalDeceased": 87,
    "totalPrayers": 342,
    "uniquePrayedFor": 65,
    "coveragePercent": 74.7,
    "totalCemeteries": 12,
    "prayersByType": {
      "our_father": 120,
      "hail_mary": 89,
      "decade_rosary": 45,
      "full_rosary": 23,
      "mass": 15,
      "divine_mercy_chaplet": 30,
      "other": 20
    },
    "recentActivity": [
      {
        "cemeteryName": "Holy Spirit Cemetery",
        "prayerType": "our_father",
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "cemeteryName": "Arlington Memorial Park",
        "prayerType": "full_rosary",
        "createdAt": "2024-01-15T10:25:00.000Z"
      }
    ]
  },
  "meta": {
    "generatedAt": "2024-01-15T10:31:00.000Z"
  }
}
```

---

### Admin Endpoints (Future)

These endpoints will be protected by admin authentication.

#### `POST /api/admin/deceased`

Create a new deceased person record.

**Request:**
```http
POST /api/admin/deceased
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "firstName": "Michael",
  "lastInitial": "S",
  "yearOfDeath": 1992,
  "role": "priest",
  "cemeteryId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "personId": "880e8400-e29b-41d4-a716-446655440003",
    "firstName": "Michael",
    "lastInitial": "S",
    "yearOfDeath": 1992,
    "role": "priest",
    "cemeteryId": "660e8400-e29b-41d4-a716-446655440001",
    "cemeteryName": "Holy Spirit Cemetery",
    "prayerCount": 0,
    "createdAt": "2024-01-15T10:35:00.000Z"
  }
}
```

---

#### `POST /api/admin/cemeteries`

Create a new cemetery record.

**Request:**
```http
POST /api/admin/cemeteries
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "Gate of Heaven Cemetery",
  "address": "123 Memorial Dr",
  "city": "Marietta",
  "state": "GA",
  "zipCode": "30060",
  "latitude": 33.9526,
  "longitude": -84.5499,
  "archdiocese": "Atlanta"
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "cemeteryId": "990e8400-e29b-41d4-a716-446655440004",
    "name": "Gate of Heaven Cemetery",
    "address": "123 Memorial Dr",
    "city": "Marietta",
    "state": "GA",
    "zipCode": "30060",
    "latitude": 33.9526,
    "longitude": -84.5499,
    "archdiocese": "Atlanta",
    "totalDeceased": 0,
    "totalPrayers": 0,
    "uniquePrayedFor": 0,
    "createdAt": "2024-01-15T10:40:00.000Z"
  }
}
```

---

#### `DELETE /api/admin/deceased/{personId}`

Soft-delete a deceased person record.

**Request:**
```http
DELETE /api/admin/deceased/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {admin_token}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "deletedAt": "2024-01-15T10:45:00.000Z"
  }
}
```

---

## Standard Response Format

All API responses follow this structure:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }  // Optional metadata
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [ ... ]  // Optional additional details
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body or parameters |
| `PERSON_NOT_FOUND` | 404 | Deceased person not found |
| `CEMETERY_NOT_FOUND` | 404 | Cemetery not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `NO_CANDIDATES` | 503 | No people available for assignment |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Request Headers

### Required Headers
| Header | Value | Description |
|--------|-------|-------------|
| `Content-Type` | `application/json` | Required for POST/PUT requests |

### Optional Headers (for abuse prevention)
| Header | Description |
|--------|-------------|
| `X-Session-ID` | Browser-generated session identifier |

Note: The API will also extract and hash the client IP from standard headers (`X-Forwarded-For`, `X-Real-IP`) for rate limiting.

---

## Rate Limiting

### Limits
- **Per Session:** 20 prayers per hour
- **Per IP:** 50 prayers per hour
- **Cooldown:** 30 seconds between prayer submissions

### Headers
Rate limit status is returned in response headers:

```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 18
X-RateLimit-Reset: 1705318200
```

### Cooldown
After each successful prayer submission, the client must wait 30 seconds before requesting a new assignment. This is enforced:
- Client-side: Disable UI, show countdown
- Server-side: Return 429 if cooldown not respected

---

## Versioning Strategy

MVP: No versioning (all endpoints under `/api/`)

Future: URL-based versioning (`/api/v1/`, `/api/v2/`)

When versioning is introduced:
- Deprecated versions will include `Deprecation` header
- Minimum 6-month deprecation notice
- Breaking changes only in new major versions
