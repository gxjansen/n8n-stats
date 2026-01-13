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
GitHub API ────────┤
Discourse API ─────┼──► data/snapshots/  ──► data/history/  ──► Astro
Discord API ───────┤    (raw responses)      (time series)      (Netlify)
npm API ───────────┘

n8n Arena ─────────────► data/external/  ──► (merged into history)
(creator metrics)        (cached + attributed)

Luma Events ───────────► data/history/events.json
(scraped)
```

See `docs/DATA-STRATEGY.md` for full ETL documentation.

## Data Sources

### 1. n8n Templates API (Primary)
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
- **Data**: Stars, forks, releases, contributors, issues
- **Auth**: Use token for higher rate limits
- **Historical**: Daily snapshots + BigQuery backfill

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
- **Auth**: Bot token required (DISCORD_BOT_TOKEN)

### 8. YouTube Data API (Future)
- **Search**: Videos with "n8n" keyword
- **Data**: View counts, channel stats
- **Auth**: API key required

## Project Structure

```
/n8n-stats
├── src/
│   ├── components/
│   │   ├── cards/
│   │   │   ├── AIAdoptionCard.astro
│   │   │   ├── AIInsightCard.astro
│   │   │   ├── CommunityActivityCard.astro
│   │   │   ├── EventsSpotlightCard.astro
│   │   │   ├── LLMSummaryCard.astro
│   │   │   ├── MilestonePrediction.astro
│   │   │   ├── StatCard.astro
│   │   │   ├── SubpageTeaserCard.astro
│   │   │   ├── TemplateCard.astro
│   │   │   └── VelocityCard.astro
│   │   ├── charts/
│   │   │   ├── CategoryTreemapChart.astro
│   │   │   ├── CommunityHistoryChart.astro
│   │   │   ├── CommunityTreemapChart.astro
│   │   │   ├── CreatorsHistoryChart.astro
│   │   │   ├── EcosystemGrowthChart.astro
│   │   │   ├── EventsHistoryChart.astro
│   │   │   ├── EventsMapChart.astro
│   │   │   ├── GitHubHistoryChart.astro
│   │   │   ├── GitHubIssuesChart.astro
│   │   │   ├── MiniSparkline.astro
│   │   │   ├── NodeTreemapChart.astro
│   │   │   ├── ReleaseTimelineChart.astro
│   │   │   └── TemplatesHistoryChart.astro
│   │   ├── CategoryNodesTable.astro
│   │   └── PlaygroundCTA.astro
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro            # Dashboard overview
│   │   ├── creators/index.astro   # Creator leaderboard
│   │   ├── discussions/index.astro # Forum & Discord stats
│   │   ├── events/index.astro     # Community events
│   │   ├── github/index.astro     # GitHub stats
│   │   ├── nodes/
│   │   │   ├── index.astro        # Node usage stats
│   │   │   └── [slug].astro       # Individual node pages
│   │   ├── playground/index.astro # Data playground
│   │   └── templates/index.astro  # Template explorer
│   ├── lib/
│   │   ├── api/
│   │   │   ├── discord.ts        # Discord API
│   │   │   ├── discourse.ts      # Forum API
│   │   │   ├── github.ts         # GitHub API
│   │   │   ├── luma.ts           # Events API
│   │   │   └── n8n.ts            # n8n templates API
│   │   ├── playground/
│   │   │   ├── loaders.ts        # Data loaders for playground
│   │   │   ├── registry.ts       # Dataset registry
│   │   │   └── state.ts          # Playground state management
│   │   ├── utils/
│   │   │   ├── colors.ts         # Chart color utilities
│   │   │   ├── formatters.ts     # Number/date formatting
│   │   │   └── predictions.ts    # Milestone predictions
│   │   └── types/
│   │       └── index.ts          # TypeScript interfaces
│   └── styles/
│       └── global.css
├── public/
│   ├── favicon.svg
│   └── data/                     # All data files (version controlled)
│       ├── all-nodes-data.json   # Complete node catalog
│       ├── all-templates-data.json
│       ├── community-history.json
│       ├── community-raw-log.json
│       ├── github-history.json
│       ├── github-raw-log.json
│       ├── github-releases.json
│       ├── nodes-history.json
│       ├── templates-history.json
│       ├── templates-raw-log.json
│       ├── external/
│       │   ├── n8narena-creators.json
│       │   └── n8narena.meta.json
│       ├── history/
│       │   ├── community.json
│       │   ├── creators.json
│       │   ├── creators-stats.json
│       │   ├── discord.json
│       │   ├── discord-raw-log.json
│       │   ├── events.json
│       │   ├── events-history.json
│       │   ├── github.json
│       │   └── templates.json
│       ├── seed/                 # Historical backfill data
│       │   ├── community.json
│       │   ├── github-stars.json
│       │   └── github-wayback.json
│       └── snapshots/            # Raw API responses by date
├── scripts/
│   ├── fetch-daily.ts            # Daily data collection
│   ├── fetch-data.ts             # Combined fetch script
│   ├── fetch-external.ts         # External source fetching (n8n Arena)
│   ├── fetch-events.ts           # Luma events fetching
│   ├── fetch-all-nodes.ts        # Full node catalog fetch
│   ├── fetch-all-templates.ts    # Full template catalog fetch
│   ├── build-history.ts          # Transform snapshots → history
│   ├── update-github-history.ts
│   ├── update-community-history.ts
│   ├── update-templates-history.ts
│   ├── update-discord-history.ts
│   ├── update-nodes-history.ts
│   ├── process-scraped-events.ts
│   ├── backfill-*.ts             # Various backfill scripts
│   ├── merge-*.ts                # Data merge utilities
│   └── seed-*.ts                 # Seed data generators
├── docs/
│   ├── DATA-STRATEGY.md          # ETL architecture documentation
│   └── PRD-playground.md         # Playground feature PRD
├── .github/
│   └── workflows/
│       ├── daily-build.yml       # Daily data fetch + deploy
│       └── weekly-templates-fetch.yml # Weekly full template refresh
├── CLAUDE.md                     # This file
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

