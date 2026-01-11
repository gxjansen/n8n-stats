/**
 * Chart.js Plugins for Data Visualization Integrity
 *
 * These plugins help ensure charts accurately represent data without
 * visually misleading viewers.
 */

import type { Chart, Plugin } from 'chart.js';

/**
 * Axis Break Plugin
 *
 * Draws a zigzag/break indicator when a y-axis doesn't start at zero.
 * This is a standard data visualization practice to clearly indicate
 * that the scale has been truncated, preventing viewers from being
 * misled by exaggerated trends.
 *
 * The plugin automatically detects when:
 * - The y-axis minimum is greater than zero
 * - The gap from zero is significant (>10% of the range)
 *
 * Usage: Register globally or add to chart plugins array
 */
export const axisBreakPlugin: Plugin = {
  id: 'axisBreak',
  afterDraw(chart: Chart) {
    const { ctx, chartArea, scales } = chart;

    if (!chartArea) return;

    // Check each y-axis scale
    const yScales = ['y', 'y1'] as const;

    for (const scaleId of yScales) {
      const scale = scales[scaleId];
      if (!scale) continue;

      // Get the actual data minimum and the scale minimum
      const scaleMin = scale.min;
      const scaleMax = scale.max;
      const range = scaleMax - scaleMin;

      // Only show break indicator if:
      // 1. Scale doesn't start at zero
      // 2. Zero is significantly below the scale min (gap > 10% of range)
      // 3. The values are positive (negative values naturally don't start at 0)
      if (scaleMin <= 0 || scaleMin < range * 0.1) continue;

      // Calculate position for the break indicator
      const isLeftAxis = scale.position === 'left';
      const x = isLeftAxis ? chartArea.left : chartArea.right;
      const bottom = chartArea.bottom;

      // Draw the zigzag break indicator
      drawAxisBreak(ctx, x, bottom, isLeftAxis);
    }
  },
};

/**
 * Draw a zigzag break indicator at the bottom of an axis
 */
function drawAxisBreak(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottom: number,
  isLeftAxis: boolean
): void {
  const zigzagHeight = 12;
  const zigzagWidth = 8;
  const zigzagCount = 2;

  ctx.save();

  // Semi-transparent background to cover the axis line
  ctx.fillStyle = 'rgba(17, 24, 39, 0.95)'; // Match dark theme bg
  ctx.fillRect(
    isLeftAxis ? x - 3 : x - zigzagWidth - 3,
    bottom - zigzagHeight - 2,
    zigzagWidth + 6,
    zigzagHeight + 6
  );

  // Draw zigzag pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  const startX = isLeftAxis ? x - zigzagWidth / 2 : x + zigzagWidth / 2;
  const direction = isLeftAxis ? 1 : -1;

  ctx.moveTo(startX, bottom);

  for (let i = 0; i < zigzagCount * 2; i++) {
    const yPos = bottom - ((i + 1) * zigzagHeight) / (zigzagCount * 2);
    const xOffset = i % 2 === 0 ? zigzagWidth / 2 * direction : -zigzagWidth / 2 * direction;
    ctx.lineTo(startX + xOffset, yPos);
  }

  ctx.stroke();

  // Draw small "break" lines (parallel lines indicating break)
  const breakY = bottom - zigzagHeight - 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;

  // First break line
  ctx.beginPath();
  ctx.moveTo(isLeftAxis ? x - zigzagWidth : x + zigzagWidth, breakY);
  ctx.lineTo(isLeftAxis ? x + 2 : x - 2, breakY - 3);
  ctx.stroke();

  // Second break line
  ctx.beginPath();
  ctx.moveTo(isLeftAxis ? x - zigzagWidth : x + zigzagWidth, breakY + 3);
  ctx.lineTo(isLeftAxis ? x + 2 : x - 2, breakY);
  ctx.stroke();

  ctx.restore();
}

/**
 * Alternative: Text indicator for truncated axis
 *
 * Shows a small "≠0" indicator when axis doesn't start at zero.
 * Less intrusive than zigzag but still clearly indicates truncation.
 */
export const axisNotZeroPlugin: Plugin = {
  id: 'axisNotZero',
  afterDraw(chart: Chart) {
    const { ctx, chartArea, scales } = chart;

    if (!chartArea) return;

    const yScales = ['y', 'y1'] as const;

    for (const scaleId of yScales) {
      const scale = scales[scaleId];
      if (!scale) continue;

      const scaleMin = scale.min;
      const scaleMax = scale.max;
      const range = scaleMax - scaleMin;

      // Only show if axis doesn't start at zero and gap is significant
      if (scaleMin <= 0 || scaleMin < range * 0.1) continue;

      const isLeftAxis = scale.position === 'left';
      const x = isLeftAxis ? chartArea.left - 4 : chartArea.right + 4;
      const y = chartArea.bottom + 16;

      ctx.save();
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = isLeftAxis ? 'right' : 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('≠0', x, y);
      ctx.restore();
    }
  },
};

/**
 * Combined plugin that shows both zigzag AND label
 * This is the recommended plugin for maximum clarity
 */
export const axisTruncationPlugin: Plugin = {
  id: 'axisTruncation',
  afterDraw(chart: Chart) {
    const { ctx, chartArea, scales } = chart;

    if (!chartArea) return;

    const yScales = ['y', 'y1'] as const;

    for (const scaleId of yScales) {
      const scale = scales[scaleId];
      if (!scale) continue;

      const scaleMin = scale.min;
      const scaleMax = scale.max;
      const range = scaleMax - scaleMin;

      // Only show if axis doesn't start at zero and gap is significant
      if (scaleMin <= 0 || scaleMin < range * 0.1) continue;

      const isLeftAxis = scale.position === 'left';
      const x = isLeftAxis ? chartArea.left : chartArea.right;
      const bottom = chartArea.bottom;

      // Draw zigzag
      drawZigzagBreak(ctx, x, bottom, isLeftAxis);

      // Draw "≠0" label
      ctx.save();
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.8)'; // Amber color for visibility
      ctx.textAlign = isLeftAxis ? 'left' : 'right';
      ctx.textBaseline = 'top';
      const labelX = isLeftAxis ? x + 4 : x - 4;
      ctx.fillText('≠0', labelX, bottom + 4);
      ctx.restore();
    }
  },
};

/**
 * Draw a cleaner zigzag break indicator
 */
function drawZigzagBreak(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottom: number,
  isLeftAxis: boolean
): void {
  const height = 10;
  const width = 6;

  ctx.save();

  // Draw zigzag
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)'; // Amber to match label
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();

  const startX = x;
  const offsetDir = isLeftAxis ? -1 : 1;

  ctx.moveTo(startX, bottom);
  ctx.lineTo(startX + (width * offsetDir), bottom - height * 0.33);
  ctx.lineTo(startX - (width * offsetDir), bottom - height * 0.67);
  ctx.lineTo(startX, bottom - height);

  ctx.stroke();
  ctx.restore();
}

export default axisTruncationPlugin;
