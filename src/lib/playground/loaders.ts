/**
 * Data Loaders for Playground
 *
 * Fetches and transforms time-series and categorical data from various sources.
 */

import {
  DATA_SOURCES,
  getMetricById,
  getCategoricalSourceById,
  type DataSource,
  type MetricDefinition,
  type CategoricalSource,
} from './registry';

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
 * Exported for use by playground and other consumers
 */
export function extractTimeSeries(
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

  // Support custom date key (e.g., 'weekStart' instead of 'date')
  const dateKey = metric.dateKey || 'date';

  return granularityData.map((item: any) => ({
    date: item[dateKey],
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

// ============================================================================
// Phase 2: Categorical Data Loaders
// ============================================================================

export interface DistributionData {
  sourceId: string;
  fieldId: string;
  label: string;
  lastUpdated: string | null;
  bins: { label: string; value: number; count: number }[];
  stats: {
    average: number;
    median: number;
    max: number;
    total: number;
  };
}

export interface RankingItem {
  label: string;
  values: Record<string, number>;
  group?: string;
  metadata?: Record<string, any>;
}

export interface RankingData {
  sourceId: string;
  label: string;
  lastUpdated: string | null;
  items: RankingItem[];
  fields: { id: string; label: string; type: 'number' | 'percentage' }[];
  groups: string[];
}

export interface CorrelationPoint {
  x: number;
  y: number;
  label: string;
  group?: string;
}

export interface CorrelationData {
  sourceId: string;
  label: string;
  lastUpdated: string | null;
  xField: { id: string; label: string };
  yField: { id: string; label: string };
  points: CorrelationPoint[];
  groups: string[];
}

/**
 * Navigate a nested path in an object (e.g., 'complexity.distribution')
 */
function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    current = current?.[part];
  }
  return current;
}

/**
 * Load distribution data for histogram charts
 */
export async function loadDistributionData(
  sourceId: string,
  fieldId: string
): Promise<DistributionData | null> {
  const source = getCategoricalSourceById(sourceId);
  if (!source || source.dataType !== 'distribution' || !source.distributionFields) {
    console.error(`Invalid distribution source: ${sourceId}`);
    return null;
  }

  const field = source.distributionFields.find(f => f.id === fieldId);
  if (!field) {
    console.error(`Unknown field: ${fieldId} in source ${sourceId}`);
    return null;
  }

  try {
    const rawData = await fetchDataFile(source.file);
    const lastUpdated = source.lastUpdatedPath
      ? getNestedValue(rawData, source.lastUpdatedPath)
      : null;

    const dataArray = getNestedValue(rawData, field.dataPath);
    if (!Array.isArray(dataArray)) {
      console.error(`Data at path ${field.dataPath} is not an array`);
      return null;
    }

    // If data is pre-binned (has countKey), use it directly
    if (field.countKey) {
      const bins = dataArray.map(item => ({
        label: String(item[field.labelKey || field.valueKey]),
        value: Number(item[field.valueKey]),
        count: Number(item[field.countKey!]),
      }));

      // Calculate stats from pre-binned data
      let total = 0;
      let sum = 0;
      let max = 0;
      const values: number[] = [];

      for (const bin of bins) {
        total += bin.count;
        sum += bin.value * bin.count;
        max = Math.max(max, bin.value);
        // Expand for median calculation
        for (let i = 0; i < bin.count; i++) {
          values.push(bin.value);
        }
      }

      values.sort((a, b) => a - b);
      const median = values.length > 0
        ? values[Math.floor(values.length / 2)]
        : 0;

      return {
        sourceId,
        fieldId,
        label: field.label,
        lastUpdated,
        bins,
        stats: {
          average: total > 0 ? Math.round(sum / total) : 0,
          median,
          max,
          total,
        },
      };
    }

    // Otherwise, bin the raw values
    const values = dataArray.map(item => Number(item[field.valueKey])).filter(v => !isNaN(v));
    if (values.length === 0) {
      console.error('No valid values found for binning');
      return null;
    }

    // Create histogram bins using Sturges' rule
    const numBins = Math.min(Math.ceil(Math.log2(values.length) + 1), 20);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = Math.ceil((max - min) / numBins) || 1;

    // Initialize bins
    const binCounts = new Map<number, number>();
    for (let i = 0; i < numBins; i++) {
      binCounts.set(i, 0);
    }

    // Count values in each bin
    for (const value of values) {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1);
      binCounts.set(binIndex, (binCounts.get(binIndex) || 0) + 1);
    }

    // Build bins array
    const bins = Array.from(binCounts.entries()).map(([index, count]) => {
      const binMin = min + index * binWidth;
      const binMax = binMin + binWidth;
      return {
        label: binMin === binMax ? String(binMin) : `${binMin}-${binMax - 1}`,
        value: binMin,
        count,
      };
    });

    // Calculate stats
    const total = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(total / 2)];

    return {
      sourceId,
      fieldId,
      label: field.label,
      lastUpdated,
      bins,
      stats: {
        average: Math.round(sum / total),
        median,
        max,
        total,
      },
    };
  } catch (error) {
    console.error(`Failed to load distribution ${sourceId}/${fieldId}:`, error);
    return null;
  }
}

