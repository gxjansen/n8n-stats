/**
 * Prediction utilities for milestone forecasting
 *
 * Uses linear regression on recent data to predict when milestones will be reached.
 */

interface DataPoint {
  date: string;
  value: number;
}

interface MilestonePrediction {
  milestone: number;
  predictedDate: Date | null;
  daysUntil: number | null;
  confidence: 'high' | 'medium' | 'low';
  growthPerDay: number;
  currentValue: number;
}

/**
 * Parse date string to timestamp
 * Supports: YYYY-MM-DD, YYYY-MM, YYYY-Www formats
 */
function parseDate(dateStr: string): number {
  // Weekly format: 2024-W03
  if (dateStr.includes('-W')) {
    const [year, week] = dateStr.split('-W').map(Number);
    const jan1 = new Date(year, 0, 1);
    const days = (week - 1) * 7;
    return new Date(jan1.getTime() + days * 24 * 60 * 60 * 1000).getTime();
  }
  // Monthly format: 2024-01
  if (dateStr.match(/^\d{4}-\d{2}$/)) {
    return new Date(dateStr + '-15').getTime(); // Mid-month
  }
  // Daily format: 2024-01-15
  return new Date(dateStr).getTime();
}

/**
 * Linear regression to find slope and intercept
 * Returns: { slope, intercept, r2 }
 */
function linearRegression(points: Array<{ x: number; y: number }>): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumYY = points.reduce((sum, p) => sum + p.y * p.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R² (coefficient of determination)
  const meanY = sumY / n;
  const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = points.reduce((sum, p) => {
    const predicted = slope * p.x + intercept;
    return sum + Math.pow(p.y - predicted, 2);
  }, 0);
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, r2 };
}

/**
 * Predict when a milestone will be reached
 *
 * @param data - Array of historical data points
 * @param milestone - Target value to predict
 * @param options - Configuration options
 */
export function predictMilestone(
  data: DataPoint[],
  milestone: number,
  options: {
    lookbackMonths?: number;
    minDataPoints?: number;
  } = {}
): MilestonePrediction {
  const { lookbackMonths = 6, minDataPoints = 4 } = options;

  // Sort by date
  const sorted = [...data]
    .filter(d => d.value > 0)
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));

  if (sorted.length < minDataPoints) {
    return {
      milestone,
      predictedDate: null,
      daysUntil: null,
      confidence: 'low',
      growthPerDay: 0,
      currentValue: sorted[sorted.length - 1]?.value || 0,
    };
  }

  // Filter to recent data (lookback period)
  const now = Date.now();
  const lookbackMs = lookbackMonths * 30 * 24 * 60 * 60 * 1000;
  const recentData = sorted.filter(d => now - parseDate(d.date) <= lookbackMs);

  // Use at least minDataPoints even if outside lookback
  const dataToUse = recentData.length >= minDataPoints
    ? recentData
    : sorted.slice(-minDataPoints);

  // Convert to x (days from first point), y (value)
  const firstTimestamp = parseDate(dataToUse[0].date);
  const msPerDay = 24 * 60 * 60 * 1000;
  const points = dataToUse.map(d => ({
    x: (parseDate(d.date) - firstTimestamp) / msPerDay,
    y: d.value,
  }));

  // Perform linear regression
  const { slope, intercept, r2 } = linearRegression(points);

  // Current value (most recent)
  const currentValue = sorted[sorted.length - 1].value;
  const currentDays = (now - firstTimestamp) / msPerDay;

  // Growth per day
  const growthPerDay = slope;

  // If milestone already reached
  if (currentValue >= milestone) {
    return {
      milestone,
      predictedDate: null,
      daysUntil: null,
      confidence: 'high',
      growthPerDay,
      currentValue,
    };
  }

  // If no growth or negative growth
  if (growthPerDay <= 0) {
    return {
      milestone,
      predictedDate: null,
      daysUntil: null,
      confidence: 'low',
      growthPerDay,
      currentValue,
    };
  }

  // Calculate days until milestone
  // milestone = slope * daysFromFirst + intercept
  // daysFromFirst = (milestone - intercept) / slope
  const daysFromFirstToMilestone = (milestone - intercept) / slope;
  const daysUntil = Math.ceil(daysFromFirstToMilestone - currentDays);

  // Predicted date
  const predictedDate = new Date(now + daysUntil * msPerDay);

  // Determine confidence based on R² and data quality
  let confidence: 'high' | 'medium' | 'low';
  if (r2 >= 0.9 && dataToUse.length >= 8) {
    confidence = 'high';
  } else if (r2 >= 0.7 && dataToUse.length >= 5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Cap predictions at 2 years out (beyond that, too uncertain)
  if (daysUntil > 730) {
    return {
      milestone,
      predictedDate: null,
      daysUntil: null,
      confidence: 'low',
      growthPerDay,
      currentValue,
    };
  }

  return {
    milestone,
    predictedDate,
    daysUntil: daysUntil > 0 ? daysUntil : null,
    confidence,
    growthPerDay,
    currentValue,
  };
}

/**
 * Format a predicted date for display
 */
export function formatPredictedDate(date: Date | null): string {
  if (!date) return 'Unknown';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format days until milestone
 */
export function formatDaysUntil(days: number | null): string {
  if (days === null) return '';
  if (days <= 0) return 'Any day now';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `${days} days`;
  if (days < 30) return `~${Math.round(days / 7)} weeks`;
  if (days < 365) return `~${Math.round(days / 30)} months`;
  return `~${(days / 365).toFixed(1)} years`;
}

/**
 * Get appropriate milestones for a given current value
 * Returns the next 2-3 meaningful milestones
 */
export function getNextMilestones(currentValue: number, type: 'stars' | 'users' | 'creators' | 'generic'): number[] {
  // Define milestone increments based on magnitude
  const milestoneMarkers = [
    1000, 2000, 2500, 5000,
    10000, 15000, 20000, 25000, 50000, 75000,
    100000, 125000, 150000, 175000, 200000, 250000,
    500000, 750000, 1000000
  ];

  // Find milestones that are ahead of current value
  const upcoming = milestoneMarkers.filter(m => m > currentValue);

  // Return next 2-3 milestones
  return upcoming.slice(0, 3);
}
