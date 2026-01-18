# n8n Pulse

Community health dashboard and ecosystem explorer for n8n. Track growth, discover trends, and explore community activity.

**Live site**: https://n8n-pulse.gui.do

## Features

### Dashboard
Overview with growth velocity metrics, trending templates, and AI adoption insights.

### Template Explorer (`/templates`)
Browse and search 7,700+ community workflow templates with category filters and trending indicators.

### Node Statistics (`/nodes`)
See which nodes are most popular across all templates, with detailed usage stats per node.

### Creator Leaderboard (`/creators`)
Top template creators ranked by views and inserters, powered by n8n Arena data.

### Community Discussions (`/discussions`)
Forum member growth, topic activity, and Discord server stats.

### Community Events (`/events`)
Worldwide meetups and events displayed on an interactive map.

### Developer Stats (`/dev`)
GitHub stars, forks, releases, npm downloads, and Docker pulls.

### Market Landscape (`/market`)
Ecosystem overview including npm download trends and related package statistics.

### Ambassador Directory (`/ambassadors`)
n8n community ambassadors displayed on a world map.

### Data Playground (`/playground`)
Compare any metrics over time with correlation analysis. Build custom charts and share URLs.

## Tech Stack

- **Framework**: [Astro](https://astro.build/) 5 (static site generation)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/) with treemaps and annotations
- **Data**: Flat JSON files (version controlled) + daily API updates via GitHub Actions
- **Testing**: [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (E2E)
- **Analytics**: Self-hosted [Umami](https://umami.is/) (privacy-friendly)
- **Hosting**: Netlify

## Data Sources

| Source | Data | Update |
|--------|------|--------|
| n8n Templates API | Templates, nodes, views, creators | Daily |
| GitHub API | Stars, forks, releases, issues | Daily |
| Discourse API | Forum members, topics, posts | Daily |
| Discord API | Server members, online count | Daily |
| Bluesky API | Posts, followers, engagement | Daily |
| Reddit API | r/n8n subscribers, posts | Daily |
| npm API | Download counts | Daily |
| Docker Hub | Pull counts | Daily |
| Luma | Community events | Daily |
| n8n Arena | Creator metrics (inserters) | Weekly |
| Notion (scrape) | Ambassador directory | Weekly |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Update all history data
npm run update-all-history

# Fetch fresh data from APIs
npm run fetch-data
npm run fetch-daily
npm run fetch-external
```

## Testing

```bash
# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```

## Project Structure

```
src/
├── components/     # UI components (cards, charts)
├── layouts/        # Page layouts
├── pages/          # Routes
├── lib/
│   ├── api/        # API clients
│   ├── playground/ # Data playground logic
│   └── utils/      # Helper functions
└── styles/         # Global styles

public/data/        # Historical data (version controlled)
scripts/            # Data fetching and processing scripts
```

## Privacy

- Self-hosted analytics (no Google Analytics)
- Self-hosted fonts (no external font services)
- No tracking pixels or third-party scripts
- CSP headers restricting external resources

## Contributing

This is an independent community project, not affiliated with n8n GmbH.

Issues and suggestions welcome at the GitHub repository.

## Attributions

- **Creator metrics**: Powered by [n8n Arena](https://n8narena.com)
- **World map**: [NASA Blue Marble](https://visibleearth.nasa.gov/collection/1484/blue-marble) (public domain)

## License

MIT
