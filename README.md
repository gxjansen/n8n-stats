# n8n-stats

Community health dashboard and ecosystem explorer for n8n. Track ecosystem growth, discover trends, and explore community activity.

## Features

- **Dashboard** - Growth velocity metrics, trending templates, ecosystem insights
- **Template Explorer** - Browse and search 7,700+ community workflow templates
- **Node Statistics** - See which nodes are most popular across all templates
- **GitHub Stats** - Star growth, releases, milestone predictions
- **Community Forum** - Member growth and activity tracking
- **Events** - Community meetups and events worldwide
- **Data Playground** - Compare any metrics with correlation analysis

## Tech Stack

- **Framework**: [Astro](https://astro.build/) 5 (static site generation)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **Data**: Flat JSON files (version controlled) + daily API updates via GitHub Actions
- **Hosting**: Netlify

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

# Update data (runs daily via GitHub Actions)
npm run fetch-data
```

## Data Sources

| Source | Data | Update Frequency |
|--------|------|------------------|
| [n8n Templates API](https://api.n8n.io/api/templates/search) | Templates, nodes, views | Daily |
| [GitHub API](https://api.github.com/repos/n8n-io/n8n) | Stars, forks, releases | Daily |
| [Discourse API](https://community.n8n.io) | Forum members, topics, posts | Daily |
| [n8n Arena](https://n8narena.com) | Creator metrics, inserters | Weekly |
| [Luma](https://lu.ma) | Community events | Daily |
| [Discord API](https://discord.com) | Server members | Daily |

## Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── charts/     # Chart components
│   └── cards/      # Stat cards, template cards
├── layouts/        # Page layouts
├── pages/          # Routes (index, templates, nodes, github, community, events)
├── lib/
│   ├── api/        # API clients
│   ├── playground/ # Data playground registry
│   └── utils/      # Helper functions
└── styles/         # Global styles

public/data/        # Historical data (version controlled)
scripts/            # Data fetching scripts
```

## Contributing

This is an independent community project, not affiliated with n8n GmbH.

## Attributions

- **World Map**: [NASA Blue Marble](https://visibleearth.nasa.gov/collection/1484/blue-marble) (public domain)

## License

MIT
