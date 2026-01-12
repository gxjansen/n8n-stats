/**
 * URL State Management for Playground
 *
 * Encodes/decodes playground state to/from URL parameters for shareable links.
 * Supports both time-series (Phase 1) and categorical (Phase 2) modes.
 */

export type PlaygroundMode = 'timeseries' | 'distribution' | 'ranking' | 'correlation';

// Time-series state (Phase 1)
export interface TimeSeriesState {
  /** Selected metric IDs */
  metrics: string[];
  /** Date range preset or 'custom' */
  range: '1m' | '3m' | '6m' | '1y' | '2y' | 'all';
  /** Custom date range (only used when range is 'custom') */
  customRange?: { start: string; end: string };
  /** Chart type */
  chartType: 'line' | 'area';
  /** Data mode: cumulative totals or period change */
  dataMode: 'cumulative' | 'change';
}

// Distribution state (Phase 2)
export interface DistributionState {
  /** Source ID */
  source: string;
  /** Field ID */
  field: string;
  /** Scale type */
  scale: 'linear' | 'log';
}

// Ranking state (Phase 2)
export interface RankingState {
  /** Source ID */
  source: string;
  /** Field to sort by */
  sortBy: string;
  /** Sort direction */
  sortDir: 'asc' | 'desc';
  /** Filter by group (optional) */
  filterGroup?: string;
  /** Number of items to show */
  limit: number;
}

// Correlation state (Phase 2)
export interface CorrelationState {
  /** Source ID */
  source: string;
  /** X-axis field */
  xField: string;
  /** Y-axis field */
  yField: string;
  /** Color by group */
  colorBy?: string;
  /** Show trend line */
  showTrend: boolean;
}

export interface PlaygroundState {
  mode: PlaygroundMode;
  timeseries: TimeSeriesState;
  distribution: DistributionState;
  ranking: RankingState;
  correlation: CorrelationState;
}

// Legacy type for backward compatibility
export type LegacyPlaygroundState = TimeSeriesState;

const DEFAULT_TIMESERIES_STATE: TimeSeriesState = {
  metrics: [],
  range: '1y',
  chartType: 'line',
  dataMode: 'cumulative',
};

const DEFAULT_DISTRIBUTION_STATE: DistributionState = {
  source: 'template-complexity',
  field: 'nodes-per-template',
  scale: 'linear',
};

const DEFAULT_RANKING_STATE: RankingState = {
  source: 'node-usage',
  sortBy: 'count',
  sortDir: 'desc',
  limit: 20,
};

const DEFAULT_CORRELATION_STATE: CorrelationState = {
  source: 'template-correlations',
  xField: 'templateCount',
  yField: 'totalViews',
  showTrend: true,
};

const DEFAULT_STATE: PlaygroundState = {
  mode: 'timeseries',
  timeseries: DEFAULT_TIMESERIES_STATE,
  distribution: DEFAULT_DISTRIBUTION_STATE,
  ranking: DEFAULT_RANKING_STATE,
  correlation: DEFAULT_CORRELATION_STATE,
};

/**
 * Parse URL parameters into playground state
 */
export function parseUrlState(): PlaygroundState {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  const params = new URLSearchParams(window.location.search);

  // Determine mode from URL
  const modeParam = params.get('mode') as PlaygroundMode | null;
  const mode: PlaygroundMode = modeParam && ['timeseries', 'distribution', 'ranking', 'correlation'].includes(modeParam)
    ? modeParam
    : 'timeseries';

  // Parse time-series state (also for backward compatibility with old URLs)
  const metricsParam = params.get('m');
  const metrics = metricsParam ? metricsParam.split(',').filter(Boolean) : [];
  const range = params.get('r') as TimeSeriesState['range'] || DEFAULT_TIMESERIES_STATE.range;
  const chartType = params.get('t') as TimeSeriesState['chartType'] || DEFAULT_TIMESERIES_STATE.chartType;
  const dataMode = params.get('d') as TimeSeriesState['dataMode'] || DEFAULT_TIMESERIES_STATE.dataMode;

  const timeseries: TimeSeriesState = {
    metrics: metrics.slice(0, 4),
    range: ['1m', '3m', '6m', '1y', '2y', 'all'].includes(range) ? range : DEFAULT_TIMESERIES_STATE.range,
    chartType: ['line', 'area'].includes(chartType) ? chartType : DEFAULT_TIMESERIES_STATE.chartType,
    dataMode: ['cumulative', 'change'].includes(dataMode) ? dataMode : DEFAULT_TIMESERIES_STATE.dataMode,
  };

  // Parse distribution state
  const distribution: DistributionState = {
    source: params.get('ds') || DEFAULT_DISTRIBUTION_STATE.source,
    field: params.get('df') || DEFAULT_DISTRIBUTION_STATE.field,
    scale: (params.get('dscale') as 'linear' | 'log') || DEFAULT_DISTRIBUTION_STATE.scale,
  };

  // Parse ranking state
  const ranking: RankingState = {
    source: params.get('rs') || DEFAULT_RANKING_STATE.source,
    sortBy: params.get('rsort') || DEFAULT_RANKING_STATE.sortBy,
    sortDir: (params.get('rdir') as 'asc' | 'desc') || DEFAULT_RANKING_STATE.sortDir,
    filterGroup: params.get('rfilter') || undefined,
    limit: parseInt(params.get('rlimit') || String(DEFAULT_RANKING_STATE.limit), 10),
  };

  // Parse correlation state
  const correlation: CorrelationState = {
    source: params.get('cs') || DEFAULT_CORRELATION_STATE.source,
    xField: params.get('cx') || DEFAULT_CORRELATION_STATE.xField,
    yField: params.get('cy') || DEFAULT_CORRELATION_STATE.yField,
    colorBy: params.get('ccolor') || undefined,
    showTrend: params.get('ctrend') !== 'false',
  };

  return { mode, timeseries, distribution, ranking, correlation };
}

