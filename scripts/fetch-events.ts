/**
 * Fetch events from Luma calendar API
 * Stores event data in public/data/history/events.json
 * Run via: npx tsx scripts/fetch-events.ts
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LUMA_CALENDAR_API_ID = 'cal-rKZGvZjZWgFjKWW'; // n8n-events calendar
const LUMA_API_BASE = 'https://api.lu.ma/calendar/get-items';
const EVENTS_PATH = join(process.cwd(), 'public', 'data', 'history', 'events.json');
const LUMA_MAPPING_PATH = join(process.cwd(), 'public', 'data', 'external', 'luma-n8n-mapping.json');

// Load Luma to n8n username mapping
let lumaN8nMapping: Record<string, string> = {};
try {
  if (existsSync(LUMA_MAPPING_PATH)) {
    const mappingData = JSON.parse(readFileSync(LUMA_MAPPING_PATH, 'utf-8'));
    lumaN8nMapping = mappingData.mappings || {};
  }
} catch (e) {
  console.warn('Could not load Luma mapping file:', e);
}

// Placeholder strings to filter out from location data
const LOCATION_PLACEHOLDERS = [
  'register to see address',
  'specific location to be announced',
  'tba',
  'to be announced',
];

// Keywords that indicate an online event (case-insensitive)
// Check in event name AND location name
const ONLINE_KEYWORDS = [
  'virtual',
  'online',
  'webinar',
  'remote',
  'zoom',
  'youtube',
  'livestream',
  'live stream',
  'google meet',
];

// Hosts to exclude from rankings (n8n employees and companies)
// These still appear as event hosts but are filtered from the "Top Event Hosts" leaderboard
const EXCLUDED_HOST_USERNAMES = [
  'tino',                   // Tino Zwirs (n8n employee)
  'usr-x92jV43Ylj6xeEF',    // Avanai (company)
  'usr-OUlkJ8DjP43OCE0',    // Angel Menendez (n8n employee)
  'usr-K2qvsnAPznAIC8L',    // Dylan Watkins (n8n employee)
  'usr-LpUrafaznZGPrGz',    // Melinda Varga (n8n employee)
  'softpyramid',            // SOFT PYRAMID LLC (company)
  'AILA',                   // AI LA (company/org)
];

// Merge duplicate host accounts (same person with multiple Luma accounts)
// Maps secondary account usernames to primary account username
const HOST_ACCOUNT_MERGES: Record<string, string> = {
  'usr-MTbTXpTImNTRIYQ': 'usr-68RxDaDQTWqU3WU',  // Alison Granger (secondary → primary with avatar)
};

function isPlaceholderLocation(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return LOCATION_PLACEHOLDERS.some(p => lower.includes(p));
}

// Location types from Luma API that are definitely IN-PERSON
// Any other location_type (youtube, zoom, meet, online, teams, etc.) is treated as online
const IN_PERSON_LOCATION_TYPES = [
  'offline',
];

// Location types that are ambiguous - log these for monitoring
const AMBIGUOUS_LOCATION_TYPES = [
  'unknown',
  null,
  undefined,
  '',
];

// Track unknown location types encountered during fetch (for logging)
const encounteredLocationTypes = new Set<string>();

/**
 * Detect if an event is online based on name, location, or API location_type
 *
 * Strategy (future-proof):
 * 1. If location_type is explicitly "offline" -> in-person
 * 2. If location_type is a known platform (youtube, zoom, meet, etc.) -> online
 * 3. If location_type is ambiguous (unknown, null) -> check keywords in name/location
 * 4. Any other location_type -> assume online (catches future platforms)
 */
