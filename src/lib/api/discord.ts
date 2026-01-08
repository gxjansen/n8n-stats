import type { DiscordStats } from '../types';

const DISCORD_INVITE_CODE = 'n8n';

/**
 * Fetch Discord server statistics using the public invite API
 * This endpoint is public and doesn't require authentication
 */
export async function fetchDiscordStats(): Promise<DiscordStats> {
  const response = await fetch(
    `https://discord.com/api/v9/invites/${DISCORD_INVITE_CODE}?with_counts=true`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Discord stats: ${response.status}`);
  }

  const data = await response.json();

  return {
    memberCount: data.approximate_member_count,
    onlineCount: data.approximate_presence_count,
    guildName: data.guild?.name || 'n8n',
  };
}
