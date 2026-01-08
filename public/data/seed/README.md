# Seed Data

Historical data imported from external sources or estimated. This data is merged with daily snapshots to create complete time series.

## Files

### github-stars.json
- **Source**: Estimated from star-history.com patterns
- **Accuracy**: Approximate (rounded to nearest 100)
- **Period**: 2020-01 to 2024-05
- **Note**: No forks/issues data available for historical period

### community.json
- **Source**: Historical Discourse about.json snapshots
- **Accuracy**: Mixed (some actual, some estimated)
- **Period**: 2019-11 to 2023-11
- **Note**: User counts for 2023 are estimated

## Source Field Values

Each data point includes a `source` field:
- `api` - Fetched directly from the API
- `seed` - Imported from this seed data
- `external` - From external sources like n8n Arena

And optionally a `sourceDetail` field:
- `estimated-from-star-history` - Approximated from star-history.com
- `historical-import` - Actual historical data
- `historical-import-estimated` - Historical data with some estimation
