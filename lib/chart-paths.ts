// Pure SVG path builders for normalized line+area charts. Given a chart
// geometry (width, height, padding) and a series length, returns d3 line and
// area generators plus the y-scale so callers can place gridlines through
// the same scale. Works on `(number | null)[]` series so missing points
// produce gaps instead of bridging.

import { scaleLinear, type ScaleLinear } from 'd3-scale';
import { area as d3Area, line as d3Line, curveLinear } from 'd3-shape';

export interface ChartGeometry {
  width: number;
  height: number;
  pad: number;
}

// Type guard so d3 generator callbacks can drop null values without an
// `as number` assertion.
function isNumber(v: number | null): v is number {
  return v !== null;
}

export interface PathBuilders {
  linePath: (values: (number | null)[]) => string | null;
  areaPath: (values: (number | null)[]) => string | null;
  yScale: ScaleLinear<number, number>;
  xScale: ScaleLinear<number, number>;
}

/**
 * Build a y-scale once per series length. The x-domain is index-based, so
 * the scales depend only on chart geometry and the number of points.
 */
export function buildPathBuilders(n: number, geom: ChartGeometry): PathBuilders {
  const xScale = scaleLinear()
    .domain([0, Math.max(n - 1, 1)])
    .range([geom.pad, geom.width - geom.pad]);
  // Inverted range: 0 sits on the baseline, 1 at the top.
  const yScale = scaleLinear()
    .domain([0, 1])
    .range([geom.height - geom.pad, geom.pad]);

  const linePath = d3Line<number | null>()
    .defined(isNumber)
    .x((_, i) => xScale(i))
    .y((v) => (isNumber(v) ? yScale(v) : 0))
    .curve(curveLinear);
  const areaPath = d3Area<number | null>()
    .defined(isNumber)
    .x((_, i) => xScale(i))
    .y0(yScale(0))
    .y1((v) => (isNumber(v) ? yScale(v) : 0))
    .curve(curveLinear);

  return { linePath, areaPath, yScale, xScale };
}
