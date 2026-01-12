/**
 * Statistics utilities for playground charts
 *
 * Includes linear regression for trend lines and correlation calculations.
 */

export interface Point {
  x: number;
  y: number;
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  /** Generate y value for a given x */
  predict: (x: number) => number;
  /** Generate trend line points for chart overlay */
  trendLine: (minX: number, maxX: number) => Point[];
}

/**
 * Calculate linear regression (least squares) for a set of points
 */
export function linearRegression(points: Point[]): LinearRegressionResult | null {
  if (points.length < 2) return null;

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  let ssTotal = 0;
  let ssResidual = 0;

  for (const { x, y } of points) {
    const predicted = slope * x + intercept;
    ssTotal += (y - meanY) ** 2;
    ssResidual += (y - predicted) ** 2;
  }

  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  const predict = (x: number) => slope * x + intercept;
  const trendLine = (minX: number, maxX: number): Point[] => [
    { x: minX, y: predict(minX) },
    { x: maxX, y: predict(maxX) },
  ];

  return { slope, intercept, rSquared, predict, trendLine };
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumYY = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate basic statistics for a numeric array
 */
export function calculateStats(values: number[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  count: number;
} {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, count: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  // Median
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  // Standard deviation
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / count;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean, median, stdDev, count };
}

/**
 * Create histogram bins from data
 */
export function createHistogramBins(
  values: number[],
  binCount: number | 'auto' = 'auto'
): { label: string; min: number; max: number; count: number }[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  // Auto bin count using Sturges' rule
  const numBins = binCount === 'auto' ? Math.ceil(Math.log2(values.length) + 1) : binCount;

  const binWidth = (max - min) / numBins || 1;
  const bins: { label: string; min: number; max: number; count: number }[] = [];

  for (let i = 0; i < numBins; i++) {
    const binMin = min + i * binWidth;
    const binMax = min + (i + 1) * binWidth;
    bins.push({
      label: `${Math.round(binMin)}-${Math.round(binMax)}`,
      min: binMin,
      max: binMax,
      count: 0,
    });
  }

  // Count values in each bin
  for (const value of values) {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1);
    if (binIndex >= 0 && binIndex < bins.length) {
      bins[binIndex].count++;
    }
  }

  return bins;
}