# Build for production (updates all history first)
npm run build

# Build without updating history
npm run build:only

# Preview production build
npm run preview

# Fetch fresh data
npm run fetch-data
npm run fetch-daily
npm run fetch-external

# Update history files individually
npm run update-github-history
npm run update-community-history
npm run update-templates-history
npm run update-discord-history

# Update all history files
npm run update-all-history
```

## Environment Variables

```env
# GitHub (optional, for higher rate limits)
GITHUB_TOKEN=

# Discord (required for Discord stats)
DISCORD_BOT_TOKEN=

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

### Velocity Card
```astro
<VelocityCard
  title="Star Velocity"
  currentValue={245}
  previousValue={230}
  unit="stars/day"
/>
```

### Milestone Prediction
```astro
<MilestonePrediction
  metric="stars"
  currentValue={166509}
  targetValue={200000}
  velocity={245}
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
2. `fetch-daily.ts` pulls from primary APIs
3. `update-*-history.ts` scripts append to history files
4. Astro builds static site reading from `public/data/`
5. Deploys to Netlify

Weekly: `weekly-templates-fetch.yml` refreshes full template catalog

## Code Style

- TypeScript strict mode
- Functional components preferred
- Keep components small and focused
- Use Astro's built-in scoped styles
- Semantic HTML for accessibility

### Accessibility Requirements
All new charts, pages, and features must be WCAG AA compliant:
- Minimum contrast ratio 4.5:1 for normal text, 3:1 for large text
- Charts must use colorblind-friendly palettes (see `src/lib/utils/colors.ts`)
- Interactive elements need visible focus states
- Data visualizations need text alternatives or accessible descriptions

## Testing

### Unit Tests (Vitest)
Tests for utility functions in `src/lib/utils/`:

```bash
# Run all unit tests
npm run test

# Run in watch mode during development
npm run test:watch

# Run with UI
npm run test:ui

