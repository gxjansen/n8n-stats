# n8n-stats

Community health dashboard and ecosystem explorer for n8n. Shows social proof and helps users discover popular/trending templates, nodes, and community activity.

**Built with n8n, for n8n.**

## Project Overview

- **Stack**: Astro 5 + Tailwind CSS + Chart.js
- **Data**: NocoDB (historical) + direct API calls (build-time)
- **Hosting**: Netlify (static)
- **Updates**: Daily via GitHub Actions

## Architecture

```
Data Sources          Storage              Frontend
─────────────────────────────────────────────────────
Discourse API    ─┐
GitHub API       ─┼──▶  NocoDB      ──▶   Astro
npm API          ─┤     (Elestio)         (Netlify)
YouTube API      ─┘
      │
      └── Collected by n8n workflow (daily cron)
```

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

### 5. YouTube Data API (Future)
- **Search**: Videos with "n8n" keyword
- **Data**: View counts, channel stats
- **Auth**: API key required

## NocoDB Schema

Database URL: `https://nocodb-nkhcx-u31496.vm.elestio.app/`

### Tables (planned)

```
daily_snapshots
├── id (auto)
├── date (date)
├── github_stars (int)
├── github_forks (int)
├── npm_downloads_monthly (int)
├── forum_users (int)
├── forum_topics (int)
├── forum_posts (int)
├── template_count (int)
└── created_at (datetime)

templates
├── id (int, from API)
├── name (text)
├── total_views (int)
├── creator_username (text)
├── creator_verified (bool)
├── node_count (int)
├── nodes_json (json)
├── category (text)
├── created_at (datetime)
├── last_fetched (datetime)
└── trending_score (float)

nodes_usage
├── id (auto)
├── node_name (text)
├── display_name (text)
├── template_count (int)
├── category (text)
└── last_updated (datetime)

top_contributors
├── id (auto)
├── username (text)
├── source (enum: forum, github, templates)
├── metric_value (int)
├── period (text)
└── snapshot_date (date)
```

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
│   │   └── github/          # GitHub stats
│   ├── lib/
│   │   ├── api/
│   │   │   ├── nocodb.ts    # NocoDB client
│   │   │   ├── n8n.ts       # n8n templates API
│   │   │   ├── discourse.ts # Forum API
│   │   │   └── github.ts    # GitHub API
│   │   ├── utils/
│   │   │   ├── formatters.ts
│   │   │   └── date.ts
│   │   └── types/
│   │       └── index.ts     # TypeScript interfaces
│   └── styles/
│       └── global.css
├── public/
│   └── favicon.svg
├── n8n/
│   └── data-collector.json  # n8n workflow export
├── scripts/
│   ├── fetch-data.ts        # Build-time data fetch
│   └── seed-nocodb.ts       # Initial DB setup
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
# NocoDB
NOCODB_URL=https://nocodb-nkhcx-u31496.vm.elestio.app
NOCODB_API_TOKEN=           # Add from NocoDB dashboard

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
2. `fetch-data.ts` runs, pulling from all APIs
3. Data stored in NocoDB for historical tracking
4. Astro builds static site with fresh data
5. Deploys to Netlify

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
- [Discourse API Docs](https://docs.discourse.org/)
- [Astro Documentation](https://docs.astro.build/)
- [Chart.js Documentation](https://www.chartjs.org/docs/)
