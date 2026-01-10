/**
 * Luma Events API module
 * Fetches n8n community events from Luma's public calendar page
 * by parsing JSON-LD structured data embedded in the HTML
 */

export interface LumaEvent {
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
  organizer?: string;
}

export interface EventsStats {
  upcomingCount: number;
  upcomingRegistrations: number;
  pastCount: number;
  pastRegistrations: number;
  totalEvents: number;
  totalRegistrations: number;
  countriesCount: number;
  onlineCount: number;
}

export interface EventsByMonth {
  month: string; // YYYY-MM format
  count: number;
  registrations: number;
}

export interface EventsByCountry {
  country: string;
  count: number;
  registrations: number;
  coordinates?: { lat: number; lng: number };
}

const LUMA_CALENDAR_URL = 'https://luma.com/n8n-events';

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
 * Extract registration count from HTML (shown near each event)
 */
function extractRegistrations(html: string, eventName: string): number {
  // Look for patterns like "45 Going" or "845 registered" near event names
  // This is a fallback if not in JSON-LD
  const regexPatterns = [
    /(\d+)\s*(?:Going|registered|attending)/gi,
    /(\d+)\s*guests?/gi,
  ];

  for (const regex of regexPatterns) {
    const matches = html.match(regex);
    if (matches && matches.length > 0) {
      const numMatch = matches[0].match(/(\d+)/);
      if (numMatch) {
        return parseInt(numMatch[1], 10);
      }
    }
  }

  return 0;
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
    // Simple string address
    const parts = address.split(',').map((p: string) => p.trim());
    city = parts[0] || '';
    country = parts[parts.length - 1] || '';
  } else if (address.addressLocality || address.addressCountry) {
    city = address.addressLocality || '';
    country = address.addressCountry || '';
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

  // Extract registration count from offers or other fields
  let registrations = 0;
  if (schema.offers && Array.isArray(schema.offers)) {
    // Try to find attendee count
  }

  // Generate stable ID from URL or name
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
    registrations,
    organizer: schema.organizer?.name,
  };
}

/**
 * Fetch events from Luma calendar page
 */
export async function fetchLumaEvents(period: 'upcoming' | 'past' = 'upcoming'): Promise<LumaEvent[]> {
  const url = period === 'past'
    ? `${LUMA_CALENDAR_URL}?k=c&period=past`
    : `${LUMA_CALENDAR_URL}?k=c`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'n8n-stats/1.0',
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Luma events: ${response.status}`);
  }

  const html = await response.text();
  const jsonLdData = parseJsonLd(html);

  const events: LumaEvent[] = [];

  for (const schema of jsonLdData) {
    if (schema['@type'] === 'Event') {
      const event = parseEventFromSchema(schema);
      if (event) {
        events.push(event);
      }
    } else if (schema['@graph']) {
      // Handle @graph wrapper
      for (const item of schema['@graph']) {
        if (item['@type'] === 'Event') {
          const event = parseEventFromSchema(item);
          if (event) {
            events.push(event);
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

  return events;
}

/**
 * Fetch all events (upcoming + past)
 */
export async function fetchAllLumaEvents(): Promise<{
  upcoming: LumaEvent[];
  past: LumaEvent[];
}> {
  const [upcoming, past] = await Promise.all([
    fetchLumaEvents('upcoming'),
    fetchLumaEvents('past'),
  ]);

  return { upcoming, past };
}

/**
 * Calculate events statistics
 */
export function calculateEventsStats(upcoming: LumaEvent[], past: LumaEvent[]): EventsStats {
  const allEvents = [...upcoming, ...past];
  const countries = new Set<string>();

  for (const event of allEvents) {
    if (event.location.country && !event.isOnline) {
      countries.add(event.location.country);
    }
  }

  return {
    upcomingCount: upcoming.length,
    upcomingRegistrations: upcoming.reduce((sum, e) => sum + e.registrations, 0),
    pastCount: past.length,
    pastRegistrations: past.reduce((sum, e) => sum + e.registrations, 0),
    totalEvents: allEvents.length,
    totalRegistrations: allEvents.reduce((sum, e) => sum + e.registrations, 0),
    countriesCount: countries.size,
    onlineCount: allEvents.filter(e => e.isOnline).length,
  };
}

/**
 * Group events by month
 */
export function groupEventsByMonth(events: LumaEvent[]): EventsByMonth[] {
  const byMonth = new Map<string, { count: number; registrations: number }>();

  for (const event of events) {
    const date = new Date(event.startDate);
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
export function groupEventsByCountry(events: LumaEvent[]): EventsByCountry[] {
  const byCountry = new Map<string, EventsByCountry>();

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
      // Keep first coordinates as representative
      coordinates: existing.coordinates || event.location.coordinates,
    });
  }

  return Array.from(byCountry.values())
    .sort((a, b) => b.count - a.count);
}
