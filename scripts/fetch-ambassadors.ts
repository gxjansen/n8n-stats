/**
 * Fetch n8n Ambassadors from Notion directory
 * Uses Playwright to scrape the public Notion page
 * Run via: npx tsx scripts/fetch-ambassadors.ts
 */

import { chromium } from '@playwright/test';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const NOTION_PAGE_URL = 'https://n8n.notion.site/9eefeb6356754725a1b2dd8ccecc4ffb';
const AMBASSADORS_PATH = join(process.cwd(), 'public', 'data', 'history', 'ambassadors.json');
const SNAPSHOTS_DIR = join(process.cwd(), 'public', 'data', 'snapshots');

// City coordinates lookup (shared with events)
const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  // US Cities
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  'San Diego': { lat: 32.7157, lng: -117.1611 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  'NYC': { lat: 40.7128, lng: -74.0060 },
  'Chicago': { lat: 41.8781, lng: -87.6298 },
  'Austin': { lat: 30.2672, lng: -97.7431 },
  'Miami': { lat: 25.7617, lng: -80.1918 },
  'Atlanta': { lat: 33.7490, lng: -84.3880 },
  'Dallas': { lat: 32.7767, lng: -96.7970 },
  'Seattle': { lat: 47.6062, lng: -122.3321 },
  'Denver': { lat: 39.7392, lng: -104.9903 },
  'Boston': { lat: 42.3601, lng: -71.0589 },
  'Phoenix': { lat: 33.4484, lng: -112.0740 },
  'Portland': { lat: 45.5152, lng: -122.6784 },
  // Canada
  'Toronto': { lat: 43.6532, lng: -79.3832 },
  'Vancouver': { lat: 49.2827, lng: -123.1207 },
  'Montreal': { lat: 45.5017, lng: -73.5673 },
  // Europe
  'Amsterdam': { lat: 52.3676, lng: 4.9041 },
  'Berlin': { lat: 52.5200, lng: 13.4050 },
  'London': { lat: 51.5074, lng: -0.1278 },
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'Vienna': { lat: 48.2082, lng: 16.3738 },
  'Barcelona': { lat: 41.3851, lng: 2.1734 },
  'Madrid': { lat: 40.4168, lng: -3.7038 },
  'Lisbon': { lat: 38.7223, lng: -9.1393 },
  'Zürich': { lat: 47.3769, lng: 8.5417 },
  'Zurich': { lat: 47.3769, lng: 8.5417 },
  'Cologne': { lat: 50.9375, lng: 6.9603 },
  'Frankfurt': { lat: 50.1109, lng: 8.6821 },
  'Munich': { lat: 48.1351, lng: 11.5820 },
  'Düsseldorf': { lat: 51.2277, lng: 6.7735 },
  'Hamburg': { lat: 53.5511, lng: 9.9937 },
  'Warsaw': { lat: 52.2297, lng: 21.0122 },
  'Milan': { lat: 45.4642, lng: 9.1900 },
  'Rome': { lat: 41.9028, lng: 12.4964 },
  'Nantes': { lat: 47.2184, lng: -1.5536 },
  'Lyon': { lat: 45.7640, lng: 4.8357 },
  'Gent': { lat: 51.0543, lng: 3.7174 },
  'Brussels': { lat: 50.8503, lng: 4.3517 },
  'Budapest': { lat: 47.4979, lng: 19.0402 },
  'Prague': { lat: 50.0755, lng: 14.4378 },
  'København': { lat: 55.6761, lng: 12.5683 },
  'Copenhagen': { lat: 55.6761, lng: 12.5683 },
  'Stockholm': { lat: 59.3293, lng: 18.0686 },
  'Oslo': { lat: 59.9139, lng: 10.7522 },
  'Helsinki': { lat: 60.1699, lng: 24.9384 },
  'Dublin': { lat: 53.3498, lng: -6.2603 },
  'Istanbul': { lat: 41.0082, lng: 28.9784 },
  'Athens': { lat: 37.9838, lng: 23.7275 },
  'Kyiv': { lat: 50.4501, lng: 30.5234 },
  'Bucharest': { lat: 44.4268, lng: 26.1025 },
  'Sofia': { lat: 42.6977, lng: 23.3219 },
  // Middle East
  'Tel Aviv': { lat: 32.0853, lng: 34.7818 },
  'Dubai': { lat: 25.2048, lng: 55.2708 },
  'Abu Dhabi': { lat: 24.4539, lng: 54.3773 },
  // Africa
  'Nairobi': { lat: -1.2921, lng: 36.8219 },
  'Accra': { lat: 5.6037, lng: -0.1870 },
  'Lagos': { lat: 6.5244, lng: 3.3792 },
  'Cape Town': { lat: -33.9249, lng: 18.4241 },
  'Johannesburg': { lat: -26.2041, lng: 28.0473 },
  'Cairo': { lat: 30.0444, lng: 31.2357 },
  // Asia
  'Seoul': { lat: 37.5665, lng: 126.9780 },
  'Tokyo': { lat: 35.6762, lng: 139.6503 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'Hong Kong': { lat: 22.3193, lng: 114.1694 },
  'Taipei': { lat: 25.0330, lng: 121.5654 },
  'Bangkok': { lat: 13.7563, lng: 100.5018 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Delhi': { lat: 28.6139, lng: 77.2090 },
  'Jakarta': { lat: -6.2088, lng: 106.8456 },
  'Kuala Lumpur': { lat: 3.1390, lng: 101.6869 },
  'Manila': { lat: 14.5995, lng: 120.9842 },
  'Ho Chi Minh City': { lat: 10.8231, lng: 106.6297 },
  'Beijing': { lat: 39.9042, lng: 116.4074 },
  'Shanghai': { lat: 31.2304, lng: 121.4737 },
  'Islamabad': { lat: 33.6844, lng: 73.0479 },
  'Karachi': { lat: 24.8607, lng: 67.0011 },
  // South America
  'São Paulo': { lat: -23.5505, lng: -46.6333 },
  'Sao Paulo': { lat: -23.5505, lng: -46.6333 },
  'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
  'Buenos Aires': { lat: -34.6037, lng: -58.3816 },
  'Santiago': { lat: -33.4489, lng: -70.6693 },
  'Lima': { lat: -12.0464, lng: -77.0428 },
  'Bogota': { lat: 4.7110, lng: -74.0721 },
  'Mexico City': { lat: 19.4326, lng: -99.1332 },
  // Australia/Oceania
  'Sydney': { lat: -33.8688, lng: 151.2093 },
  'Melbourne': { lat: -37.8136, lng: 144.9631 },
  'Brisbane': { lat: -27.4698, lng: 153.0251 },
  'Auckland': { lat: -36.8485, lng: 174.7633 },
};

// Country coordinates fallback
const countryCoordinates: Record<string, { lat: number; lng: number }> = {
  'Netherlands': { lat: 52.1326, lng: 5.2913 },
  'Germany': { lat: 51.1657, lng: 10.4515 },
  'United States': { lat: 37.0902, lng: -95.7129 },
  'USA': { lat: 37.0902, lng: -95.7129 },
  'France': { lat: 46.2276, lng: 2.2137 },
  'Spain': { lat: 40.4637, lng: -3.7492 },
  'Austria': { lat: 47.5162, lng: 14.5501 },
  'Switzerland': { lat: 46.8182, lng: 8.2275 },
  'United Kingdom': { lat: 55.3781, lng: -3.4360 },
  'UK': { lat: 55.3781, lng: -3.4360 },
  'Poland': { lat: 51.9194, lng: 19.1451 },
  'Portugal': { lat: 39.3999, lng: -8.2245 },
  'Italy': { lat: 41.8719, lng: 12.5674 },
  'Belgium': { lat: 50.5039, lng: 4.4699 },
  'Hungary': { lat: 47.1625, lng: 19.5033 },
  'Czech Republic': { lat: 49.8175, lng: 15.4730 },
  'Denmark': { lat: 56.2639, lng: 9.5018 },
  'Sweden': { lat: 60.1282, lng: 18.6435 },
  'Norway': { lat: 60.4720, lng: 8.4689 },
  'Finland': { lat: 61.9241, lng: 25.7482 },
  'Ireland': { lat: 53.1424, lng: -7.6921 },
  'Turkey': { lat: 38.9637, lng: 35.2433 },
  'Greece': { lat: 39.0742, lng: 21.8243 },
  'Romania': { lat: 45.9432, lng: 24.9668 },
  'Bulgaria': { lat: 42.7339, lng: 25.4858 },
  'Ukraine': { lat: 48.3794, lng: 31.1656 },
  'Israel': { lat: 31.0461, lng: 34.8516 },
  'UAE': { lat: 23.4241, lng: 53.8478 },
  'Kenya': { lat: -0.0236, lng: 37.9062 },
  'Ghana': { lat: 7.9465, lng: -1.0232 },
  'Nigeria': { lat: 9.0820, lng: 8.6753 },
  'South Africa': { lat: -30.5595, lng: 22.9375 },
  'Egypt': { lat: 26.8206, lng: 30.8025 },
  'South Korea': { lat: 35.9078, lng: 127.7669 },
  'Japan': { lat: 36.2048, lng: 138.2529 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'Taiwan': { lat: 23.6978, lng: 120.9605 },
  'Thailand': { lat: 15.8700, lng: 100.9925 },
  'India': { lat: 20.5937, lng: 78.9629 },
  'Indonesia': { lat: -0.7893, lng: 113.9213 },
  'Malaysia': { lat: 4.2105, lng: 101.9758 },
  'Philippines': { lat: 12.8797, lng: 121.7740 },
  'Vietnam': { lat: 14.0583, lng: 108.2772 },
  'China': { lat: 35.8617, lng: 104.1954 },
  'Pakistan': { lat: 30.3753, lng: 69.3451 },
  'Brazil': { lat: -14.2350, lng: -51.9253 },
  'Argentina': { lat: -38.4161, lng: -63.6167 },
  'Chile': { lat: -35.6751, lng: -71.5430 },
  'Peru': { lat: -9.1900, lng: -75.0152 },
  'Colombia': { lat: 4.5709, lng: -74.2973 },
  'Mexico': { lat: 23.6345, lng: -102.5528 },
  'Australia': { lat: -25.2744, lng: 133.7751 },
  'New Zealand': { lat: -40.9006, lng: 174.8860 },
  'Canada': { lat: 56.1304, lng: -106.3468 },
};

interface Ambassador {
  id: string;
  name: string;
  joinDate: string;
  tenure?: string;
  city?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  communityProfileUrl?: string;
  linkedinUrl?: string;
  bio?: string;
  avatarUrl?: string;
}

interface AmbassadorData {
  lastUpdated: string;
  fetchedAt: string;
  source: string;
  current: Ambassador[];
  departed: Ambassador[];
  stats: {
    total: number;
    countries: number;
    avgTenureMonths: number;
    newestJoinDate: string;
    oldestJoinDate: string;
  };
  byMonth: Array<{
    month: string;
    total: number;
    joined: number;
    departed: number;
  }>;
  byCountry: Array<{
    country: string;
    count: number;
    coordinates?: { lat: number; lng: number };
  }>;
  byTenure: Array<{
    bucket: string;
    count: number;
  }>;
  locations: Array<{
    city: string;
    country: string;
    lat: number;
    lng: number;
    count: number;
  }>;
}

/**
 * Get coordinates for a city/country combination
 */
function getCoordinates(city?: string, country?: string): { lat: number; lng: number } | undefined {
  // Try city first
  if (city) {
    const cityNormalized = city.trim();
    if (cityCoordinates[cityNormalized]) {
      return cityCoordinates[cityNormalized];
    }
    // Try partial match
    for (const [name, coords] of Object.entries(cityCoordinates)) {
      if (cityNormalized.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(cityNormalized.toLowerCase())) {
        return coords;
      }
    }
  }

  // Fall back to country
  if (country) {
    const countryNormalized = country.trim();
    if (countryCoordinates[countryNormalized]) {
      return countryCoordinates[countryNormalized];
    }
    // Try partial match
    for (const [name, coords] of Object.entries(countryCoordinates)) {
      if (countryNormalized.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(countryNormalized.toLowerCase())) {
        return coords;
      }
    }
  }

  return undefined;
}

/**
 * Parse date string from Notion (various formats)
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;

  // Try various date formats
  const formats = [
    // ISO format
    /^(\d{4})-(\d{2})-(\d{2})/,
    // Month Day, Year
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
    // Day Month Year
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/,
    // Month Year
    /^([A-Za-z]+)\s+(\d{4})/,
  ];

  const monthNames: Record<string, string> = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12',
  };

  // ISO format
  const isoMatch = dateStr.match(formats[0]);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Month Day, Year
  const mdyMatch = dateStr.match(formats[1]);
  if (mdyMatch) {
    const month = monthNames[mdyMatch[1].toLowerCase()];
    if (month) {
      const day = mdyMatch[2].padStart(2, '0');
      return `${mdyMatch[3]}-${month}-${day}`;
    }
  }

  // Day Month Year
  const dmyMatch = dateStr.match(formats[2]);
  if (dmyMatch) {
    const month = monthNames[dmyMatch[2].toLowerCase()];
    if (month) {
      const day = dmyMatch[1].padStart(2, '0');
      return `${dmyMatch[3]}-${month}-${day}`;
    }
  }

  // Month Year (assume first of month)
  const myMatch = dateStr.match(formats[3]);
  if (myMatch) {
    const month = monthNames[myMatch[1].toLowerCase()];
    if (month) {
      return `${myMatch[2]}-${month}-01`;
    }
  }

  console.warn(`Could not parse date: ${dateStr}`);
  return null;
}

/**
 * Calculate tenure in months from join date
 */
function calculateTenureMonths(joinDate: string): number {
  const join = new Date(joinDate);
  const now = new Date();
  const months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
  return Math.max(0, months);
}

/**
 * Get tenure bucket label
 */
function getTenureBucket(months: number): string {
  if (months < 3) return '0-3 months';
  if (months < 6) return '3-6 months';
  if (months < 12) return '6-12 months';
  if (months < 24) return '1-2 years';
  return '2+ years';
}

/**
 * Generate monthly time series from join dates
 */
function generateMonthlyTimeSeries(
  ambassadors: Ambassador[],
  departed: Ambassador[] = []
): AmbassadorData['byMonth'] {
  const allAmbassadors = [...ambassadors, ...departed];
  if (allAmbassadors.length === 0) return [];

  // Find date range
  const dates = allAmbassadors
    .filter(a => a.joinDate)
    .map(a => new Date(a.joinDate))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return [];

  const startDate = dates[0];
  const endDate = new Date();

  const byMonth: AmbassadorData['byMonth'] = [];
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (current <= endDate) {
    const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

    // Count ambassadors who joined this month
    const joined = ambassadors.filter(a => {
      if (!a.joinDate) return false;
      const joinMonth = a.joinDate.substring(0, 7);
      return joinMonth === monthStr;
    }).length;

    // Count ambassadors who departed this month
    const departedThisMonth = departed.filter(a => {
      if (!a.joinDate) return false;
      // We don't have departure dates, so this would need to be tracked separately
      return false;
    }).length;

    // Count total active at end of month
    const total = ambassadors.filter(a => {
      if (!a.joinDate) return false;
      const joinMonth = a.joinDate.substring(0, 7);
      return joinMonth <= monthStr;
    }).length;

    byMonth.push({
      month: monthStr,
      total,
      joined,
      departed: departedThisMonth,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return byMonth;
}

/**
 * Aggregate ambassadors by country
 */
function aggregateByCountry(ambassadors: Ambassador[]): AmbassadorData['byCountry'] {
  const countryMap = new Map<string, { count: number; coordinates?: { lat: number; lng: number } }>();

  for (const ambassador of ambassadors) {
    if (!ambassador.country) continue;

    const existing = countryMap.get(ambassador.country) || { count: 0 };
    countryMap.set(ambassador.country, {
      count: existing.count + 1,
      coordinates: existing.coordinates || ambassador.coordinates || getCoordinates(undefined, ambassador.country),
    });
  }

  return Array.from(countryMap.entries())
    .map(([country, data]) => ({ country, ...data }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Aggregate ambassadors by tenure bucket
 */
function aggregateByTenure(ambassadors: Ambassador[]): AmbassadorData['byTenure'] {
  const buckets = new Map<string, number>();
  const bucketOrder = ['0-3 months', '3-6 months', '6-12 months', '1-2 years', '2+ years'];

  for (const bucket of bucketOrder) {
    buckets.set(bucket, 0);
  }

  for (const ambassador of ambassadors) {
    if (!ambassador.joinDate) continue;
    const months = calculateTenureMonths(ambassador.joinDate);
    const bucket = getTenureBucket(months);
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }

  return bucketOrder.map(bucket => ({
    bucket,
    count: buckets.get(bucket) || 0,
  }));
}

/**
 * Aggregate locations for map
 */
function aggregateLocations(ambassadors: Ambassador[]): AmbassadorData['locations'] {
  const locationMap = new Map<string, AmbassadorData['locations'][0]>();

  for (const ambassador of ambassadors) {
    if (!ambassador.coordinates) continue;

    const key = `${ambassador.city || 'Unknown'},${ambassador.country || 'Unknown'}`;
    const existing = locationMap.get(key);

    if (existing) {
      existing.count++;
    } else {
      locationMap.set(key, {
        city: ambassador.city || 'Unknown',
        country: ambassador.country || 'Unknown',
        lat: ambassador.coordinates.lat,
        lng: ambassador.coordinates.lng,
        count: 1,
      });
    }
  }

  return Array.from(locationMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Extract ambassador links from gallery page
 */
async function extractAmbassadorLinks(page: any): Promise<Array<{ name: string; id: string; url: string; avatarUrl?: string; country?: string }>> {
  return page.evaluate(() => {
    const results: Array<{ name: string; id: string; url: string; avatarUrl?: string; country?: string }> = [];

    // Find all collection item links (gallery cards)
    // Pattern: href="/Name-Name-UUID?pvs=25"
    const links = document.querySelectorAll('a[href*="?pvs="]');

    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // Parse the href to extract name and ID
      // Format: /Name-Name-UUID?pvs=25
      const match = href.match(/^\/([A-Za-z0-9-]+)-([0-9a-f]{32})\?/);
      if (match) {
        const namePart = match[1];
        const id = match[2];

        // Convert dashes to spaces for the name
        const name = namePart.replace(/-/g, ' ').trim();

        // Extract avatar image from the gallery card
        let avatarUrl: string | undefined;
        const img = link.querySelector('img[src*="attachment"]');
        if (img) {
          const src = img.getAttribute('src');
          if (src) {
            // Convert relative URL to absolute
            avatarUrl = src.startsWith('/') ? `https://n8n.notion.site${src}` : src;
          }
        }

        // Extract country from gallery card tags
        // Look for text that matches country names with flag emoji
        let country: string | undefined;
        const cardText = link.textContent || '';
        // Common countries in ambassador program
        const countryPatterns = [
          'Netherlands', 'Germany', 'France', 'Spain', 'United Kingdom', 'UK',
          'Italy', 'Belgium', 'Austria', 'Switzerland', 'Poland', 'Portugal',
          'Denmark', 'Sweden', 'Norway', 'Finland', 'Ireland', 'Czech Republic',
          'Hungary', 'Romania', 'Greece', 'Turkey', 'Israel', 'UAE',
          'Kenya', 'Ghana', 'Nigeria', 'South Africa', 'Egypt',
          'Japan', 'South Korea', 'Singapore', 'Taiwan', 'Thailand', 'India',
          'Indonesia', 'Malaysia', 'Philippines', 'Vietnam', 'China', 'Pakistan',
          'Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Mexico',
          'Australia', 'New Zealand', 'Canada', 'United States', 'USA',
        ];
        for (const countryName of countryPatterns) {
          if (cardText.includes(countryName)) {
            country = countryName;
            break;
          }
        }

        results.push({
          name,
          id,
          url: `https://n8n.notion.site${href.split('?')[0]}`,
          avatarUrl,
          country,
        });
      }
    }

    return results;
  });
}

// City to country mapping for common ambassador locations
const cityToCountry: Record<string, string> = {
  // Europe
  'Amsterdam': 'Netherlands', 'Rotterdam': 'Netherlands', 'Utrecht': 'Netherlands', 'Eindhoven': 'Netherlands', 'Groenlo': 'Netherlands',
  'Berlin': 'Germany', 'Munich': 'Germany', 'Hamburg': 'Germany', 'Frankfurt': 'Germany', 'Cologne': 'Germany', 'Dresden': 'Germany', 'Düsseldorf': 'Germany',
  'London': 'United Kingdom', 'Manchester': 'United Kingdom', 'Birmingham': 'United Kingdom', 'Edinburgh': 'Scotland', 'Glasgow': 'Scotland',
  'Paris': 'France', 'Lyon': 'France', 'Nantes': 'France', 'Marseille': 'France', 'Toulouse': 'France', 'Lille': 'France',
  'Madrid': 'Spain', 'Barcelona': 'Spain', 'Valencia': 'Spain', 'Seville': 'Spain',
  'Rome': 'Italy', 'Milan': 'Italy', 'Naples': 'Italy', 'Turin': 'Italy', 'Florence': 'Italy',
  'Vienna': 'Austria', 'Graz': 'Austria', 'Salzburg': 'Austria',
  'Zürich': 'Switzerland', 'Zurich': 'Switzerland', 'Geneva': 'Switzerland', 'Bern': 'Switzerland', 'Lausanne': 'Switzerland', 'Basel': 'Switzerland',
  'Brussels': 'Belgium', 'Antwerp': 'Belgium', 'Ghent': 'Belgium', 'Gent': 'Belgium', 'Wallonia': 'Belgium',
  'Copenhagen': 'Denmark', 'København': 'Denmark', 'Aarhus': 'Denmark',
  'Stockholm': 'Sweden', 'Gothenburg': 'Sweden', 'Malmö': 'Sweden',
  'Oslo': 'Norway', 'Bergen': 'Norway',
  'Helsinki': 'Finland', 'Espoo': 'Finland',
  'Dublin': 'Ireland', 'Cork': 'Ireland',
  'Warsaw': 'Poland', 'Krakow': 'Poland', 'Kraków': 'Poland', 'Poznan': 'Poland',
  'Prague': 'Czech Republic', 'Brno': 'Czech Republic',
  'Budapest': 'Hungary',
  'Bucharest': 'Romania', 'Cluj': 'Romania',
  'Sofia': 'Bulgaria',
  'Athens': 'Greece', 'Thessaloniki': 'Greece',
  'Lisbon': 'Portugal', 'Porto': 'Portugal',
  'Istanbul': 'Turkey', 'Ankara': 'Turkey', 'Izmir': 'Turkey',
  'Kyiv': 'Ukraine', 'Lviv': 'Ukraine',
  // Middle East
  'Tel Aviv': 'Israel', 'Jerusalem': 'Israel', 'Haifa': 'Israel',
  'Dubai': 'UAE', 'Abu Dhabi': 'UAE',
  'Doha': 'Qatar',
  'Riyadh': 'Saudi Arabia',
  // Africa
  'Nairobi': 'Kenya', 'Mombasa': 'Kenya',
  'Accra': 'Ghana',
  'Lagos': 'Nigeria', 'Abuja': 'Nigeria',
  'Cairo': 'Egypt', 'Alexandria': 'Egypt',
  'Cape Town': 'South Africa', 'Johannesburg': 'South Africa', 'Pretoria': 'South Africa',
  'Casablanca': 'Morocco', 'Marrakech': 'Morocco',
  // Asia
  'Tokyo': 'Japan', 'Osaka': 'Japan', 'Kyoto': 'Japan', 'Nagoya': 'Japan',
  'Seoul': 'South Korea', 'Busan': 'South Korea',
  'Singapore': 'Singapore',
  'Hong Kong': 'Hong Kong',
  'Taipei': 'Taiwan', 'Kaohsiung': 'Taiwan',
  'Bangkok': 'Thailand', 'Chiang Mai': 'Thailand',
  'Kuala Lumpur': 'Malaysia', 'Penang': 'Malaysia',
  'Jakarta': 'Indonesia', 'Bali': 'Indonesia',
  'Manila': 'Philippines', 'Cebu': 'Philippines',
  'Ho Chi Minh City': 'Vietnam', 'Hanoi': 'Vietnam',
  'Mumbai': 'India', 'Bangalore': 'India', 'Bengaluru': 'India', 'Delhi': 'India', 'Hyderabad': 'India', 'Chennai': 'India', 'Pune': 'India',
  'Shanghai': 'China', 'Beijing': 'China', 'Shenzhen': 'China', 'Guangzhou': 'China',
  'Islamabad': 'Pakistan', 'Karachi': 'Pakistan', 'Lahore': 'Pakistan',
  // Americas
  'New York': 'United States', 'NYC': 'United States', 'Los Angeles': 'United States', 'San Francisco': 'United States',
  'Chicago': 'United States', 'Houston': 'United States', 'Dallas': 'United States', 'Austin': 'United States',
  'Miami': 'United States', 'Atlanta': 'United States', 'Seattle': 'United States', 'Denver': 'United States',
  'Boston': 'United States', 'Phoenix': 'United States', 'Portland': 'United States', 'San Diego': 'United States',
  'Toronto': 'Canada', 'Vancouver': 'Canada', 'Montreal': 'Canada', 'Calgary': 'Canada', 'Ottawa': 'Canada',
  'Mexico City': 'Mexico', 'Guadalajara': 'Mexico', 'Monterrey': 'Mexico',
  'São Paulo': 'Brazil', 'Sao Paulo': 'Brazil', 'Rio de Janeiro': 'Brazil', 'Brasilia': 'Brazil',
  'Buenos Aires': 'Argentina', 'Córdoba': 'Argentina',
  'Santiago': 'Chile',
  'Lima': 'Peru',
  'Bogota': 'Colombia', 'Bogotá': 'Colombia', 'Medellín': 'Colombia',
  // Oceania
  'Sydney': 'Australia', 'Melbourne': 'Australia', 'Brisbane': 'Australia', 'Perth': 'Australia',
  'Auckland': 'New Zealand', 'Wellington': 'New Zealand',
};

/**
 * Extract detailed ambassador info from their detail page
 */
async function extractAmbassadorDetails(
  page: any,
  ambassador: { name: string; id: string; url: string }
): Promise<Partial<Ambassador>> {
  const details: Partial<Ambassador> = {};

  try {
    await page.goto(ambassador.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract all text content and property values
    const ambassadorName = ambassador.name;
    const pageData = await page.evaluate((name: string) => {
      const data: Record<string, string> = {};

      // Get all text content from the page
      const allText = document.body.innerText;

      // Find join date - look for specific patterns in Notion
      // Pattern 1: "Joined\nMonth Day, Year" or "Joined\nMonth DD, YYYY"
      const joinedMatch = allText.match(/Joined\s*\n\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
      if (joinedMatch) {
        data.joinDate = joinedMatch[1].trim();
      }

      // Pattern 2: Look for dates in property section (usually near the top)
      if (!data.joinDate) {
        const datePatterns = [
          /(?:Joined|Join Date|Member since)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
          /(?:Joined|Join Date|Member since)[:\s]*(\d{4}-\d{2}-\d{2})/i,
        ];
        for (const pattern of datePatterns) {
          const match = allText.match(pattern);
          if (match) {
            data.joinDate = match[1].trim();
            break;
          }
        }
      }

      // Find location - Notion shows it at the top of the page
      // Look for the city name that appears after the ambassador's name
      // The structure is typically: "Name\nCity\nActivities..."
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      // Skip common navigation/header text and find potential city
      const skipWords = ['Activities', 'Meetups', 'Workshops', 'Events', 'Online', 'Joined', 'n8n', 'Ambassador', 'Profile', 'About', 'Bio', 'Location', 'City', 'Based', 'Skip', 'content', 'Navigation', 'Menu', 'Search', 'Home', 'Back', 'Share', 'Link', 'Copy', 'Page', 'Toggle', 'Notion', 'free', 'Get', 'Sign', 'Log', 'Create', 'Template', 'Duplicate', 'Comment', 'Comments', 'Add', 'New', 'Edit', 'Delete', 'Move', 'Turn', 'Drag', 'Type', 'Press', 'Click', 'Select', 'Open', 'Close', 'Expand', 'Collapse'];
      const nameParts = name.toLowerCase().split(' ');

      for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const line = lines[i];
        // Skip if it's a common section header or navigation item
        if (skipWords.some(w => line.toLowerCase().includes(w.toLowerCase()))) continue;
        // Skip if it contains special characters or is too long (likely content, not a city)
        if (line.length > 50 || /[<>{}[\]@#$%^&*()+=]/.test(line)) continue;
        // Skip if it starts with a number (likely a date or count)
        if (/^\d/.test(line)) continue;
        // Skip if it matches ambassador name
        if (nameParts.some(part => line.toLowerCase().includes(part))) continue;

        // Check if this looks like a city name (usually 1-3 words, proper capitalization)
        if (/^[A-Z][a-zA-Zäöüß\s-]+$/.test(line) && line.split(' ').length <= 4) {
          data.city = line;
          break;
        }
      }

      // Find profile links
      const links = document.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (href.includes('community.n8n.io') || href.includes('forum.n8n.io')) {
          data.communityProfileUrl = href;
        } else if (href.includes('linkedin.com')) {
          data.linkedinUrl = href;
        }
      }

      // Find tenure if displayed
      const tenureMatch = allText.match(/(?:Tenure|Member for)[:\s]*(\d+\s*(?:months?|years?))/i);
      if (tenureMatch) {
        data.tenure = tenureMatch[1];
      }

      return data;
    }, ambassadorName);

    if (pageData.joinDate) details.joinDate = pageData.joinDate;

    // Process city and derive country
    if (pageData.city) {
      const city = pageData.city.trim();
      details.city = city;

      // Look up country from city
      const country = cityToCountry[city];
      if (country) {
        details.country = country;
      }
    }

    if (pageData.communityProfileUrl) details.communityProfileUrl = pageData.communityProfileUrl;
    if (pageData.linkedinUrl) details.linkedinUrl = pageData.linkedinUrl;
    if (pageData.tenure) details.tenure = pageData.tenure;

  } catch (e) {
    console.warn(`  Could not load details for ${ambassador.name}: ${e}`);
  }

  return details;
}

// Rate limiting delay between detail page fetches (in ms)
const RATE_LIMIT_DELAY = 2000;

/**
 * Extract avatar URL from n8n community profile
 * Community profiles have avatars at predictable URLs
 */
async function fetchCommunityAvatar(communityProfileUrl: string): Promise<string | null> {
  if (!communityProfileUrl) return null;

  try {
    // Extract username from URL like https://community.n8n.io/u/nate-haskins/summary
    const match = communityProfileUrl.match(/\/u\/([^\/]+)/);
    if (!match) return null;

    const username = match[1];
    // Discourse API endpoint for user info
    const apiUrl = `https://community.n8n.io/u/${username}.json`;

    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.user?.avatar_template) {
      // Avatar template is like /user_avatar/community.n8n.io/{username}/{size}/{id}_2.png
      // Replace {size} with actual size
      const avatarUrl = data.user.avatar_template.replace('{size}', '240');
      return avatarUrl.startsWith('http') ? avatarUrl : `https://community.n8n.io${avatarUrl}`;
    }
  } catch (e) {
    // Silently fail - we'll use initials as fallback
  }

  return null;
}

/**
 * Scroll to bottom of page to load all lazy-loaded content
 * Notion uses virtualized lists, so we need to scroll incrementally
 */
async function scrollToLoadAll(page: any, maxScrolls = 50, expectedMin = 60): Promise<void> {
  let previousCount = 0;
  let scrollAttempts = 0;
  let noChangeCount = 0;

  console.log(`  Expecting at least ${expectedMin} ambassadors...`);

  while (scrollAttempts < maxScrolls) {
    // Get current count of ambassador links
    const currentCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="?pvs="]').length;
    });

    // Check if we've stopped finding new items
    if (currentCount === previousCount) {
      noChangeCount++;
      // Only stop if we've had 5 consecutive no-change scrolls AND we've hit expected minimum
      if (noChangeCount >= 5 && currentCount >= expectedMin) {
        console.log(`  All content loaded (${currentCount} items after ${scrollAttempts} scrolls)`);
        break;
      }
      // If we haven't hit expected minimum, keep trying but warn after many attempts
      if (noChangeCount >= 10) {
        console.log(`  Warning: Only found ${currentCount} items after ${scrollAttempts} scrolls (expected ${expectedMin}+)`);
        break;
      }
    } else {
      noChangeCount = 0;
    }

    previousCount = currentCount;
    scrollAttempts++;

    // Scroll incrementally - Notion may have virtualized content
    await page.evaluate(() => {
      // Try scrolling the main scroller or window
      const scroller = document.querySelector('.notion-scroller') ||
                       document.querySelector('[class*="notion-frame"]') ||
                       document.documentElement;
      if (scroller && scroller !== document.documentElement) {
        scroller.scrollTop = scroller.scrollTop + 1000;
      } else {
        window.scrollBy(0, 1000);
      }
    });

    // Wait for content to load - Notion needs time
    await page.waitForTimeout(2000);

    // Also scroll to absolute bottom periodically
    if (scrollAttempts % 3 === 0) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1500);
    }

    if (scrollAttempts % 5 === 0) {
      console.log(`  Scrolled ${scrollAttempts} times, found ${currentCount} items so far...`);
    }
  }

  // Scroll through entire page to ensure all images are rendered
  // Notion virtualizes the gallery, so we need to scroll slowly through everything
  console.log('  Scrolling through page to render all images...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);

  // Scroll down in increments to trigger image loading
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  let currentScroll = 0;

  while (currentScroll < totalHeight) {
    await page.evaluate((y: number) => window.scrollTo(0, y), currentScroll);
    await page.waitForTimeout(500);
    currentScroll += viewportHeight * 0.8;
  }

  // Final scroll to bottom and wait
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
}

/**
 * Scrape ambassadors from Notion page using Playwright
 */
async function scrapeAmbassadors(): Promise<Ambassador[]> {
  console.log('Launching browser...');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    console.log(`Navigating to ${NOTION_PAGE_URL}...`);
    await page.goto(NOTION_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });

    // Wait for the database/gallery to load (Notion is JavaScript-heavy)
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);

    // Wait for Notion's main content to appear
    try {
      await page.waitForSelector('[class*="notion-page-content"], [class*="notion-collection"]', { timeout: 30000 });
    } catch (e) {
      console.log('Could not find Notion content selector, continuing...');
    }

    // Wait a bit more for initial content to render
    await page.waitForTimeout(3000);

    // Scroll to load all lazy-loaded ambassadors
    console.log('Scrolling to load all ambassadors...');
    await scrollToLoadAll(page);

    // Save a snapshot for debugging
    const pageContent = await page.content();
    const snapshotPath = join(SNAPSHOTS_DIR, `notion-debug-${new Date().toISOString().split('T')[0]}.html`);
    if (!existsSync(SNAPSHOTS_DIR)) {
      mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }
    writeFileSync(snapshotPath, pageContent);
    console.log(`Saved page snapshot to ${snapshotPath}`);

    // Extract ambassador links from gallery
    const ambassadorLinks = await extractAmbassadorLinks(page);
    console.log(`Found ${ambassadorLinks.length} ambassadors in gallery`);

    if (ambassadorLinks.length === 0) {
      console.warn('No ambassadors found in gallery. Check the page structure.');
      return [];
    }

    // Build ambassador list with detailed info
    const ambassadors: Ambassador[] = [];

    console.log(`\nFetching details for each ambassador (${RATE_LIMIT_DELAY}ms delay between requests)...`);

    for (let i = 0; i < ambassadorLinks.length; i++) {
      const link = ambassadorLinks[i];
      console.log(`  [${i + 1}/${ambassadorLinks.length}] Fetching details for ${link.name}...`);

      const ambassador: Ambassador = {
        id: link.id,
        name: link.name,
        joinDate: '',
        // Use country and avatarUrl from gallery extraction
        country: link.country,
        avatarUrl: link.avatarUrl,
      };

      // Fetch details from individual pages (for joinDate, city, links)
      const details = await extractAmbassadorDetails(page, link);
      // Don't overwrite country if already extracted from gallery (more reliable)
      const { country: _detailCountry, ...otherDetails } = details;
      Object.assign(ambassador, otherDetails);

      // Only use detail page country if gallery didn't have one
      if (!ambassador.country && details.country) {
        ambassador.country = details.country;
      }

      // If no avatar from Notion, try to get from community profile
      if (!ambassador.avatarUrl && ambassador.communityProfileUrl) {
        console.log(`    Fetching community avatar for ${ambassador.name}...`);
        const communityAvatar = await fetchCommunityAvatar(ambassador.communityProfileUrl);
        if (communityAvatar) {
          ambassador.avatarUrl = communityAvatar;
        }
      }

      // Add coordinates if we have location info
      ambassador.coordinates = getCoordinates(ambassador.city, ambassador.country);

      ambassadors.push(ambassador);

      // Rate limiting delay between detail page fetches
      if (i < ambassadorLinks.length - 1) {
        await page.waitForTimeout(RATE_LIMIT_DELAY);
      }
    }

    return ambassadors;

  } finally {
    await browser.close();
  }
}

/**
 * Load existing ambassador data
 */
function loadExistingData(): AmbassadorData | null {
  if (!existsSync(AMBASSADORS_PATH)) return null;

  try {
    return JSON.parse(readFileSync(AMBASSADORS_PATH, 'utf-8'));
  } catch (e) {
    console.warn('Could not load existing ambassador data:', e);
    return null;
  }
}

/**
 * Detect departed ambassadors
 */
function detectDeparted(
  previous: Ambassador[],
  current: Ambassador[]
): Ambassador[] {
  const currentIds = new Set(current.map(a => a.id));
  return previous.filter(a => !currentIds.has(a.id));
}

async function main() {
  console.log('Fetching n8n Ambassadors from Notion...\n');

  // Ensure directories exist
  const historyDir = join(process.cwd(), 'public', 'data', 'history');
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  // Scrape current ambassadors
  let ambassadors: Ambassador[];
  try {
    ambassadors = await scrapeAmbassadors();
  } catch (e) {
    console.error('Failed to scrape ambassadors:', e);
    console.log('\nNote: If this fails consistently, the Notion page structure may have changed.');
    console.log('Check the debug HTML snapshot in public/data/snapshots/');
    process.exit(1);
  }

  if (ambassadors.length === 0) {
    console.warn('\nNo ambassadors extracted. This may indicate:');
    console.warn('  1. The Notion page structure has changed');
    console.warn('  2. The page requires authentication');
    console.warn('  3. Network issues prevented loading');
    console.warn('\nCheck the debug snapshot and update the scraping logic if needed.');

    // Don't overwrite existing data with empty data
    const existing = loadExistingData();
    if (existing && existing.current.length > 0) {
      console.log(`\nKeeping existing data with ${existing.current.length} ambassadors.`);
      return;
    }
  }

  // Load previous data to detect changes
  const previousData = loadExistingData();
  const previousAmbassadors = previousData?.current || [];
  const previousDeparted = previousData?.departed || [];

  // Detect newly departed
  const newDeparted = detectDeparted(previousAmbassadors, ambassadors);
  if (newDeparted.length > 0) {
    console.log(`\nDetected ${newDeparted.length} departed ambassadors`);
  }

  // Merge departed lists
  const allDeparted = [...previousDeparted, ...newDeparted];

  // Parse join dates to ISO format for proper sorting
  const parseJoinDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    // Parse "Month Day, Year" format
    const match = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (match) {
      const monthNames: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12',
      };
      const month = monthNames[match[1].toLowerCase()];
      if (month) {
        const day = match[2].padStart(2, '0');
        return `${match[3]}-${month}-${day}`;
      }
    }
    // Already ISO format?
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.substring(0, 10);
    }
    return null;
  };

  // Calculate statistics
  const joinDates = ambassadors
    .filter(a => a.joinDate)
    .map(a => ({ original: a.joinDate, parsed: parseJoinDate(a.joinDate) }))
    .filter(d => d.parsed !== null)
    .sort((a, b) => a.parsed!.localeCompare(b.parsed!))
    .map(d => d.original);

  const countries = new Set(ambassadors.map(a => a.country).filter(Boolean));

  const tenureMonths = ambassadors
    .filter(a => a.joinDate)
    .map(a => calculateTenureMonths(a.joinDate));

  const avgTenureMonths = tenureMonths.length > 0
    ? Math.round(tenureMonths.reduce((a, b) => a + b, 0) / tenureMonths.length)
    : 0;

  // Build data structure
  const ambassadorData: AmbassadorData = {
    lastUpdated: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    source: NOTION_PAGE_URL,
    current: ambassadors,
    departed: allDeparted,
    stats: {
      total: ambassadors.length,
      countries: countries.size,
      avgTenureMonths,
      newestJoinDate: joinDates.length > 0 ? joinDates[joinDates.length - 1] : '',
      oldestJoinDate: joinDates.length > 0 ? joinDates[0] : '',
    },
    byMonth: generateMonthlyTimeSeries(ambassadors, allDeparted),
    byCountry: aggregateByCountry(ambassadors),
    byTenure: aggregateByTenure(ambassadors),
    locations: aggregateLocations(ambassadors),
  };

  // Save data
  writeFileSync(AMBASSADORS_PATH, JSON.stringify(ambassadorData, null, 2));
  console.log(`\nSaved ambassador data to ${AMBASSADORS_PATH}`);

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Total ambassadors: ${ambassadorData.stats.total}`);
  console.log(`Countries represented: ${ambassadorData.stats.countries}`);
  console.log(`Average tenure: ${ambassadorData.stats.avgTenureMonths} months`);
  if (ambassadorData.stats.oldestJoinDate) {
    console.log(`Oldest join: ${ambassadorData.stats.oldestJoinDate}`);
  }
  if (ambassadorData.stats.newestJoinDate) {
    console.log(`Newest join: ${ambassadorData.stats.newestJoinDate}`);
  }
  console.log(`Departed: ${allDeparted.length}`);

  if (ambassadorData.byCountry.length > 0) {
    console.log(`\nTop countries:`);
    for (const c of ambassadorData.byCountry.slice(0, 5)) {
      console.log(`  ${c.country}: ${c.count}`);
    }
  }
}

main().catch(console.error);
