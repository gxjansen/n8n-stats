# n8n-stats: Product Requirements Document

## Executive Summary

**n8n-stats** is a community health dashboard and ecosystem explorer for n8n. It provides social proof of n8n's thriving community and helps users discover popular templates, trending nodes, and active contributors.

**Tagline**: "The pulse of the n8n community"

---

## Problem Statement

n8n has a vibrant community with:
- 166,000+ GitHub stars
- 7,700+ workflow templates
- 124,000+ forum users
- 1,300+ integrations

But there's no single place to:
1. See the ecosystem's health at a glance
2. Discover what's popular/trending
3. Find the most-used nodes and patterns
4. Celebrate top contributors

This data exists across multiple platforms but isn't aggregated or visualized.

---

## Goals

### Primary Goals
1. **Showcase community health** - Demonstrate n8n's active, growing ecosystem
2. **Enable discovery** - Help users find popular templates and nodes
3. **Track trends** - Show what's gaining traction over time

### Secondary Goals
- Celebrate top contributors (template creators, forum helpers)
- Identify gaps (underserved use cases, missing integrations)
- Provide historical context (growth over time)

### Non-Goals (for v1)
- User accounts or personalization
- Template creation/editing
- Direct n8n workflow execution
- Real-time data (daily is sufficient)

---

## Target Audience

**Primary**: n8n users looking for community insights
- "What templates do people actually use?"
- "Which nodes are most popular for AI workflows?"
- "Is n8n actively maintained and growing?"

**Secondary**:
- n8n team (ecosystem health metrics)
- Content creators (finding gaps to fill)
- Potential adopters (evaluating n8n)

---

## Features & Phases

### Phase 1: Template Explorer (MVP)

**Core Features**:

1. **Template Search & Browse**
   - Search by name, node, category
   - Filter by category (AI, Sales, IT Ops, Marketing, etc.)
   - Sort by: trending, views, newest
   - Pagination

2. **Template Cards**
   - Name and description preview
   - View count
   - Nodes used (visual pills)
   - Creator with verification badge
   - Link to original on n8n.io

3. **Node Usage Statistics**
   - Most-used nodes across all templates
   - Node usage by category
   - Trending nodes (growing in new templates)

4. **Basic Dashboard Header**
   - Total templates count
   - Total nodes available
   - Last updated timestamp

**Data Required**:
- n8n Templates API (primary)
- Aggregated node usage stats

---

### Phase 2: Community Health

**Features**:

1. **Forum Activity Dashboard**
   - Total users, topics, posts
   - Activity trend chart (posts per day/week)
   - Category breakdown
   - Response time metrics (if available)

2. **Top Contributors**
   - Forum: Most helpful users
   - Templates: Most prolific creators
   - Combined leaderboard

3. **Trending Topics**
   - Most viewed forum topics
   - Feature requests with most votes
   - Recent announcements

**Data Required**:
- Discourse API (community.n8n.io)

---

### Phase 3: GitHub & Growth

**Features**:

1. **GitHub Stats**
   - Stars, forks, watchers (current)
   - Star growth chart (historical)
   - Release timeline
   - Contributor count

2. **Download Stats**
   - npm downloads (monthly/weekly)
   - Docker pulls (if available)
   - Growth trends

3. **Version Timeline**
   - Major releases with highlights
   - Release cadence visualization

**Data Required**:
- GitHub API
- npm API
- Historical data in NocoDB

---

### Phase 4: Integration Coverage

**Features**:

1. **Integration Browser**
   - All 1,300+ integrations
   - Filter by category, type (trigger/action)
   - Search

2. **Coverage Analysis**
   - Integrations by category
   - Partner-built vs core
   - Recently added

**Data Required**:
- n8n.io/integrations (scraping or API)

---

## User Interface

### Design Principles

1. **Dark theme** - Matches n8n's brand
2. **Data-dense but scannable** - Show lots of info without overwhelm
3. **Progressive disclosure** - Summary first, details on demand
4. **Fast** - Static site, minimal JS

### Page Structure

```
/                     Dashboard overview (summary of all sections)
/templates            Template explorer (search, filter, browse)
/templates/[id]       Individual template detail (future)
/nodes                Node usage statistics
/community            Forum health dashboard
/github               GitHub & growth stats
/about                About this project
```

### Key Components

**Stat Card**
```
┌─────────────────────────┐
│  GitHub Stars           │
│  166,509       ↑ 1.2%   │
│  vs last week           │
└─────────────────────────┘
```

**Template Card**
```
┌─────────────────────────────────────────┐
│ ┌───┐ ┌───┐ ┌───┐ +3                    │
│ │ A │ │ B │ │ C │                       │
│ └───┘ └───┘ └───┘                       │
│                                         │
│ Build your first AI agent               │
│                                         │
│ 👤 Lucas Peyrin ✓     👁 12,500 views   │
└─────────────────────────────────────────┘
```

**Trend Chart**
```
┌─────────────────────────────────────────┐
│ Star Growth                             │
│                                    ╱──  │
│                               ╱───╱     │
│                          ╱───╱          │
│                     ╱───╱               │
│                ╱───╱                    │
│           ╱───╱                         │
│ ─────────╱                              │
│ Jan  Mar  May  Jul  Sep  Nov  Jan       │
└─────────────────────────────────────────┘
```

---

## Technical Architecture

### Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Astro 5 | Static-first, islands for interactivity |
| Styling | Tailwind CSS | Utility-first, fast development |
| Charts | Chart.js | Lightweight, good SSR support |
| Database | NocoDB | Already available, good for historical data |
| Hosting | Netlify | Static hosting, existing account |
| CI/CD | GitHub Actions | Daily scheduled builds |

### Data Flow

```
┌──────────────┐
│  Daily Cron  │ (GitHub Actions, 06:00 UTC)
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ fetch-data   │────▶│   NocoDB     │
│   script     │     │  (Elestio)   │
└──────┬───────┘     └──────────────┘
       │                    │
       ▼                    │
┌──────────────┐            │
│ Astro Build  │◀───────────┘
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Netlify    │
│   Deploy     │
└──────────────┘
```

### API Rate Limits & Caching

| API | Rate Limit | Strategy |
|-----|------------|----------|
| n8n Templates | Unknown | 1 req/sec, cache in NocoDB |
| Discourse | 60 req/min | Batch requests, daily only |
| GitHub | 60/hr (unauth), 5000/hr (auth) | Use token, cache results |
| npm | Generous | Daily fetch sufficient |

### NocoDB Tables

See CLAUDE.md for full schema. Key tables:
- `daily_snapshots` - Point-in-time metrics
- `templates` - Cached template data
- `nodes_usage` - Aggregated node statistics
- `top_contributors` - Leaderboard data

---

## Implementation Plan

### Week 1-2: Foundation
- [ ] Initialize Astro project with Tailwind
- [ ] Set up basic layout and navigation
- [ ] Create base UI components (cards, charts)
- [ ] Implement n8n Templates API client
- [ ] Build template listing page (no database yet)

### Week 3-4: Data Layer
- [ ] Set up NocoDB tables
- [ ] Create fetch-data script
- [ ] Implement NocoDB client
- [ ] Add node usage aggregation
- [ ] Set up GitHub Actions daily build

### Week 5-6: Template Explorer Complete
- [ ] Template search and filtering
- [ ] Category pages
- [ ] Node statistics page
- [ ] Dashboard overview
- [ ] Deploy to Netlify

### Week 7-8: Community & GitHub
- [ ] Discourse API integration
- [ ] Forum stats dashboard
- [ ] GitHub stats integration
- [ ] Historical charts
- [ ] Top contributors

### Week 9+: Polish & Expansion
- [ ] Integration browser
- [ ] Performance optimization
- [ ] SEO and social sharing
- [ ] Additional visualizations

---

## Development Workflow

### Using Ralph Loop for Autonomous Tasks

Use the Ralph Loop Claude Code plugin for tasks with clear success criteria and automatic verification. This enables faster iteration on well-defined work.

**Tasks suitable for Ralph Loop:**

| Task Type | Example | Verification |
|-----------|---------|--------------|
| Fix TypeScript errors | "Fix all TS errors in `src/lib/api/`" | `npm run build` passes |
| Make tests pass | "Make all tests in `tests/api/` pass" | `npm test` succeeds |
| Lint fixes | "Fix all ESLint errors" | `npm run lint` clean |
| Add missing types | "Add TypeScript types to all API functions" | No `any` types, build passes |
| Refactoring | "Convert all date formatting to use `formatters.ts`" | Tests pass, no behavior change |

**Tasks NOT suitable for Ralph Loop:**
- Initial component design and implementation
- UI/UX decisions requiring visual review
- Architecture choices
- Writing new features from scratch
- Debugging complex logic issues

**Workflow:**
1. Implement feature manually (design decisions made by human)
2. If tests fail or linting errors exist, use Ralph Loop to fix
3. Review Ralph Loop's changes before committing

---

## Success Metrics

### Technical
- Lighthouse score > 90 (all categories)
- Build time < 2 minutes
- Page load < 1 second

### Engagement (if tracking)
- Unique visitors per month
- Pages per session
- Return visitors

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API changes | Data breaks | Cache in NocoDB, graceful fallbacks |
| Rate limiting | Build fails | Conservative request pacing |
| n8n disapproves | Project killed | It's positive publicity, open communication |
| Stale data | Poor UX | Clear "last updated" timestamps |

---

## Open Questions

1. **Branding**: Should we reach out to n8n for approval/endorsement?
2. **Domain**: Use n8n-stats.netlify.app or custom domain?
3. **Analytics**: Add privacy-respecting analytics (Plausible)?
4. **RSS/API**: Expose our aggregated data via API for others?

---

## Appendix

### API Endpoints Reference

**n8n Templates**
```
GET https://api.n8n.io/api/templates/search
  ?sort=trendingScore:desc|createdAt:desc|totalViews:desc
  &category=AI|Sales|IT%20Ops|Marketing|Document%20Ops|Other|Support
  &rows=20
  &page=1
```

**Discourse**
```
GET https://community.n8n.io/about.json
GET https://community.n8n.io/categories.json
GET https://community.n8n.io/top.json
GET https://community.n8n.io/directory_items.json?period=all
```

**GitHub**
```
GET https://api.github.com/repos/n8n-io/n8n
GET https://api.github.com/repos/n8n-io/n8n/releases
GET https://api.github.com/repos/n8n-io/n8n/contributors
```

**npm**
```
GET https://api.npmjs.org/downloads/point/last-month/n8n
GET https://api.npmjs.org/downloads/range/last-year/n8n
```