function isOnlineEvent(
  locationType: string | null | undefined,
  eventName: string,
  locationName: string
): boolean {
  // Track all location types for monitoring
  encounteredLocationTypes.add(locationType || 'null');

  // Normalize location type
  const normalizedType = (locationType || '').toLowerCase().trim();

  // Definitely in-person
  if (IN_PERSON_LOCATION_TYPES.includes(normalizedType)) {
    // Still check keywords - some "offline" events might be mislabeled
    const nameLower = eventName.toLowerCase();
    const locLower = locationName.toLowerCase();
    if (ONLINE_KEYWORDS.some(kw => nameLower.includes(kw) || locLower.includes(kw))) {
      return true;
    }
    return false;
  }

  // Ambiguous types - rely on keyword detection
  if (!normalizedType || normalizedType === 'unknown') {
    const nameLower = eventName.toLowerCase();
    if (ONLINE_KEYWORDS.some(kw => nameLower.includes(kw))) return true;

    const locLower = locationName.toLowerCase();
    if (ONLINE_KEYWORDS.some(kw => locLower.includes(kw))) return true;

    return false;
  }

  // Any other location_type (youtube, zoom, meet, teams, webex, discord, etc.)
  // is assumed to be an online platform
  return true;
}

interface EventHost {
  name: string;
  lumaUsername: string;
  lumaUrl: string;
  avatarUrl?: string;
  n8nUsername?: string;
}

interface HostStats {
  name: string;
  lumaUsername: string;
  lumaUrl: string;
  avatarUrl?: string;
  n8nUsername?: string;
  verified?: boolean;
  eventCount: number;
  totalRegistrations: number;
  countries: string[];
  cities: string[];
}

interface LumaEvent {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  url: string;
  location: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  isOnline: boolean;
  registrations: number;
  hosts: EventHost[];
}

interface EventsData {
  lastUpdated: string;
  upcoming: LumaEvent[];
  past: LumaEvent[];
  byMonth: Array<{
    month: string;
    count: number;
    registrations: number;
    inPersonCount: number;
    inPersonRegistrations: number;
    onlineCount: number;
    onlineRegistrations: number;
  }>;
  byCountry: Array<{
    country: string;
    count: number;
    registrations: number;
    coordinates?: { lat: number; lng: number };
  }>;
  stats: {
    totalEvents: number;
    totalRegistrations: number;
    upcomingCount: number;
    pastCount: number;
    countriesCount: number;
    onlineCount: number;
    inPersonCount: number;
    pastInPersonCount: number;
    pastInPersonRegistrations: number;
    pastOnlineCount: number;
    pastOnlineRegistrations: number;
    firstEventDate: string;
    lastEventDate: string;
  };
  locations: Array<{
    name: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
    eventCount: number;
    totalRegistrations: number;
  }>;
  hosts: HostStats[];
}

interface LumaApiHost {
  name: string;
  api_id: string;
  username: string | null;
  avatar_url: string;
  website?: string | null;
  bio_short?: string | null;
}

interface LumaApiEntry {
  api_id: string;
  event: {
    api_id: string;
    name: string;
    start_at: string;
    end_at: string;
    url: string;
    location_type: 'offline' | 'online';
    geo_address_info?: {
      city?: string;
      country?: string;
      address?: string;
      full_address?: string;
    };
    geo_address_visibility?: string;
    coordinate?: {
      latitude: number;
      longitude: number;
    };
  };
  hosts: LumaApiHost[];
  guest_count: number;
  ticket_count: number;
}

interface LumaApiResponse {
  entries: LumaApiEntry[];
  has_more: boolean;
  next_cursor?: string;
}

/**
 * Parse event from Luma API entry
 */
