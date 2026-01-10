/**
 * Data Loaders for Playground
 *
 * Fetches and transforms time-series data from various sources.
 */

import { DATA_SOURCES, getMetricById, type DataSource, type MetricDefinition } from './registry';

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface LoadedMetricData {
  metricId: string;
  label: string;
  color: string;
  data: TimeSeriesPoint[];
}

// Cache for loaded data files
const dataCache: Map<string, any> = new Map();

/**
 * Fetch and cache a data file
 */
async function fetchDataFile(filePath: string): Promise<any> {
  if (dataCache.has(filePath)) {
    return dataCache.get(filePath);
  }

  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${response.status}`);
  }

  const data = await response.json();
  dataCache.set(filePath, data);
  return data;
}

/**
 * Extract time-series data from a loaded file based on metric definition
 */
function extractTimeSeries(
  data: any,
  metric: MetricDefinition,
  granularity: 'daily' | 'weekly' | 'monthly'
): TimeSeriesPoint[] {
  // Handle nested path like 'timeline.monthly'
  if (metric.path.includes('.')) {
    const parts = metric.path.split('.');
    let current = data;
    for (const part of parts) {
      current = current?.[part];
    }

    if (Array.isArray(current)) {
      return current.map(item => ({
        date: item[metric.dateKey || 'date'],
        value: item[metric.valueKey || 'value'],
      }));
    }
    return [];
  }

  // Standard structure: data has daily/weekly/monthly arrays
  const granularityData = data[granularity];
  if (!Array.isArray(granularityData)) {
    return [];
  }

  return granularityData.map((item: any) => ({
    date: item.date,
    value: item[metric.path],
  }));
}

/**
 * Load data for a specific metric
 */
export async function loadMetricData(
  metricId: string,
  granularity?: 'daily' | 'weekly' | 'monthly'
): Promise<LoadedMetricData | null> {
  const metricInfo = getMetricById(metricId);
  if (!metricInfo) {
    console.error(`Unknown metric: ${metricId}`);
    return null;
  }

  const { source, ...metric } = metricInfo;
  const effectiveGranularity = granularity || source.defaultGranularity;

  // Check if requested granularity is available
  if (!source.granularities.includes(effectiveGranularity)) {
    console.warn(`Granularity ${effectiveGranularity} not available for ${source.id}, using ${source.defaultGranularity}`);
  }

  try {
    const rawData = await fetchDataFile(source.file);
    const timeSeries = extractTimeSeries(rawData, metric, effectiveGranularity);

    return {
      metricId: metric.id,
      label: metric.label,
      color: metric.color,
      data: timeSeries.filter(p => p.value !== undefined && p.value !== null),
    };
  } catch (error) {
    console.error(`Failed to load metric ${metricId}:`, error);
    return null;
  }
}

/**
 * Load multiple metrics in parallel
 */
export async function loadMultipleMetrics(
  metricIds: string[],
  granularity?: 'daily' | 'weekly' | 'monthly'
): Promise<LoadedMetricData[]> {
  const results = await Promise.all(
    metricIds.map(id => loadMetricData(id, granularity))
  );
  return results.filter((r): r is LoadedMetricData => r !== null);
}

/**
 * Normalize date formats to YYYY-MM for consistent comparison
 */
export function normalizeDateFormat(date: string): string {
  // Handle YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(date)) {
    return date;
  }
  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date.substring(0, 7);
  }
  // Handle YYYY-Www format (weekly)
  if (/^\d{4}-W\d{2}$/.test(date)) {
    // Convert week to approximate month
    const year = parseInt(date.substring(0, 4));
    const week = parseInt(date.substring(6));
    const month = Math.min(12, Math.ceil(week / 4.33));
    return `${year}-${month.toString().padStart(2, '0')}`;
  }
  return date;
}

/**
 * Find the overlapping date range across multiple datasets
 */
export function findOverlappingRange(datasets: LoadedMetricData[]): { start: string; end: string } | null {
  if (datasets.length === 0) return null;

  const ranges = datasets.map(d => ({
    start: d.data[0]?.date,
    end: d.data[d.data.length - 1]?.date,
  }));

  const validRanges = ranges.filter(r => r.start && r.end);
  if (validRanges.length === 0) return null;

  // Find latest start and earliest end
  const start = validRanges.reduce((max, r) => r.start > max ? r.start : max, validRanges[0].start);
  const end = validRanges.reduce((min, r) => r.end < min ? r.end : min, validRanges[0].end);

  if (start > end) return null;
  return { start, end };
}

/**
 * Filter data to a specific date range
 */
export function filterByDateRange(
  data: TimeSeriesPoint[],
  start: string,
  end: string
): TimeSeriesPoint[] {
  return data.filter(p => p.date >= start && p.date <= end);
}

/**
 * Calculate percentage change from first value
 */
export function normalizeToPercentChange(data: TimeSeriesPoint[]): TimeSeriesPoint[] {
  if (data.length === 0) return [];
  const baseValue = data[0].value;
  if (baseValue === 0) return data;

  return data.map(p => ({
    date: p.date,
    value: ((p.value - baseValue) / baseValue) * 100,
  }));
}

/**
 * Convert cumulative data to period-over-period change
 */
export function toPeriodChange(data: TimeSeriesPoint[]): TimeSeriesPoint[] {
  if (data.length < 2) return data;

  return data.slice(1).map((point, index) => ({
    date: point.date,
    value: point.value - data[index].value,
  }));
}

/**
 * Check if two metrics have significantly different scales (>10x difference)
 */
export function needsDualAxis(datasets: LoadedMetricData[]): boolean {
  if (datasets.length < 2) return false;

  const maxValues = datasets.map(d =>
    Math.max(...d.data.map(p => p.value))
  );

  const minMax = Math.min(...maxValues);
  const maxMax = Math.max(...maxValues);

  return minMax > 0 && maxMax / minMax > 10;
}
