# Page Template Standard

This document defines the standard template for subpages in the n8n-stats dashboard. Use this as a reference when creating new pages or restructuring existing ones.

## Block Structure

Pages should follow this block order (skip blocks that don't apply):

```
BLOCK 1: HERO SECTION (Required)
├── Page title
├── Subtitle/description
├── 2-4 StatCards with sparklines (all metrics with time-series data)
└── MilestonePrediction cards (when applicable, same block)

BLOCK 2: MAIN CHART (Required)
└── Primary growth/trend visualization (full-width)

BLOCK 3: MAP (Conditional)
└── Geographic visualization (Events, Ambassadors only)

BLOCK 4: SECONDARY VISUALIZATIONS (Conditional)
├── Treemaps, category breakdowns
├── Platform-specific sections (Discussions)
└── Distribution charts, comparisons

BLOCK 5: RANKINGS (Conditional)
├── Top 10 lists, leaderboards
├── Multiple ranking sections allowed
└── Ordered by relevance/impact

BLOCK 6: DEEP DIVE DATA (Conditional)
├── Tables, detailed breakdowns
├── Category-specific content
└── Granular analysis (zero usage, explanations)

BLOCK 7: SOURCE CTA (Conditional)
└── Links to source platforms (n8n.io, Arena, GitHub, etc.)

BLOCK 8: PLAYGROUND CTA (Required)
└── "Build your own dashboard" → /playground

BLOCK 9: ATTRIBUTION FOOTER (Required)
└── Data sources, last updated timestamp
```

## Key Principles

1. **High-level data at top, granular data as you scroll down**
2. **Sparklines on ALL StatCards** that have time-series data available
3. **Milestones appear in Block 1** alongside stats (related metrics grouped together)
4. **Blocks 3-7 are conditional** - skip if no data for that block type
5. **Storytelling exceptions allowed** when page flow benefits

## Required vs Conditional Blocks

| Block | Required | Notes |
|-------|----------|-------|
| 1. Hero | Yes | Title, stats, milestones |
| 2. Main Chart | Yes | Primary visualization |
| 3. Map | No | Only for geographic data |
| 4. Secondary | No | Additional visualizations |
| 5. Rankings | No | Top 10 lists, leaderboards |
| 6. Deep Dive | No | Tables, detailed data |
| 7. Source CTA | No | Links to external sources |
| 8. Playground CTA | Yes | Always include |
| 9. Attribution | Yes | Data source credits |

## Component Usage

### Hero Section (Block 1)

```astro
<!-- Header -->
<div class="mb-8">
  <h1 class="text-3xl font-bold text-white mb-2">Page Title</h1>
  <p class="text-gray-400">
    Brief description of what this page shows.
  </p>
</div>

<!-- Stats Grid -->
<section class="mb-12">
  <h2 class="text-2xl font-bold text-white mb-6">Overview</h2>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <StatCard label="Metric 1" value={value1} />
    <StatCard label="Metric 2" value={value2} />
    <StatCard label="Metric 3" value={value3} />
    <StatCard label="Metric 4" value={value4} />
  </div>
</section>

<!-- Milestones (in same hero block when applicable) -->
{predictions.length > 0 && predictions.some(p => p.predictedDate) && (
  <section class="mb-12">
    <h2 class="text-2xl font-bold text-white mb-2">Milestones</h2>
    <p class="text-gray-400 mb-6">
      Predicted dates based on recent growth trends
    </p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      {predictions.map((pred) => (
        <MilestonePrediction
          label="Metric Name"
          milestone={pred.milestone}
          predictedDate={pred.predictedDate}
          daysUntil={pred.daysUntil}
          confidence={pred.confidence}
          currentValue={pred.currentValue}
          icon="emoji"
        />
      ))}
    </div>
  </section>
)}
```

### Main Chart (Block 2)

```astro
<section class="mb-12">
  <h2 class="text-2xl font-bold text-white mb-6">Growth Over Time</h2>
  <p class="text-gray-400 mb-4">Description of what the chart shows.</p>
  <HistoryChart />
</section>
```

### Playground CTA (Block 8)

```astro
import PlaygroundCTA from '@/components/PlaygroundCTA.astro';

<!-- Before attribution footer -->
<PlaygroundCTA />
```

### Attribution Footer (Block 9)

```astro
<p class="text-center text-sm text-gray-500 mt-8">
  Data sources: <a href="url" class="text-gray-400 hover:text-gray-300">Source Name</a>.
  Updated daily.
</p>
```

## StatCard Sparklines

When StatCard has time-series data available, include sparkline data:

```astro
<StatCard
  label="Total Items"
  value={totalItems}
  sparklineData={historyData.map(d => d.value)}
/>
```

Sparklines should show recent trend (last 30-90 days depending on data density).

## Page Examples

### Minimal Page (2 blocks required)

```
1. Hero (title, 2-4 stats)
2. Main Chart
8. Playground CTA
9. Attribution
```

### Typical Page (5-6 blocks)

```
1. Hero (title, stats, milestones)
2. Main Chart
4. Secondary Visualizations
5. Rankings
7. Source CTA
8. Playground CTA
9. Attribution
```

### Full Page (all blocks)

```
1. Hero
2. Main Chart
3. Map
4. Secondary Visualizations
5. Rankings
6. Deep Dive Data
7. Source CTA
8. Playground CTA
9. Attribution
```

## Accessibility

- All charts must use colorblind-friendly palettes (see `src/lib/utils/colors.ts`)
- Minimum contrast ratio 4.5:1 for text
- Interactive elements need visible focus states
- Data visualizations need text alternatives

## Mobile Considerations

- StatCard grids: `grid-cols-2 md:grid-cols-4`
- Charts: Full width, responsive height
- Rankings: Single column on mobile
- Maps: Touch-friendly zoom controls
