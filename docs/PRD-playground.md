# PRD: Data Playground

## Overview

An interactive page where users can explore n8n ecosystem data by combining different metrics, customizing visualizations, and discovering correlations.

## Phased Approach

### Phase 1: Time-Series Playground (MVP)
Compare trends over time across different data sources.
- **Data type**: Historical/time-series (monthly/weekly snapshots)
- **Charts**: Line, area (with dual Y-axis support)
- **Use cases**: "How has X changed?", "Does GitHub stars correlate with template growth?"

### Phase 2: Categorical Analysis (Future)
Explore distributions, rankings, and point-in-time correlations.
- **Data type**: Snapshots, rankings, distributions
- **Charts**: Bar, scatter, histogram
- **Use cases**: "Do templates with more nodes get more views?", "What's the distribution of nodes per template?"
- **Note**: Much of this data is already visualized on existing pages (treemaps, leaderboards). Phase 2 would add cross-analysis capabilities.

This PRD focuses on **Phase 1**.

## Problem Statement

Currently, each page shows pre-defined charts with fixed metrics. Users who want to:
- Compare metrics across different data sources (e.g., "Do GitHub stars correlate with template growth?")
- Focus on specific date ranges
- See data in different formats
- Export custom views

...cannot do so without building their own tooling.

## Target Users

1. **n8n Team** - Track ecosystem health, prepare reports, find correlations
2. **Community Contributors** - Understand trends, find opportunities
3. **Content Creators** - Generate charts for blog posts, videos
4. **Analysts/Researchers** - Study open-source project growth patterns

## User Stories

### Must Have (MVP)
- [ ] As a user, I can select one or more data series to display
- [ ] As a user, I can choose a date range (preset or custom)
- [ ] As a user, I can switch between chart types (line, bar, area)
- [ ] As a user, I can see the combined chart update in real-time

### Should Have
- [ ] As a user, I can normalize data to compare series with different scales (%, indexed to 100)
- [ ] As a user, I can toggle between daily/weekly/monthly aggregation
- [ ] As a user, I can save/share my current view via URL parameters
- [ ] As a user, I can export the chart as PNG

### Could Have
- [ ] As a user, I can export the underlying data as CSV
- [ ] As a user, I can see basic statistics (min, max, avg, growth rate)
- [ ] As a user, I can add annotations/markers for key events
- [ ] As a user, I can see preset "interesting comparisons" as starting points

### Won't Have (for now)
- User accounts / saved dashboards
- Real-time data (still daily refresh)
- Custom formulas / calculated fields
- Embedding on external sites

## Available Data Sources (Phase 1: Time-Series)

Based on existing `public/data/` files:

| Source | File | Metrics | History |
|--------|------|---------|---------|
| GitHub | github-history.json | stars, forks, watchers, openIssues | Jun 2019 - present |
| Community Forum | community-history.json | users, topics, posts, likes | Nov 2019 - present |
| Templates | all-templates-data.json → timeline.monthly | count (new/month), cumulative (total) | Aug 2019 - present |
| Creators | history/creators-stats.json | total, verified, totalViews, totalInserters | Nov 2024 - present |
| Discord | history/discord.json | members, online | Jan 2026 (just started) |

**Long-history sources** (meaningful for trends): GitHub, Forum, Templates
**Short-history sources** (will grow over time): Creators, Discord

## Data Sources Reserved for Phase 2 (Categorical)

| Data | File | Potential Analysis |
|------|------|-------------------|
| Nodes per template | all-templates-data.json | Distribution histogram, correlation with views |
| Creator rankings | history/creators.json | Leaderboard comparisons, verified vs non-verified |
| Template rankings | all-templates-data.json | Views vs nodes, category comparisons |
| Forum categories | community API | Category popularity, growth rates |
| Node usage | all-nodes-data.json | Category breakdown, trending nodes |

## UI/UX Considerations

### Layout Options

**Option A: Sidebar Controls**
```
┌─────────────────────────────────────────────┐
│ [Data Series    ▼] [Date Range ▼] [Type ▼] │
├──────────┬──────────────────────────────────┤
│ Controls │                                  │
│          │         Chart Area               │
│ □ Stars  │                                  │
│ □ Users  │                                  │
│ □ ...    │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

**Option B: Top Controls, Full-Width Chart**
```
┌─────────────────────────────────────────────┐
│ Data: [+ Add Series]  Range: [▼]  Type: [▼] │
│ ┌─────┐ ┌─────┐ ┌─────┐                     │
│ │Stars│ │Users│ │ + │                       │
│ └──x──┘ └──x──┘ └─────┘                     │
├─────────────────────────────────────────────┤
│                                             │
│              Chart Area                     │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