/**
 * Load ranking data for bar charts and tables
 */
export async function loadRankingData(
  sourceId: string
): Promise<RankingData | null> {
  const source = getCategoricalSourceById(sourceId);
  if (!source || source.dataType !== 'ranking' || !source.rankingFields) {
    console.error(`Invalid ranking source: ${sourceId}`);
    return null;
  }

  try {
    const rawData = await fetchDataFile(source.file);
    const lastUpdated = source.lastUpdatedPath
      ? getNestedValue(rawData, source.lastUpdatedPath)
      : null;

    let items: RankingItem[] = [];
    const groups = new Set<string>();

    // Handle special case: byCategory structure (object with category keys)
    if (source.dataPath === 'nodes.byCategory') {
      const byCategory = getNestedValue(rawData, source.dataPath);
      if (byCategory && typeof byCategory === 'object') {
        for (const [categoryName, nodes] of Object.entries(byCategory)) {
          if (Array.isArray(nodes)) {
            // Calculate category-level stats
            const nodeCount = nodes.length;
            const totalUsage = nodes.reduce((sum, n: any) => sum + (n.count || 0), 0);

            items.push({
              label: categoryName,
              values: { nodeCount, totalUsage },
              group: undefined,
            });
            groups.add(categoryName);
          }
        }
      }
    } else {
      // Standard array data
      const dataArray = source.dataPath
        ? getNestedValue(rawData, source.dataPath)
        : rawData;

      if (!Array.isArray(dataArray)) {
        console.error(`Data is not an array for source ${sourceId}`);
        return null;
      }

      items = dataArray.map(item => {
        const label = item[source.labelField || 'name'] || 'Unknown';
        const group = source.groupByField ? item[source.groupByField] : undefined;

        if (group !== undefined) {
          groups.add(String(group));
        }

        const values: Record<string, number> = {};
        for (const field of source.rankingFields!) {
          values[field.id] = Number(item[field.id]) || 0;
        }

        return {
          label,
          values,
          group: group !== undefined ? String(group) : undefined,
          metadata: {
            username: item.username,
            avatar: item.avatar,
            verified: item.verified,
            bio: item.bio,
            category: item.category,
            type: item.type,
          },
        };
      });
    }

    return {
      sourceId,
      label: source.label,
      lastUpdated,
      items,
      fields: source.rankingFields,
      groups: Array.from(groups).sort(),
    };
  } catch (error) {
    console.error(`Failed to load ranking ${sourceId}:`, error);
    return null;
  }
}

/**
 * Load correlation data for scatter plots
 */
export async function loadCorrelationData(
  sourceId: string,
  xFieldId: string,
  yFieldId: string
): Promise<CorrelationData | null> {
  const source = getCategoricalSourceById(sourceId);
  if (!source || source.dataType !== 'correlation' || !source.correlationFields) {
    console.error(`Invalid correlation source: ${sourceId}`);
    return null;
  }

  const xField = source.correlationFields.find(f => f.id === xFieldId);
  const yField = source.correlationFields.find(f => f.id === yFieldId);

  if (!xField || !yField) {
    console.error(`Unknown fields: ${xFieldId}, ${yFieldId}`);
    return null;
  }

  try {
    const rawData = await fetchDataFile(source.file);
    const lastUpdated = source.lastUpdatedPath
      ? getNestedValue(rawData, source.lastUpdatedPath)
      : null;

    const dataArray = source.dataPath
      ? getNestedValue(rawData, source.dataPath)
      : rawData;

    if (!Array.isArray(dataArray)) {
      console.error(`Data is not an array for source ${sourceId}`);
      return null;
    }

    const groups = new Set<string>();
    const points: CorrelationPoint[] = [];

    for (const item of dataArray) {
      const x = Number(getNestedValue(item, xField.path));
      const y = Number(getNestedValue(item, yField.path));
      const label = item[source.labelField || 'name'] || 'Unknown';
      const group = source.groupByField ? String(item[source.groupByField]) : undefined;

      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y, label, group });
        if (group) groups.add(group);
      }
    }

    return {
      sourceId,
      label: source.label,
      lastUpdated,
      xField: { id: xField.id, label: xField.label },
      yField: { id: yField.id, label: yField.label },
      points,
      groups: Array.from(groups).sort(),
    };
  } catch (error) {
    console.error(`Failed to load correlation ${sourceId}:`, error);
    return null;
  }
}

/**
 * Check if a source is safe to eager load (small file size)
 */
export function shouldEagerLoad(sourceId: string): boolean {
  const source = getCategoricalSourceById(sourceId);
  return source?.sizeHint === 'small';
}
