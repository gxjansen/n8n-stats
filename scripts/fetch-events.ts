/**
 * Fetch events from Luma calendar
 * Stores event data in public/data/history/events.json
 * Run via: npx tsx scripts/fetch-events.ts
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LUMA_CALENDAR_URL = 'https://luma.com/n8n-events';
const EVENTS_PATH = join(process.cwd(), 'public', 'data', 'history', 'events.json');

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
}

interface EventsData {
  lastUpdated: string;
  upcoming: LumaEvent[];
  past: LumaEvent[];
  byMonth: Array<{
    month: string;
    count: number;
    registrations: number;
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
}

/**
 * Parse JSON-LD from HTML content
 */
function parseJsonLd(html: string): any[] {
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches: any[] = [];
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        matches.push(...parsed);
      } else {
        matches.push(parsed);
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }

  return matches;
}

/**
 * Parse event from JSON-LD schema
 */
function parseEventFromSchema(schema: any): LumaEvent | null {
  if (schema['@type'] !== 'Event') return null;

  const location = schema.location || {};
  const address = location.address || {};

  // Extract city/country from address
  let city = '';
  let country = '';

  if (typeof address === 'string') {
    const parts = address.split(',').map((p: string) => p.trim());
    city = parts[0] || '';
    country = parts[parts.length - 1] || '';
  } else if (address.addressLocality || address.addressCountry) {
    city = address.addressLocality || '';
    // addressCountry can be a string or an object with name property
    if (typeof address.addressCountry === 'string') {
      country = address.addressCountry;
    } else if (address.addressCountry?.name) {
      country = address.addressCountry.name;
    }
  }

  // Check if online event
  const isOnline = location['@type'] === 'VirtualLocation' ||
    schema.eventAttendanceMode === 'https://schema.org/OnlineEventAttendanceMode' ||
    (location.name || '').toLowerCase().includes('online') ||
    (location.name || '').toLowerCase().includes('virtual');

  // Extract coordinates
  let coordinates: { lat: number; lng: number } | undefined;
  if (location.geo && location.geo.latitude && location.geo.longitude) {
    coordinates = {
      lat: parseFloat(location.geo.latitude),
      lng: parseFloat(location.geo.longitude),
    };
  }

  // Generate stable ID from URL
  const urlParts = (schema.url || '').split('/');
  const id = urlParts[urlParts.length - 1] || schema.name?.replace(/\s+/g, '-').toLowerCase() || '';

  return {
    id,
    name: schema.name || 'Untitled Event',
    description: schema.description,
    startDate: schema.startDate,
    endDate: schema.endDate,
    url: schema.url || '',
    location: {
      name: location.name || (isOnline ? 'Online' : 'TBA'),
      address: typeof address === 'string' ? address : address.streetAddress,
      city,
      country,
      coordinates,
    },
    isOnline,
    registrations: 0, // Will be extracted separately if available
  };
}

/**
 * Fetch events from Luma
 */
async function fetchLumaEvents(period: 'upcoming' | 'past'): Promise<LumaEvent[]> {
  const url = period === 'past'
    ? `${LUMA_CALENDAR_URL}?k=c&period=past`
    : `${LUMA_CALENDAR_URL}?k=c`;

  console.log(`Fetching ${period} events from ${url}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'n8n-stats/1.0 (https://github.com/gxjansen/n8n-stats)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Luma events: ${response.status}`);
  }

  const html = await response.text();
  const jsonLdData = parseJsonLd(html);

  const events: LumaEvent[] = [];

  for (const schema of jsonLdData) {
    // Handle direct Event type
    if (schema['@type'] === 'Event') {
      const event = parseEventFromSchema(schema);
      if (event) {
        events.push(event);
      }
    }
    // Handle Organization with events array (Luma's format)
    else if (schema['@type'] === 'Organization' && Array.isArray(schema.events)) {
      for (const eventSchema of schema.events) {
        const event = parseEventFromSchema(eventSchema);
        if (event) {
          events.push(event);
        }
      }
    }
    // Handle @graph wrapper
    else if (schema['@graph']) {
      for (const item of schema['@graph']) {
        if (item['@type'] === 'Event') {
          const event = parseEventFromSchema(item);
          if (event) {
            events.push(event);
          }
        } else if (item['@type'] === 'Organization' && Array.isArray(item.events)) {
          for (const eventSchema of item.events) {
            const event = parseEventFromSchema(eventSchema);
            if (event) {
              events.push(event);
            }
          }
        }
      }
    }
  }

  // Sort by date
  events.sort((a, b) => {
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    return period === 'past' ? dateB - dateA : dateA - dateB;
  });

  console.log(`  Found ${events.length} ${period} events`);
  return events;
}

/**
 * Group events by month
 */
function groupByMonth(events: LumaEvent[]): EventsData['byMonth'] {
  const byMonth = new Map<string, { count: number; registrations: number }>();

  for (const event of events) {
    const date = new Date(event.startDate);
    if (isNaN(date.getTime())) continue;

    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = byMonth.get(month) || { count: 0, registrations: 0 };
    byMonth.set(month, {
      count: existing.count + 1,
      registrations: existing.registrations + event.registrations,
    });
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

async function main() {
  console.log('Fetching n8n community events from Luma...\n');

  // Ensure directory exists
  const historyDir = join(process.cwd(), 'public', 'data', 'history');
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  // Fetch events
  const [upcoming, past] = await Promise.all([
    fetchLumaEvents('upcoming'),
    fetchLumaEvents('past'),
  ]);

  const allEvents = [...upcoming, ...past];
  const inPersonEvents = allEvents.filter(e => !e.isOnline);
  const countries = new Set(inPersonEvents.map(e => e.location.country).filter(Boolean));

  // Find date range
  const dates = allEvents
    .map(e => new Date(e.startDate))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const firstEventDate = dates.length > 0 ? dates[0].toISOString().split('T')[0] : '';
  const lastEventDate = dates.length > 0 ? dates[dates.length - 1].toISOString().split('T')[0] : '';

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
      firstEventDate,
      lastEventDate,
    },
    locations: aggregateLocations(allEvents),
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
  console.log(`Countries: ${eventsData.stats.countriesCount}`);
  console.log(`Date range: ${firstEventDate} to ${lastEventDate}`);
  console.log(`Locations with coordinates: ${eventsData.locations.length}`);
}

main().catch(console.error);
