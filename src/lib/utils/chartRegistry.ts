/**
 * Chart.js Registry
 *
 * Centralized Chart.js configuration with manual tree-shaking.
 * Only imports the components actually used across the site.
 *
 * MAINTENANCE GUIDE:
 * -----------------
 * When adding new chart features, add the required imports here:
 *
 * New chart type?
 *   - Add controller: LineController, BarController, ScatterController, etc.
 *   - Add element: LineElement, BarElement, PointElement, ArcElement, etc.
 *
 * New scale type?
 *   - CategoryScale: text labels on axis
 *   - LinearScale: numeric axis
 *   - TimeScale: date/time axis (requires chartjs-adapter-date-fns)
 *   - LogarithmicScale: log scale
 *
 * New feature?
 *   - fill: true → needs Filler plugin
 *   - tooltips → needs Tooltip plugin
 *   - legend → needs Legend plugin
 *
 * Chart.js docs: https://www.chartjs.org/docs/latest/getting-started/integration.html
 */

import {
  Chart,
  // Controllers (chart types)
  LineController,
  BarController,
  ScatterController,
  DoughnutController,
  // Elements (visual components)
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  // Scales
  CategoryScale,
  LinearScale,
  TimeScale,
  // Plugins
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Import custom plugins
import { watermarkPlugin, defaultWatermarkOptions } from './chartPlugins';

// Register all components used across the site
Chart.register(
  // Controllers
  LineController,
  BarController,
  ScatterController,
  DoughnutController,
  // Elements
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  // Scales
  CategoryScale,
  LinearScale,
  TimeScale,
  // Plugins
  Tooltip,
  Legend,
  Filler,
  // Custom plugins
  watermarkPlugin
);

// Set default watermark options for all charts
Chart.defaults.plugins.watermark = defaultWatermarkOptions;

// Re-export Chart for use in components
export { Chart };

// Also export the type for TypeScript
export type { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
