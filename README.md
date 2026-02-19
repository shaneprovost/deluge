# Deluge

A prayer tracking application connecting the faithful with deceased clergy and religious of the Atlanta Archdiocese.

## Vision

Deluge enables anonymous users to offer prayers for deceased clergy and religious, visualizing prayer "coverage" across cemeteries in the Atlanta archdiocese on an interactive map.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, entity definitions, event flows |
| [API Contracts](docs/API_CONTRACTS.md) | Complete API specification |
| [DynamoDB Schema](docs/DYNAMODB_SCHEMA.md) | Table designs, indexes, access patterns |
| [Type Definitions](docs/TYPE_DEFINITIONS.md) | TypeScript types and validation schemas |
| [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) | Phased development roadmap |
| [CI/CD & GitHub](docs/CICD.md) | Pipelines, branch protection, staging/prod deploys |

## Tech Stack

- **Frontend:** Next.js 14 (App Router), Tailwind CSS
- **Maps:** Mapbox GL JS
- **Database:** DynamoDB
- **Hosting:** Vercel
- **Future Auth:** AWS Cognito / NextAuth

## Internationalization (i18n)

UI strings are driven by **i18next** and **react-i18next**, with a single source file **`site-copy.json`** (same pattern as Our Prayer). Locales live under top-level keys (`en`, `es`, …); namespaces group keys by screen or area (`common`, `home`, `pray`, `map`, etc.). The language switcher in the header persists the choice in `localStorage` (`deluge-locale`) and all buttons/text use `useTranslation(namespace)` and `t("key")`. Add new strings in `site-copy.json` and new locales by adding another top-level language object.

## Core Features (MVP)

### Prayer Flow
1. User clicks "Pray for someone"
2. System assigns a person (weighted toward least-prayed-for)
3. User selects prayer type
4. User confirms prayer → 30-second cooldown

### Map View
- Cemetery markers with coverage visualization
- Click for aggregate stats
- Recent activity feed

## Data Model Summary

```
DeceasedPerson ──┬── Cemetery
                 │
                 └── Prayer (event log)
```

- **DeceasedPerson:** First name, last initial, year of death, role, cemetery
- **Cemetery:** Name, location, aggregate prayer stats
- **Prayer:** Person, prayer type, timestamp, abuse prevention fields

## Assignment Algorithm

- 70% chance: Select from people with lowest prayer counts
- 30% chance: Random selection (allows repeat prayers)
- 10-minute in-memory cache for performance

## Rate Limiting

- 20 prayers/session/hour
- 50 prayers/IP/hour
- 30-second cooldown between prayers

## Getting Started

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local

# Run development server
npm run dev

# Seed database (after AWS setup)
npm run seed
```

## Environment Variables

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
DYNAMODB_TABLE_PREFIX=deluge-dev
NEXT_PUBLIC_MAPBOX_TOKEN=xxx
```

## Project Structure

```
deluge/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   └── (pages)/           # Page components
├── components/            # React components
├── lib/
│   ├── db/               # DynamoDB repositories
│   ├── types/            # TypeScript types
│   └── validation/       # Zod schemas
├── hooks/                 # React hooks
├── docs/                  # Documentation
└── infrastructure/        # CloudFormation templates
```

## Migration Paths

| Component | MVP | Scale Solution |
|-----------|-----|----------------|
| Computed fields | DynamoDB Stream → Lambda | EventBridge |
| Assignment queue | DynamoDB scan + cache | Redis sorted set |
| Rate limiting | DynamoDB counters | Redis with TTL |

## License

Private - All rights reserved
