/**
 * Build-time data fetching script
 *
 * This script runs before the Astro build to:
 * 1. Fetch fresh data from all APIs
 * 2. Store snapshots in NocoDB for historical tracking
 * 3. Generate static JSON files for build-time consumption
 *
 * Run with: npm run fetch-data
 */

import { fetchTemplates, aggregateNodeUsage, getTopCreators } from '../src/lib/api/n8n';
import { fetchForumStats, fetchForumCategories } from '../src/lib/api/discourse';
import { fetchGitHubStats, fetchGitHubReleases } from '../src/lib/api/github';

async function main() {
  console.log('Starting data fetch...\n');

  try {
    // 1. Fetch templates (first few pages for aggregation)
    console.log('Fetching templates...');
    const templatesResponse = await fetchTemplates({ rows: 100 });
    console.log(`  Found ${templatesResponse.totalWorkflows} total templates`);

    // 2. Aggregate node usage
    console.log('Aggregating node usage...');
    const nodeUsage = aggregateNodeUsage(templatesResponse.workflows);
    console.log(`  Analyzed ${nodeUsage.length} unique nodes`);

    // 3. Get top creators
    console.log('Finding top creators...');
    const topCreators = getTopCreators(templatesResponse.workflows);
    console.log(`  Found ${topCreators.length} creators`);

    // 4. Fetch forum stats
    console.log('Fetching forum stats...');
    const forumStats = await fetchForumStats();
    console.log(`  Forum: ${forumStats.usersCount} users, ${forumStats.topicsCount} topics`);

    // 5. Fetch GitHub stats
    console.log('Fetching GitHub stats...');
    const githubStats = await fetchGitHubStats();
    console.log(`  GitHub: ${githubStats.stars} stars, ${githubStats.forks} forks`);

    // TODO: Store in NocoDB for historical tracking
    // const nocodb = new NocoDBClient();
    // await nocodb.storeDailySnapshot({ ... });

    console.log('\nData fetch complete!');

    // Summary
    console.log('\n--- Summary ---');
    console.log(`Templates: ${templatesResponse.totalWorkflows}`);
    console.log(`Top node: ${nodeUsage[0]?.displayName} (${nodeUsage[0]?.count} uses)`);
    console.log(`Top creator: ${topCreators[0]?.username} (${topCreators[0]?.templateCount} templates)`);
    console.log(`Forum users: ${forumStats.usersCount}`);
    console.log(`GitHub stars: ${githubStats.stars}`);

  } catch (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }
}

main();