### Mobile Considerations
- Controls should stack vertically on mobile
- Chart should remain readable (may need horizontal scroll for dense data)

## Technical Considerations

### Data Loading Strategy
- Lazy load: Fetch JSON files only when that series is selected
- Or eager load: Fetch all data upfront (~500KB total?) for instant switching

### State Management
- URL parameters for shareable views: `?series=stars,users&range=1y&type=line`
- Local state for UI interactions

### Chart Library
- Already using Chart.js - should continue for consistency
- Need to handle multiple Y-axes for different scales

## Success Metrics

- Page visits / unique users
- Average time on page (engagement)
- Number of series combinations tried
- Export/share usage

## Design Decisions

### Resolved

1. **Scale handling**: Dual Y-axis (left/right) for combining different scales
2. **Data compatibility**: Some series may be incompatible (different data types) - need validation and user feedback
3. **Series limit**: Max 4 series per chart to keep it readable
4. **Cumulative vs Periodic**: User toggle - show running totals or period-over-period values
5. **Starting state**: Empty chart with clear prompts - communicates "playground" concept
6. **Auto-update**: Yes, instant updates (data is static/local, should be fast)
7. **Shareable URLs**: Yes, encode selections in URL params
8. **Navigation**: Playground should stand out in main menu (accent color, different styling)

### Data Compatibility Matrix

Need to define which series can be combined:

| Series Type | Can Combine With | Notes |
|-------------|------------------|-------|
| Counts (stars, users, templates) | Other counts | Same Y-axis if similar scale, dual if not |
| Growth rates (% change) | Other growth rates | Same Y-axis |
| Counts | Growth rates | Dual Y-axis required |

### Incompatible Combinations
- Weekly data + Monthly data (different granularity) - need to aggregate weekly → monthly
- Very short history (Discord: 2024+) with long history (GitHub: 2019+) - show intersection only, or pad with nulls?

## Updated User Stories (MVP)

### Must Have
- [x] Empty starting state with clear call-to-action
- [ ] Select up to 4 data series from dropdown/picker
- [ ] Automatic dual Y-axis when scales differ significantly
- [ ] Toggle: Cumulative totals vs Period-over-period change
- [ ] Date range presets (1M, 3M, 6M, 1Y, All)
- [ ] Chart type toggle (line, area)
- [ ] Instant chart updates on any change
- [ ] Shareable URL with encoded state
- [ ] Clear/reset button
- [ ] Validation: show warning for incompatible series

### Should Have
- [ ] Custom date range picker
- [ ] Export chart as PNG
- [ ] Mobile-responsive controls

### Deferred
- CSV export
- Statistics panel
- Annotations
- Suggested comparisons (could add later as "recipes")

## Navigation Design

```
┌─────────────────────────────────────────────────────────┐
│ [Dashboard] [Templates] [Nodes] [Community] [GitHub]    │
│                                         [✨ Playground] │
└─────────────────────────────────────────────────────────┘
```

Playground link styled differently:
- Accent/highlight color (n8n-primary or distinct)
- Possibly with icon or subtle animation
- Positioned last or separated from main nav items

## Technical Approach

Given the MVP scope (multiple controls, state management, URL sync, validation):
- **Recommendation**: Vanilla JS with a simple state management pattern
- Chart.js already handles dual Y-axis well
- URL state sync is straightforward with URLSearchParams
- No framework overhead, consistent with existing codebase

### Architecture for Phase 2 Extensibility

Structure code to support future categorical analysis:

```
src/lib/playground/
├── registry.ts        # Data source registry with metadata
│                      # - Phase 1: time-series sources
│                      # - Phase 2: add categorical sources
├── loaders.ts         # Data fetching/transformation
├── charts.ts          # Chart configuration builders
└── state.ts           # URL state management
```

**Data Registry Pattern:**
```typescript
interface DataSource {
  id: string;
  label: string;
  file: string;
  type: 'timeseries' | 'categorical';  // Phase 2 adds categorical
  metrics: MetricDefinition[];
  dateRange: { start: string; end: string };
}
```

This allows Phase 2 to add new source types without restructuring.

## Next Steps

1. ~~Review and finalize MVP scope~~ Done
2. Implement data inventory (list all available series with metadata)
3. Build playground component
4. Add to navigation with accent styling
5. Test and iterate

---

*Draft created: January 2025*
*Updated: January 2025 - Scope decisions finalized*
