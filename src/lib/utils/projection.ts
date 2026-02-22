/**
 * Shared Robinson projection utilities
 * Extracted from EventsMapChart for reuse across map components.
 *
 * Map source: SVG-World-Map by Raphael Lepuschitz (MIT License)
 * https://github.com/raphaellepuschitz/SVG-World-Map
 */

// SVG dimensions for Robinson projection (matching world-robinson.svg)
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 507.209;

// Lookup table for Robinson projection (latitude in 5-degree increments)
// PLEN = parallel length factor, PDFE = distance from equator factor
export const robinsonTable = [
  { lat: 0, plen: 1.0000, pdfe: 0.0000 },
  { lat: 5, plen: 0.9986, pdfe: 0.0620 },
  { lat: 10, plen: 0.9954, pdfe: 0.1240 },
  { lat: 15, plen: 0.9900, pdfe: 0.1860 },
  { lat: 20, plen: 0.9822, pdfe: 0.2480 },
  { lat: 25, plen: 0.9730, pdfe: 0.3100 },
  { lat: 30, plen: 0.9600, pdfe: 0.3720 },
  { lat: 35, plen: 0.9427, pdfe: 0.4340 },
  { lat: 40, plen: 0.9216, pdfe: 0.4958 },
  { lat: 45, plen: 0.8962, pdfe: 0.5571 },
  { lat: 50, plen: 0.8679, pdfe: 0.6176 },
  { lat: 55, plen: 0.8350, pdfe: 0.6769 },
  { lat: 60, plen: 0.7986, pdfe: 0.7346 },
  { lat: 65, plen: 0.7597, pdfe: 0.7903 },
  { lat: 70, plen: 0.7186, pdfe: 0.8435 },
  { lat: 75, plen: 0.6732, pdfe: 0.8936 },
  { lat: 80, plen: 0.6213, pdfe: 0.9394 },
  { lat: 85, plen: 0.5722, pdfe: 0.9761 },
  { lat: 90, plen: 0.5322, pdfe: 1.0000 },
];

/** Interpolate Robinson projection values for any latitude */
export function interpolateRobinson(absLat: number): { plen: number; pdfe: number } {
  const lat = Math.min(90, Math.abs(absLat));
  const index = Math.floor(lat / 5);
  const nextIndex = Math.min(index + 1, robinsonTable.length - 1);
  const t = (lat - index * 5) / 5;

  const plen = robinsonTable[index].plen + t * (robinsonTable[nextIndex].plen - robinsonTable[index].plen);
  const pdfe = robinsonTable[index].pdfe + t * (robinsonTable[nextIndex].pdfe - robinsonTable[index].pdfe);

  return { plen, pdfe };
}

// Calibrated projection parameters using country center positions:
// - GB center at x~469 (London at lng~0 degrees)
// - JP center at x~825 (Tokyo at lng~140 degrees)
const centerX = 469.3;
const centerY = MAP_HEIGHT / 2;
const scale = 182.91;

/** Convert lat/lng to x/y coordinates in SVG space */
export function latLngToXY(lat: number, lng: number): { x: number; y: number } {
  const { plen, pdfe } = interpolateRobinson(lat);

  // Normalize longitude to [-180, 180]
  const normLng = ((lng + 180) % 360) - 180;

  // X: Robinson projection formula with calibrated scale
  let x = centerX + scale * 0.8487 * (normLng * Math.PI / 180) * plen;

  // SVG-specific corrections for regions where country boundaries
  // don't perfectly match the Robinson projection formula
  if (normLng > 0 && normLng <= 50) {
    x += 5;
  } else if (normLng > 100) {
    x += (normLng - 100) * 0.6;
  }

  // Y: Robinson projection formula (north is up, so subtract from center)
  let y = centerY - scale * 1.3523 * pdfe * (lat >= 0 ? 1 : -1);

  // Southern Canada / Great Lakes region: shift markers slightly north
  if (lat >= 40 && lat <= 55 && normLng >= -100 && normLng <= -50) {
    y -= 8;
  }

  return { x, y };
}

export interface Pin {
  x: number;
  y: number;
  [key: string]: unknown;
}

/**
 * Resolve collisions between pins by iteratively pushing overlapping pins apart.
 * Simple repulsion: 3 passes, O(n^2) which is fine for n~30.
 */
export function resolveCollisions<T extends Pin>(pins: T[], minDistance: number): T[] {
  const result = pins.map(p => ({ ...p }));
  const passes = 3;

  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[j].x - result[i].x;
        const dy = result[j].y - result[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance && dist > 0) {
          const overlap = (minDistance - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;

          result[i].x -= nx * overlap;
          result[i].y -= ny * overlap;
          result[j].x += nx * overlap;
          result[j].y += ny * overlap;
        } else if (dist === 0) {
          // Identical positions: nudge apart arbitrarily
          result[j].x += minDistance / 2;
          result[i].x -= minDistance / 2;
        }
      }
    }
  }

  return result;
}
