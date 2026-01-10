# n8n-stats

Community health dashboard and ecosystem explorer for n8n. Shows social proof and helps users discover popular/trending templates, nodes, and community activity.

## Project Overview

- **Stack**: Astro 5 + Tailwind CSS + Chart.js
- **Data**: Flat JSON files (version controlled) + API calls (daily via GitHub Actions)
- **Hosting**: Netlify (static)
- **Updates**: Daily at 06:00 UTC

## Architecture

```
EXTRACT (Daily)              TRANSFORM                    LOAD (Build)
─────────────────────────────────────────────────────────────────────────
n8n Templates API ─┐
GitHub API ────────┼──► data/snapshots/  ──► data/history/  ──► Astro
Discourse API ─────┤    (raw responses)      (time series)      (Netlify)
npm API ───────────┘

n8n Arena ─────────────► data/external/  ──► (merged into history)
(creator metrics)        (cached + attributed)
```

See `docs/DATA-STRATEGY.md` for full ETL documentation.

## Data Sources

### 1. n8n Templates API (Primary for v1)
- **Endpoint**: `https://api.n8n.io/api/templates/search`
- **Parameters**: `sort`, `category`, `rows`, `page`
- **Data**: Workflow templates, nodes used, views, creators
- **Rate limits**: Unknown, be conservative (1 req/sec)

### 2. Discourse Forum API
- **Base**: `https://community.n8n.io`
- **Endpoints**:
  - `/about.json` - Overall stats (users, topics, posts)
  - `/categories.json` - Category breakdown
  - `/top.json` - Trending topics
  - `/directory_items.json` - Top contributors
- **Auth**: Public endpoints, no key needed

### 3. GitHub API
- **Repo**: `n8n-io/n8n`
- **Data**: Stars (166k+), forks, releases, contributors
- **Auth**: Use token for higher rate limits
- **Historical**: Use star-history patterns or store daily snapshots

### 4. npm API
- **Package**: `n8n`
- **Endpoint**: `https://api.npmjs.org/downloads/point/last-month/n8n`
- **Data**: Download counts

### 5. n8n Arena (External)
- **URL**: `https://raw.githubusercontent.com/teds-tech-talks/n8n-community-leaderboard/main/stats_aggregate_creators.json`
- **Data**: Creator metrics (inserters, views), rich profiles
- **Why**: n8n API doesn't expose inserter data
- **Attribution**: Display "Creator metrics powered by n8n Arena"

### 6. Luma Events
- **URL**: `https://lu.ma` (scraped from n8n community calendar)
- **Data**: Community events, meetups, locations, registrations
- **Update**: Daily

### 7. Discord API
- **Server**: n8n Community Discord
- **Data**: Member count, online count
- **Auth**: Bot token required

### 8. YouTube Data API (Future)
- **Search**: Videos with "n8n" keyword
- **Data**: View counts, channel stats
- **Auth**: API key required

## Project Structure

```
/n8n-stats
├── src/
│   ├── components/
│   │   ├── charts/          # Chart components
│   │   ├── cards/           # Stat cards, template cards
│   │   ├── layout/          # Header, footer, nav
│   │   └── ui/              # Base UI components
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro      # Dashboard overview
│   │   ├── templates/       # Template explorer
│   │   ├── nodes/           # Node usage stats
│   │   ├── community/       # Forum stats
│   │   ├── github/          # GitHub stats
│   │   ├── events/          # Community events
│   │   └── playground/      # Data playground
│   ├── lib/
│   │   ├── api/
│   │   │   ├── n8n.ts       # n8n templates API
│   │   │   ├── discourse.ts # Forum API
│   │   │   ├── github.ts    # GitHub API
│   │   │   └── luma.ts      # Events API
│   │   ├── utils/
│   │   │   ├── formatters.ts
│   │   │   └── date.ts
│   │   └── types/
│   │       └── index.ts     # TypeScript interfaces
│   └── styles/
│       └── global.css
├── public/
│   ├── favicon.svg
│   └── data/                # All data files (version controlled)
│       ├── snapshots/       # Raw API responses by date
│       ├── external/        # Cached external data (n8n Arena)
│       ├── history/         # Time series for charts
│       └── seed/            # Historical backfill data
├── scripts/
│   ├── fetch-daily.ts       # Daily data collection
│   ├── fetch-external.ts    # External source fetching
│   └── build-history.ts     # Transform snapshots → history
├── docs/
│   └── DATA-STRATEGY.md     # ETL architecture documentation
├── .github/
│   └── workflows/
│       └── daily-build.yml
├── CLAUDE.md                 # This file
├── PRD.md                    # Product requirements
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Fetch fresh data (build-time)
npm run fetch-data
```

## Environment Variables

```env
# GitHub (optional, for higher rate limits)
GITHUB_TOKEN=

# YouTube (future)
YOUTUBE_API_KEY=
```

## Component Patterns

### Stat Card
```astro
<StatCard
  label="GitHub Stars"
  value={166509}
  change={+1.2}
  changeLabel="vs last week"
/>
```

### Chart Component
```astro
<LineChart
  data={starHistory}
  xKey="date"
  yKey="stars"
  title="Star Growth"
/>
```

### Template Card
```astro
<TemplateCard
  name="Build your first AI agent"
  views={12500}
  nodes={['AI Agent', 'Chat Model', 'Memory']}
  creator="Lucas Peyrin"
  verified={true}
/>
```

## Build Process

1. GitHub Action triggers daily at 06:00 UTC
2. `fetch-daily.ts` pulls from all primary APIs → `data/snapshots/`
3. `fetch-external.ts` pulls n8n Arena data → `data/external/`
4. `build-history.ts` transforms snapshots → `data/history/`
5. Astro builds static site reading from `data/history/`
6. Deploys to Netlify

## Code Style

- TypeScript strict mode
- Functional components preferred
- Keep components small and focused
- Use Astro's built-in scoped styles
- Semantic HTML for accessibility

## Testing

- Component tests with Vitest
- E2E tests with Playwright (critical paths only)
- Visual regression optional

## Using Ralph Loop for Autonomous Tasks

Use the Ralph Loop plugin (`/ralph-loop:ralph-loop`) for tasks that meet these criteria:

**Good candidates for Ralph Loop:**
- Well-defined tasks with clear success criteria
- Tasks requiring iteration and refinement (e.g., getting tests to pass)
- Tasks with automatic verification (tests, linters, type checks)
- Tasks requiring no human judgment or design decisions
- Fixing all TypeScript/ESLint errors in a file
- Making tests pass after implementation
- Refactoring with clear before/after patterns

**Not suitable for Ralph Loop:**
- Design decisions or architectural choices
- UI/UX work requiring visual judgment
- Tasks with ambiguous requirements
- First implementation of new features (use for refinement after)

**How to invoke:**
```
/ralph-loop:ralph-loop
```

Then provide the specific task with clear completion criteria.

## Related Resources

- [n8n Templates API](https://api.n8n.io/api/templates/search)
- [n8n Arena](https://n8narena.com) - Creator leaderboard (external data source)
- [Discourse API Docs](https://docs.discourse.org/)
- [Astro Documentation](https://docs.astro.build/)
- [Chart.js Documentation](https://www.chartjs.org/docs/)