function parseEventFromApi(entry: LumaApiEntry): LumaEvent {
  const event = entry.event;
  const geoInfo = event.geo_address_info || {};

  // Check if online event (using API type, event name, and location name)
  const locationName = geoInfo.address || '';
  const isOnline = isOnlineEvent(event.location_type, event.name, locationName);

  // Extract city/country, filtering out placeholders
  let city = geoInfo.city || '';
  let country = geoInfo.country || '';

  if (isPlaceholderLocation(city)) city = '';
  if (isPlaceholderLocation(country)) country = '';

  // Extract coordinates
  let coordinates: { lat: number; lng: number } | undefined;
  if (event.coordinate && event.coordinate.latitude && event.coordinate.longitude) {
    coordinates = {
      lat: event.coordinate.latitude,
      lng: event.coordinate.longitude,
    };
  }

  // Extract hosts (skip official n8n account)
  const hosts: EventHost[] = [];
  for (const host of entry.hosts || []) {
    // Skip the official n8n account
    if (host.username?.toLowerCase() === 'n8n' || host.api_id === 'usr-vfGku4UVUPr8Ig3') {
      continue;
    }

    const lumaUsername = host.username || host.api_id;
    hosts.push({
      name: host.name,
      lumaUsername,
      lumaUrl: `https://luma.com/user/${lumaUsername}`,
      avatarUrl: host.avatar_url,
      n8nUsername: lumaN8nMapping[lumaUsername] || undefined,
    });
  }

  return {
    id: event.url || event.api_id,
    name: event.name,
    startDate: event.start_at,
    endDate: event.end_at,
    url: `https://lu.ma/${event.url}`,
    location: {
      name: geoInfo.address || (isOnline ? 'Online' : 'TBA'),
      address: geoInfo.full_address,
      city,
      country,
      coordinates,
    },
    isOnline,
    registrations: entry.guest_count || 0,
    hosts,
  };
}

/**
 * Fetch all events from Luma API with pagination
 */
async function fetchLumaEvents(period: 'upcoming' | 'past'): Promise<LumaEvent[]> {
  const events: LumaEvent[] = [];
  let cursor: string | undefined;
  let page = 1;

  console.log(`Fetching ${period} events from Luma API...`);

  do {
    const params = new URLSearchParams({
      calendar_api_id: LUMA_CALENDAR_API_ID,
      period: period === 'upcoming' ? 'future' : 'past',
      pagination_limit: '100',
    });

    if (cursor) {
      params.set('pagination_cursor', cursor);
    }

    const url = `${LUMA_API_BASE}?${params}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'n8n-stats/1.0 (https://github.com/gxjansen/n8n-stats)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Luma events: ${response.status}`);
    }

    const data: LumaApiResponse = await response.json();

    for (const entry of data.entries) {
      const event = parseEventFromApi(entry);
      events.push(event);
    }

    console.log(`  Page ${page}: ${data.entries.length} events (total: ${events.length})`);

    cursor = data.has_more ? data.next_cursor : undefined;
    page++;

    // Small delay between requests to be respectful
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } while (cursor);

  // Sort by date
  events.sort((a, b) => {
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    return period === 'past' ? dateB - dateA : dateA - dateB;
  });

  console.log(`  Total ${period}: ${events.length} events`);
  return events;
}

/**
 * Group events by month with in-person/online split
 */
