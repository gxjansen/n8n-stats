import { describe, it, expect } from 'vitest';
import {
  predictMilestone,
  formatPredictedDate,
  formatDaysUntil,
  getNextMilestones,
} from './predictions';

describe('predictMilestone', () => {
  it('returns low confidence with insufficient data points', () => {
    const data = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 110 },
    ];

    const result = predictMilestone(data, 1000, { minDataPoints: 4 });
    expect(result.confidence).toBe('low');
    expect(result.predictedDate).toBeNull();
  });

  it('returns null prediction for milestone already reached', () => {
    const data = [
      { date: '2024-01-01', value: 900 },
      { date: '2024-01-02', value: 950 },
      { date: '2024-01-03', value: 1000 },
      { date: '2024-01-04', value: 1050 },
      { date: '2024-01-05', value: 1100 },
    ];

    const result = predictMilestone(data, 1000);
    expect(result.predictedDate).toBeNull();
    expect(result.currentValue).toBe(1100);
    expect(result.confidence).toBe('high');
  });

  it('returns null prediction for negative or zero growth', () => {
    const data = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 95 },
      { date: '2024-01-03', value: 90 },
      { date: '2024-01-04', value: 85 },
      { date: '2024-01-05', value: 80 },
    ];

    const result = predictMilestone(data, 200);
    expect(result.predictedDate).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.growthPerDay).toBeLessThan(0);
  });

  it('calculates positive growth rate correctly', () => {
    const data = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 110 },
      { date: '2024-01-03', value: 120 },
      { date: '2024-01-04', value: 130 },
      { date: '2024-01-05', value: 140 },
    ];

    const result = predictMilestone(data, 500);
    expect(result.growthPerDay).toBeGreaterThan(0);
    expect(result.currentValue).toBe(140);
  });

  it('filters out zero/negative values', () => {
    const data = [
      { date: '2024-01-01', value: 0 },
      { date: '2024-01-02', value: -10 },
      { date: '2024-01-03', value: 100 },
      { date: '2024-01-04', value: 110 },
      { date: '2024-01-05', value: 120 },
      { date: '2024-01-06', value: 130 },
    ];

    const result = predictMilestone(data, 200);
    expect(result.currentValue).toBe(130);
  });
});

describe('formatPredictedDate', () => {
  it('returns "Unknown" for null date', () => {
    expect(formatPredictedDate(null)).toBe('Unknown');
  });

  it('formats date in readable format', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const result = formatPredictedDate(date);
    // Format varies by locale, but should contain the core parts
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });
});

describe('formatDaysUntil', () => {
  it('returns empty string for null', () => {
    expect(formatDaysUntil(null)).toBe('');
  });

  it('returns "Any day now" for zero or negative days', () => {
    expect(formatDaysUntil(0)).toBe('Any day now');
    expect(formatDaysUntil(-1)).toBe('Any day now');
  });

  it('returns "Tomorrow" for 1 day', () => {
    expect(formatDaysUntil(1)).toBe('Tomorrow');
  });

  it('returns days for less than a week', () => {
    expect(formatDaysUntil(3)).toBe('3 days');
    expect(formatDaysUntil(6)).toBe('6 days');
  });

  it('returns weeks for less than a month', () => {
    expect(formatDaysUntil(7)).toBe('~1 weeks');
    expect(formatDaysUntil(14)).toBe('~2 weeks');
    expect(formatDaysUntil(21)).toBe('~3 weeks');
  });

  it('returns months for less than a year', () => {
    expect(formatDaysUntil(30)).toBe('~1 months');
    expect(formatDaysUntil(60)).toBe('~2 months');
    expect(formatDaysUntil(180)).toBe('~6 months');
  });

  it('returns years for 365+ days', () => {
    expect(formatDaysUntil(365)).toBe('~1.0 years');
    expect(formatDaysUntil(730)).toBe('~2.0 years');
  });
});

describe('getNextMilestones', () => {
  it('returns next milestones above current value', () => {
    const milestones = getNextMilestones(500, 'generic');
    expect(milestones.length).toBeLessThanOrEqual(3);
    expect(milestones[0]).toBeGreaterThan(500);
  });

  it('returns milestones for small values', () => {
    const milestones = getNextMilestones(500, 'stars');
    expect(milestones).toContain(1000);
  });

  it('returns milestones for medium values', () => {
    const milestones = getNextMilestones(15000, 'users');
    expect(milestones[0]).toBe(20000);
  });

  it('returns milestones for large values', () => {
    const milestones = getNextMilestones(166000, 'stars');
    expect(milestones[0]).toBe(175000);
    expect(milestones[1]).toBe(200000);
  });

  it('returns at most 3 milestones', () => {
    const milestones = getNextMilestones(100, 'generic');
    expect(milestones.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array if past all milestones', () => {
    const milestones = getNextMilestones(2000000, 'stars');
    expect(milestones.length).toBe(0);
  });
});
