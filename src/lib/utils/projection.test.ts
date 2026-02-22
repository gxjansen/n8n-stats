import { describe, it, expect } from 'vitest';
import { latLngToXY, resolveCollisions, MAP_WIDTH, MAP_HEIGHT } from './projection';

describe('latLngToXY', () => {
  it('maps London (51.5, -0.1) near center-x of the SVG', () => {
    const { x, y } = latLngToXY(51.5, -0.1);
    // London should be close to the calibration center (469.3)
    expect(x).toBeGreaterThan(460);
    expect(x).toBeLessThan(480);
    // Northern hemisphere: y should be above center
    expect(y).toBeLessThan(MAP_HEIGHT / 2);
  });

  it('maps Tokyo (35.7, 139.7) to the right side of the map', () => {
    const { x, y } = latLngToXY(35.7, 139.7);
    // Tokyo should be well to the right
    expect(x).toBeGreaterThan(800);
    expect(x).toBeLessThan(900);
    // Northern hemisphere
    expect(y).toBeLessThan(MAP_HEIGHT / 2);
  });

  it('maps equator at lng=0 to roughly the center', () => {
    const { x, y } = latLngToXY(0, 0);
    // Should be near center x (with small correction for 0-50 lng range)
    expect(x).toBeGreaterThan(460);
    expect(x).toBeLessThan(490);
    // Equator should be near vertical center
    expect(y).toBeCloseTo(MAP_HEIGHT / 2, 0);
  });

  it('keeps results within map bounds', () => {
    const testCases = [
      { lat: 90, lng: 0 },
      { lat: -90, lng: 0 },
      { lat: 0, lng: 180 },
      { lat: 0, lng: -180 },
      { lat: -33.9, lng: 18.4 },  // Cape Town
      { lat: -34.6, lng: -58.4 }, // Buenos Aires
    ];

    for (const { lat, lng } of testCases) {
      const { x, y } = latLngToXY(lat, lng);
      expect(x).toBeGreaterThan(-50);
      expect(x).toBeLessThan(MAP_WIDTH + 50);
      expect(y).toBeGreaterThan(-50);
      expect(y).toBeLessThan(MAP_HEIGHT + 50);
    }
  });
});

describe('resolveCollisions', () => {
  it('pushes overlapping pins apart to at least minDistance', () => {
    const pins = [
      { x: 100, y: 100 },
      { x: 102, y: 100 }, // 2px apart, less than minDistance
    ];

    const result = resolveCollisions(pins, 20);
    const dx = result[1].x - result[0].x;
    const dy = result[1].y - result[0].y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    expect(dist).toBeGreaterThanOrEqual(19); // Allow small floating point tolerance
  });

  it('does not move pins that are already far apart', () => {
    const pins = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ];

    const result = resolveCollisions(pins, 20);
    expect(result[0].x).toBe(100);
    expect(result[0].y).toBe(100);
    expect(result[1].x).toBe(200);
    expect(result[1].y).toBe(200);
  });

  it('handles identical positions without error', () => {
    const pins = [
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    ];

    const result = resolveCollisions(pins, 20);
    const dx = result[1].x - result[0].x;
    const dy = result[1].y - result[0].y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    expect(dist).toBeGreaterThan(0);
  });

  it('does not mutate the input array', () => {
    const pins = [
      { x: 100, y: 100 },
      { x: 102, y: 100 },
    ];

    resolveCollisions(pins, 20);
    expect(pins[0].x).toBe(100);
    expect(pins[1].x).toBe(102);
  });

  it('handles empty array', () => {
    const result = resolveCollisions([], 20);
    expect(result).toEqual([]);
  });

  it('handles single pin', () => {
    const result = resolveCollisions([{ x: 50, y: 50 }], 20);
    expect(result).toEqual([{ x: 50, y: 50 }]);
  });

  it('resolves cluster of European-like pins', () => {
    // Simulate several European countries close together
    const pins = [
      { x: 470, y: 150, country: 'NL' },
      { x: 472, y: 155, country: 'BE' },
      { x: 475, y: 148, country: 'DE' },
      { x: 468, y: 160, country: 'FR' },
      { x: 474, y: 163, country: 'CH' },
    ];

    const result = resolveCollisions(pins, 15);

    // Check no pair is closer than ~14 (allowing small tolerance)
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[j].x - result[i].x;
        const dy = result[j].y - result[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThanOrEqual(13);
      }
    }
  });
});