/**
 * Parse URL for legacy time-series only state (backward compatibility)
 */
export function parseTimeSeriesState(): TimeSeriesState {
  const state = parseUrlState();
  return state.timeseries;
}

/**
 * Encode playground state into URL parameters
 */
export function encodeUrlState(state: PlaygroundState): string {
  const params = new URLSearchParams();

  // Always include mode if not timeseries (for cleaner URLs)
  if (state.mode !== 'timeseries') {
    params.set('mode', state.mode);
  }

  // Encode based on current mode
  switch (state.mode) {
    case 'timeseries':
      if (state.timeseries.metrics.length > 0) {
        params.set('m', state.timeseries.metrics.join(','));
      }
      if (state.timeseries.range !== DEFAULT_TIMESERIES_STATE.range) {
        params.set('r', state.timeseries.range);
      }
      if (state.timeseries.chartType !== DEFAULT_TIMESERIES_STATE.chartType) {
        params.set('t', state.timeseries.chartType);
      }
      if (state.timeseries.dataMode !== DEFAULT_TIMESERIES_STATE.dataMode) {
        params.set('d', state.timeseries.dataMode);
      }
      break;

    case 'distribution':
      if (state.distribution.source !== DEFAULT_DISTRIBUTION_STATE.source) {
        params.set('ds', state.distribution.source);
      }
      if (state.distribution.field !== DEFAULT_DISTRIBUTION_STATE.field) {
        params.set('df', state.distribution.field);
      }
      if (state.distribution.scale !== DEFAULT_DISTRIBUTION_STATE.scale) {
        params.set('dscale', state.distribution.scale);
      }
      break;

    case 'ranking':
      if (state.ranking.source !== DEFAULT_RANKING_STATE.source) {
        params.set('rs', state.ranking.source);
      }
      if (state.ranking.sortBy !== DEFAULT_RANKING_STATE.sortBy) {
        params.set('rsort', state.ranking.sortBy);
      }
      if (state.ranking.sortDir !== DEFAULT_RANKING_STATE.sortDir) {
        params.set('rdir', state.ranking.sortDir);
      }
      if (state.ranking.filterGroup) {
        params.set('rfilter', state.ranking.filterGroup);
      }
      if (state.ranking.limit !== DEFAULT_RANKING_STATE.limit) {
        params.set('rlimit', String(state.ranking.limit));
      }
      break;

    case 'correlation':
      if (state.correlation.source !== DEFAULT_CORRELATION_STATE.source) {
        params.set('cs', state.correlation.source);
      }
      if (state.correlation.xField !== DEFAULT_CORRELATION_STATE.xField) {
        params.set('cx', state.correlation.xField);
      }
      if (state.correlation.yField !== DEFAULT_CORRELATION_STATE.yField) {
        params.set('cy', state.correlation.yField);
      }
      if (state.correlation.colorBy) {
        params.set('ccolor', state.correlation.colorBy);
      }
      if (!state.correlation.showTrend) {
        params.set('ctrend', 'false');
      }
      break;
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Encode time-series state only (for backward compatibility)
 */
export function encodeTimeSeriesState(state: TimeSeriesState): string {
  return encodeUrlState({
    mode: 'timeseries',
    timeseries: state,
    distribution: DEFAULT_DISTRIBUTION_STATE,
    ranking: DEFAULT_RANKING_STATE,
    correlation: DEFAULT_CORRELATION_STATE,
  });
}

/**
 * Update URL without page reload
 */
export function updateUrl(state: PlaygroundState): void {
  if (typeof window === 'undefined') return;

  const url = `${window.location.pathname}${encodeUrlState(state)}`;
  window.history.replaceState({}, '', url);
}

/**
 * Get shareable URL for current state
 */
export function getShareableUrl(state: PlaygroundState): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}${encodeUrlState(state)}`;
}

/**
 * Copy URL to clipboard
 */
export async function copyShareableUrl(state: PlaygroundState): Promise<boolean> {
  try {
    const url = getShareableUrl(state);
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate date filter based on range preset
 */
export function getDateRangeFilter(range: TimeSeriesState['range']): { start: string; end: string } | null {
  if (range === 'all') return null;

  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let monthsBack: number;
  switch (range) {
    case '1m': monthsBack = 1; break;
    case '3m': monthsBack = 3; break;
    case '6m': monthsBack = 6; break;
    case '1y': monthsBack = 12; break;
    case '2y': monthsBack = 24; break;
    default: return null;
  }

  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - monthsBack);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

  return { start, end };
}

/**
 * Get default state for a specific mode
 */
export function getDefaultStateForMode(mode: PlaygroundMode): PlaygroundState {
  return {
    ...DEFAULT_STATE,
    mode,
  };
}

/**
 * Mode display labels
 */
export const MODE_LABELS: Record<PlaygroundMode, { label: string; description: string }> = {
  timeseries: {
    label: 'Time Series',
    description: 'Track metrics over time',
  },
  distribution: {
    label: 'Distributions',
    description: 'Explore data distributions',
  },
  ranking: {
    label: 'Rankings',
    description: 'Compare and rank items',
  },
  correlation: {
    label: 'Correlations',
    description: 'Find relationships',
  },
};
