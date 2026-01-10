/**
 * URL State Management for Playground
 *
 * Encodes/decodes playground state to/from URL parameters for shareable links.
 */

export interface PlaygroundState {
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

const DEFAULT_STATE: PlaygroundState = {
  metrics: [],
  range: '1y',
  chartType: 'line',
  dataMode: 'cumulative',
};

/**
 * Parse URL parameters into playground state
 */
export function parseUrlState(): PlaygroundState {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  const params = new URLSearchParams(window.location.search);

  const metricsParam = params.get('m');
  const metrics = metricsParam ? metricsParam.split(',').filter(Boolean) : [];

  const range = params.get('r') as PlaygroundState['range'] || DEFAULT_STATE.range;
  const chartType = params.get('t') as PlaygroundState['chartType'] || DEFAULT_STATE.chartType;
  const dataMode = params.get('d') as PlaygroundState['dataMode'] || DEFAULT_STATE.dataMode;

  return {
    metrics: metrics.slice(0, 4), // Max 4 metrics
    range: ['1m', '3m', '6m', '1y', '2y', 'all'].includes(range) ? range : DEFAULT_STATE.range,
    chartType: ['line', 'area'].includes(chartType) ? chartType : DEFAULT_STATE.chartType,
    dataMode: ['cumulative', 'change'].includes(dataMode) ? dataMode : DEFAULT_STATE.dataMode,
  };
}

/**
 * Encode playground state into URL parameters
 */
export function encodeUrlState(state: PlaygroundState): string {
  const params = new URLSearchParams();

  if (state.metrics.length > 0) {
    params.set('m', state.metrics.join(','));
  }
  if (state.range !== DEFAULT_STATE.range) {
    params.set('r', state.range);
  }
  if (state.chartType !== DEFAULT_STATE.chartType) {
    params.set('t', state.chartType);
  }
  if (state.dataMode !== DEFAULT_STATE.dataMode) {
    params.set('d', state.dataMode);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
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
export function getDateRangeFilter(range: PlaygroundState['range']): { start: string; end: string } | null {
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