# Run with coverage report
npm run test:coverage
```

Test files:
- `src/lib/utils/formatters.test.ts` - Number formatting, URL generation, slugs
- `src/lib/utils/predictions.test.ts` - Milestone prediction logic
- `src/lib/utils/colors.test.ts` - WCAG contrast, color palettes

### E2E Tests (Playwright)
Smoke tests and navigation tests in `e2e/`:

```bash
# Run E2E tests (requires build first)
npm run build:only && npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run all tests (unit + E2E)
npm run test:all
```

Test coverage:
- All pages load without errors
- Charts render (canvas elements present)
- Navigation between pages works
- External links have tracking parameters
- Data displays correctly (not empty states)

### Adding New Tests
- Unit tests: Create `*.test.ts` next to the source file
- E2E tests: Add to `e2e/smoke.spec.ts` or create new spec files

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

## Umami Analytics Event Tracking

This site uses a self-hosted Umami Analytics instance at `https://u.a11y.nl` for privacy-friendly analytics.

### Event Naming Convention
Events follow the pattern: `{category}-{action}` with optional `data-umami-event-target` for specifics.

**Categories:**
- `nav` - Navigation elements (header links)
- `cta` - Call-to-action buttons/banners
- `external` - External links (n8n.io, Arena, GitHub)
- `card` - Stat cards, velocity cards, subpage teasers
- `template` - Template cards
- `playground` - Data playground interactions

### Implemented Events

**Navigation (BaseLayout.astro):**
| Event Name | Target | Location |
|------------|--------|----------|
| `nav-click` | `home-logo`, `templates`, `nodes`, `creators`, `discussions`, `events`, `github`, `playground` | Header nav |
| `external-click` | `n8n-io`, `n8n-arena`, `gui-do`, `feedback-issues`, `gui-do-footer` | Footer links |

**Cards:**
| Event Name | Target | Location |
|------------|--------|----------|
| `card-click` | `stat-{label}`, `velocity-{label}`, `{title}` | StatCard, VelocityCard, SubpageTeaserCard |
| `template-click` | Template name (first 50 chars) | TemplateCard |
| `cta-click` | `playground-banner` | PlaygroundCTA |

**Playground (playground/index.astro):**
| Event Name | Target/Value | Tracks |
|------------|--------------|--------|
| `playground-metric` | Metric ID | Which metrics users select |
| `playground-mode` | `cumulative`/`change` | Data mode preference |
| `playground-chart-type` | `line`/`bar`/`area` | Chart type preference |
| `playground-remove-series` | Metric ID | Which series get removed |
| `playground-add-series` | Series count | How many series users add |
| `playground-range` | Range value | Time range preference |
| `playground-reset` | - | Reset frequency |
| `playground-share` | Series names, range | Sharing behavior |
| `playground-correlation-help` | - | Help usage |

### Adding New Events

**Static elements (links, buttons):**
```html
<a href="/page" data-umami-event="nav-click" data-umami-event-target="page-name">
```

**Dynamic tracking (JavaScript):**
```javascript
if (typeof umami !== 'undefined') {
  umami.track('event-name', { target: 'value' });
}
```

### Error Tracking

The site tracks errors via Umami for debugging without third-party services like Sentry.

**Tracked error types:**
| Event Name | Data | Description |
|------------|------|-------------|
| `js-error` | `message`, `file`, `line`, `col`, `url` | JavaScript runtime errors |
| `promise-error` | `message`, `url` | Unhandled promise rejections |
| `resource-error` | `type`, `src`, `url` | Failed image/script/stylesheet loads |
| `404-page` | `url`, `referrer` | 404 page visits (tracked on 404.astro) |

**Implementation (BaseLayout.astro):**
```javascript
// Error tracking snippet - add before </body>
window.addEventListener('error', function(event) {
  if (typeof umami !== 'undefined' && event.filename) {
    umami.track('js-error', {
      message: event.message.slice(0, 200),
      file: event.filename.split('/').pop(),
      line: event.lineno,
      url: window.location.pathname,
    });
  }
});
```

**Reusable pattern for other sites (gui.do, cro.cafe):**
1. Add the error tracking script from `BaseLayout.astro` before `</body>`
2. Create a `404.astro` page that tracks with `umami.track('404-page', { url, referrer })`
3. Filter out browser extension errors (`event.filename.includes('extension://')`)

## Related Resources

- [n8n Templates API](https://api.n8n.io/api/templates/search)
- [n8n Arena](https://n8narena.com) - Creator leaderboard (external data source)
- [Discourse API Docs](https://docs.discourse.org/)
- [Astro Documentation](https://docs.astro.build/)
- [Chart.js Documentation](https://www.chartjs.org/docs/)
