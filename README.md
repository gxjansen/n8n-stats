# n8n-stats

Community health dashboard and ecosystem explorer for n8n.

**Built with n8n, for n8n.**

## Features

- **Template Explorer** - Browse and search 7,700+ community workflow templates
- **Node Statistics** - See which nodes are most popular
- **Community Health** - Forum activity and top contributors (coming soon)
- **GitHub Stats** - Star growth, releases, and contributors (coming soon)

## Tech Stack

- **Framework**: [Astro](https://astro.build/) (static site generation)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Data**: NocoDB for historical tracking, direct API calls at build time
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
```

## Data Sources

- [n8n Templates API](https://api.n8n.io/api/templates/search)
- [n8n Community Forum](https://community.n8n.io) (Discourse API)
- [GitHub API](https://api.github.com/repos/n8n-io/n8n)
- [npm Downloads](https://api.npmjs.org/downloads/point/last-month/n8n)

## Project Structure

```
src/
├── components/     # Reusable UI components
├── layouts/        # Page layouts
├── pages/          # Routes
├── lib/
│   ├── api/        # API clients
│   ├── utils/      # Helper functions
│   └── types/      # TypeScript types
└── styles/         # Global styles
```

## Contributing

This is an independent community project, not affiliated with n8n GmbH.

## License

MIT