function groupByMonth(events: LumaEvent[]): EventsData['byMonth'] {
  const byMonth = new Map<string, {
    count: number;
    registrations: number;
    inPersonCount: number;
    inPersonRegistrations: number;
    onlineCount: number;
    onlineRegistrations: number;
  }>();

  for (const event of events) {
    const date = new Date(event.startDate);
    if (isNaN(date.getTime())) continue;

    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = byMonth.get(month) || {
      count: 0,
      registrations: 0,
      inPersonCount: 0,
      inPersonRegistrations: 0,
      onlineCount: 0,
      onlineRegistrations: 0,
    };

    // Update totals
    existing.count += 1;
    existing.registrations += event.registrations;

    // Update split counts
    if (event.isOnline) {
      existing.onlineCount += 1;
      existing.onlineRegistrations += event.registrations;
    } else {
      existing.inPersonCount += 1;
      existing.inPersonRegistrations += event.registrations;
    }

    byMonth.set(month, existing);
  }

  return Array.from(byMonth.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Group events by country
 */
function groupByCountry(events: LumaEvent[]): EventsData['byCountry'] {
  const byCountry = new Map<string, EventsData['byCountry'][0]>();

  for (const event of events) {
    if (event.isOnline) continue;

    const country = event.location.country || 'Unknown';
    if (isPlaceholderLocation(country) || country === 'Unknown') continue;

    const existing = byCountry.get(country) || {
      country,
      count: 0,
      registrations: 0,
      coordinates: event.location.coordinates,
    };

    byCountry.set(country, {
      ...existing,
      count: existing.count + 1,
      registrations: existing.registrations + event.registrations,
      coordinates: existing.coordinates || event.location.coordinates,
    });
  }

  return Array.from(byCountry.values())
    .sort((a, b) => b.count - a.count);
}

/**
 * Aggregate locations for map
 */
function aggregateLocations(events: LumaEvent[]): EventsData['locations'] {
  const locationMap = new Map<string, EventsData['locations'][0]>();

  for (const event of events) {
    if (event.isOnline || !event.location.coordinates) continue;
    if (isPlaceholderLocation(event.location.city || '') && isPlaceholderLocation(event.location.country || '')) continue;

    const key = `${event.location.coordinates.lat.toFixed(2)},${event.location.coordinates.lng.toFixed(2)}`;
    const existing = locationMap.get(key);

    if (existing) {
      existing.eventCount++;
      existing.totalRegistrations += event.registrations;
    } else {
      locationMap.set(key, {
        name: event.location.name,
        city: event.location.city || '',
        country: event.location.country || '',
        lat: event.location.coordinates.lat,
        lng: event.location.coordinates.lng,
        eventCount: 1,
        totalRegistrations: event.registrations,
      });
    }
  }

  return Array.from(locationMap.values())
    .sort((a, b) => b.eventCount - a.eventCount);
}

/**
 * Aggregate host statistics across all events
 */
function aggregateHosts(events: LumaEvent[]): HostStats[] {
  const hostMap = new Map<string, HostStats>();

  for (const event of events) {
    for (const host of event.hosts) {
      // Check if this account should be merged into another
      const effectiveUsername = HOST_ACCOUNT_MERGES[host.lumaUsername] || host.lumaUsername;
      const existing = hostMap.get(effectiveUsername);

      if (existing) {
        existing.eventCount++;
        existing.totalRegistrations += event.registrations;
        // Update avatar if we have a better one (non-default)
        if (host.avatarUrl && !host.avatarUrl.includes('avatars-default')) {
          existing.avatarUrl = host.avatarUrl;
        }
        // Add country if not already present and not a placeholder
        const country = event.location.country;
        if (country && !event.isOnline && !isPlaceholderLocation(country) && !existing.countries.includes(country)) {
          existing.countries.push(country);
        }
        // Add city if not already present and not a placeholder
        const city = event.location.city;
        if (city && !event.isOnline && !isPlaceholderLocation(city) && !existing.cities.includes(city)) {
          existing.cities.push(city);
        }
      } else {
        const country = event.location.country;
        const city = event.location.city;
        // Use the effective (primary) username for merged accounts
        const isPrimaryAccount = !HOST_ACCOUNT_MERGES[host.lumaUsername];
        hostMap.set(effectiveUsername, {
          name: host.name.trim(),  // Trim whitespace from name
          lumaUsername: effectiveUsername,
          lumaUrl: isPrimaryAccount ? host.lumaUrl : `https://luma.com/user/${effectiveUsername}`,
          avatarUrl: host.avatarUrl,
          n8nUsername: host.n8nUsername,
          verified: false,
          eventCount: 1,
          totalRegistrations: event.registrations,
          countries: country && !event.isOnline && !isPlaceholderLocation(country) ? [country] : [],
          cities: city && !event.isOnline && !isPlaceholderLocation(city) ? [city] : [],
        });
      }
    }
  }

  // Sort by event count descending, excluding n8n employees and companies
  return Array.from(hostMap.values())
    .filter(host => !EXCLUDED_HOST_USERNAMES.includes(host.lumaUsername))
    .sort((a, b) => b.eventCount - a.eventCount || b.totalRegistrations - a.totalRegistrations);
}

async function main() {
  console.log('Fetching n8n community events from Luma API...\n');

  // Ensure directory exists
  const historyDir = join(process.cwd(), 'public', 'data', 'history');
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  // Fetch events with pagination
  const [upcoming, past] = await Promise.all([
    fetchLumaEvents('upcoming'),
    fetchLumaEvents('past'),
  ]);

  const allEvents = [...upcoming, ...past];
  const inPersonEvents = allEvents.filter(e => !e.isOnline);
  const countries = new Set(
    inPersonEvents
      .map(e => e.location.country)
      .filter(c => c && !isPlaceholderLocation(c))
  );

  // Find date range
  const dates = allEvents
    .map(e => new Date(e.startDate))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const firstEventDate = dates.length > 0 ? dates[0].toISOString().split('T')[0] : '';
  const lastEventDate = dates.length > 0 ? dates[dates.length - 1].toISOString().split('T')[0] : '';

  // Aggregate hosts
  const hosts = aggregateHosts(allEvents);

  // Build data structure
  const eventsData: EventsData = {
    lastUpdated: new Date().toISOString(),
    upcoming,
    past,
    byMonth: groupByMonth(allEvents),
    byCountry: groupByCountry(allEvents),
    stats: {
      totalEvents: allEvents.length,
      totalRegistrations: allEvents.reduce((sum, e) => sum + e.registrations, 0),
      upcomingCount: upcoming.length,
      pastCount: past.length,
      countriesCount: countries.size,
      onlineCount: allEvents.filter(e => e.isOnline).length,
      inPersonCount: allEvents.filter(e => !e.isOnline).length,
      pastInPersonCount: past.filter(e => !e.isOnline).length,
      pastInPersonRegistrations: past.filter(e => !e.isOnline).reduce((sum, e) => sum + e.registrations, 0),
      pastOnlineCount: past.filter(e => e.isOnline).length,
      pastOnlineRegistrations: past.filter(e => e.isOnline).reduce((sum, e) => sum + e.registrations, 0),
      firstEventDate,
      lastEventDate,
    },
    locations: aggregateLocations(allEvents),
    hosts,
  };

  // Save data
  writeFileSync(EVENTS_PATH, JSON.stringify(eventsData, null, 2));
  console.log(`\nSaved events data to ${EVENTS_PATH}`);

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Total events: ${eventsData.stats.totalEvents}`);
  console.log(`  Upcoming: ${eventsData.stats.upcomingCount}`);
  console.log(`  Past: ${eventsData.stats.pastCount}`);
  console.log(`  Online: ${eventsData.stats.onlineCount}`);
  console.log(`Total registrations: ${eventsData.stats.totalRegistrations}`);
  console.log(`Countries: ${eventsData.stats.countriesCount}`);
  console.log(`Date range: ${firstEventDate} to ${lastEventDate}`);
  console.log(`Locations with coordinates: ${eventsData.locations.length}`);
  console.log(`Community hosts: ${eventsData.hosts.length}`);
  if (eventsData.hosts.length > 0) {
    console.log(`  Top hosts: ${eventsData.hosts.slice(0, 5).map(h => `${h.name} (${h.eventCount} events, ${h.totalRegistrations} reg.)`).join(', ')}`);
  }

  // Log encountered location types for monitoring
  // This helps detect new platforms Luma adds in the future
  console.log(`\n--- Location Types Detected ---`);
  console.log(`Types found: ${[...encounteredLocationTypes].sort().join(', ')}`);
  console.log(`(offline = in-person, other types = online platforms)`);
}

main().catch(console.error);
