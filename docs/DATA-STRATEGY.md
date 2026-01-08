# Data Strategy

## Decision: Flat Files over Database

For a static dashboard with predictable query patterns, flat JSON files are the right choice:
- Version controlled (git history = audit trail)
- No infrastructure to maintain
- Works natively with static hosting (Netlify)
- Easy to debug (just read the file)
- Pre-compute aggregations instead of runtime queries

---

## Principles

1. **Single source of truth** - Each metric has one authoritative source
2. **Raw vs derived separation** - Store API responses separately from computed data
3. **Actual vs estimated** - Clearly mark any interpolated/estimated data points
4. **Idempotent ETL** - Scripts can re-run safely without duplicates
5. **Graceful degradation** - If one source fails, others still work

---

## Data Sources

### Primary Sources (Direct API access)

| Source | Endpoint | Refresh | What We Get |
|--------|----------|---------|-------------|
| n8n Templates | `api.n8n.io/api/templates/search` | Daily | Templates, views, nodes, basic creator info |
| GitHub | `api.github.com/repos/n8n-io/n8n` | Daily | Stars, forks, releases, issues |
| Discourse | `community.n8n.io/about.json` | Daily | Users, topics, posts, likes |
| npm | `api.npmjs.org/downloads/...` | Daily | Download counts |

### External Sources (With attribution)

| Source | Data | Why We Need It |
|--------|------|----------------|
| [n8n Arena](https://n8narena.com) | Inserters, rich creator profiles | n8n API doesn't expose inserter metrics |
| [star-history.com](https://star-history.com) | Historical GitHub stars | Backfill before we started tracking |

---

## ETL Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTRACT (Daily)                          │
├─────────────────────────────────────────────────────────────────┤
│  n8n API ──┐                                                    │
│  GitHub ───┼──► scripts/fetch-daily.ts ──► data/snapshots/     │
│  Discourse─┤                               YYYY-MM-DD.json      │
│  npm ──────┘                                                    │
│                                                                 │
│  n8n Arena ──► scripts/fetch-external.ts ──► data/external/    │
│  (cached)                                    n8narena.json      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TRANSFORM (Daily)                         │
├─────────────────────────────────────────────────────────────────┤
│  scripts/build-history.ts                                       │
│  - Append today's snapshot to time series                       │
│  - Compute deltas (growth rates)                                │
│  - Merge creator data (API + n8n Arena)                         │
│  - Mark actual vs estimated data points                         │
│                              │                                  │
│                              ▼                                  │
│                    data/history/                                │
│                    ├── github.json                              │
│                    ├── community.json                           │
│                    ├── templates.json                           │
│                    └── creators.json                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        LOAD (Build time)                        │
├─────────────────────────────────────────────────────────────────┤
│  Astro reads from data/history/*.json                           │
│  No API calls during build (everything pre-fetched)             │
│  Fast, reliable, cache-friendly                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
public/data/
├── snapshots/                    # Layer 1: Raw API responses (append-only)
│   ├── 2026-01-08.json          # All sources for that day
│   ├── 2026-01-09.json
│   └── ...
│
├── external/                     # Cached external data
│   ├── n8narena-creators.json   # Full creator dataset
│   └── n8narena.meta.json       # { fetchedAt, source, attribution }
│
├── history/                      # Layer 2: Time series (computed)
│   ├── github.json              # { daily: [], weekly: [], monthly: [] }
│   ├── community.json
│   ├── templates.json
│   └── creators.json            # Merged from API + n8n Arena
│
└── seed/                         # Historical backfill (one-time import)
    ├── github-stars-history.json # From star-history.com
    └── README.md                 # Document sources
```

---

## Data Point Schema

Every data point should indicate its source:

```typescript
interface DataPoint {
  date: string;           // ISO date (YYYY-MM-DD)
  value: number;
  source: 'api' | 'external' | 'estimated';
  sourceDetail?: string;  // e.g., "star-history.com", "n8narena"
}
```

Example:
```json
{
  "daily": [
    { "date": "2024-01-15", "value": 45000, "source": "estimated", "sourceDetail": "star-history.com" },
    { "date": "2026-01-08", "value": 167391, "source": "api" }
  ]
}
```

Frontend can then:
- Show different styling for estimated vs actual
- Display tooltips explaining data source
- Filter to show only actual data if needed

---

## Refresh Schedule

| When | What | Script |
|------|------|--------|
| Daily 06:00 UTC | Fetch all primary + external sources | `fetch-daily.ts` |
| Daily 06:05 UTC | Rebuild history files | `build-history.ts` |
| Daily 06:10 UTC | Trigger Netlify build | GitHub Action |
| Weekly Sunday | Full template catalog (all pages) | `fetch-weekly.ts` |
| Manual | Historical backfill | `seed-history.ts` |

---

## Creator Data Merge Strategy

Since n8n Arena has richer data than the API:

```typescript
// Merge priority: n8n Arena > n8n API
const mergedCreator = {
  // Identity (from either)
  username: arena.user_username || api.username,
  name: arena.user?.name || api.name,

  // Profile (prefer Arena - has more)
  avatar: arena.user?.avatar || api.avatar,
  bio: arena.user?.bio || api.bio,
  links: arena.user?.links || api.links,
  verified: arena.user?.verified ?? api.verified,

  // Metrics (Arena only)
  totalViews: arena.sum_unique_visitors,
  totalInserters: arena.sum_unique_inserters,
  monthlyViews: arena.sum_unique_monthly_visitors,
  monthlyInserters: arena.sum_unique_monthly_inserters,
  weeklyViews: arena.sum_unique_weekly_visitors,
  weeklyInserters: arena.sum_unique_weekly_inserters,

  // Template count (from either)
  templateCount: arena.unique_count_template_url || api.templateCount,

  // Metadata
  _sources: ['n8narena', 'n8n-api'],
};
```

---

## Migration from Current State

### Current files to migrate:
- `github-history.json` → `history/github.json` (mark estimated data)
- `community-history.json` → `history/community.json`
- `templates-history.json` → `history/templates.json`
- `*-raw-log.json` → `snapshots/YYYY-MM-DD.json`

### Steps:
1. Create new directory structure
2. Write migration script to convert existing data
3. Add `source` field to historical data points
4. Mark pre-2026 GitHub data as `estimated`
5. Update frontend to read from new locations
6. Delete old files after validation

---

## Handling External Source Changes

If n8n Arena changes format or goes offline:

1. **Detection**: Compare fetched schema against expected
2. **Fallback**: Use cached version + show "data may be stale" warning
3. **Alert**: Log warning, continue with degraded data
4. **Recovery**: Manual intervention to update parser

```typescript
async function fetchN8nArena() {
  try {
    const data = await fetch(N8N_ARENA_URL);
    validateSchema(data); // Throws if schema changed
    await saveWithMeta(data, { fetchedAt: new Date() });
  } catch (error) {
    console.warn('n8n Arena fetch failed, using cache');
    return loadCachedVersion();
  }
}
```
