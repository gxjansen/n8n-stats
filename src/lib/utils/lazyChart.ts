/**
 * Lazy Chart Initialization Utility
 *
 * Defers chart initialization until the chart container is visible in viewport.
 * Uses Intersection Observer API for efficient visibility detection.
 */

interface LazyChartOptions {
  /** Distance from viewport to trigger initialization (default: '100px') */
  rootMargin?: string;
  /** Visibility threshold to trigger (default: 0) */
  threshold?: number;
}

/**
 * Initializes a chart when its container becomes visible in the viewport.
 *
 * @param elementId - The ID of the chart container element
 * @param initFn - The function that initializes the chart
 * @param options - Optional configuration for the Intersection Observer
 *
 * @example
 * ```typescript
 * initChartWhenVisible('my-chart-container', initMyChart);
 * ```
 */
export function initChartWhenVisible(
  elementId: string,
  initFn: () => void,
  options?: LazyChartOptions
): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Fallback for browsers without Intersection Observer support
  if (!('IntersectionObserver' in window)) {
    initFn();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          initFn();
        }
      });
    },
    {
      rootMargin: options?.rootMargin ?? '100px',
      threshold: options?.threshold ?? 0,
    }
  );

  observer.observe(element);
}
