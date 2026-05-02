// Pure force-directed layout for the constellation view. Given a list of
// trackers and weighted finding edges, produces stable {x,y} positions inside
// a square canvas. Stable because the simulation is fed a deterministic PRNG
// seeded by the sorted tracker ids, so the same inputs always produce the
// same layout (no flicker on theme/data re-renders).

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';

interface SimNode extends SimulationNodeDatum {
  id: string;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
}

export interface GraphLayoutOptions {
  /** Square canvas side length in SVG units. */
  size: number;
  /** Padding kept inside the canvas so labels/nodes don't clip. */
  pad: number;
  /** Minimum spacing between node centers. */
  collideRadius: number;
  /** Number of simulation ticks to run synchronously. */
  ticks?: number;
  /** Initial seeding ring radius. Defaults to fit the canvas. */
  seedRadius?: number;
}

export interface GraphEdge {
  aId: string;
  bId: string;
  weight: number;
}

// Tiny seeded PRNG so the force simulation is deterministic across renders.
// d3-force uses Math.random internally to jitter coincident nodes; without a
// seed every remount nudges positions, breaking spatial memory.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function random(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Order-independent hash so reordering trackers does not reseed the layout.
// We sort the ids before reducing, then mix each character into a 32-bit int.
function hashTrackerIds(ids: readonly string[]): number {
  const sorted = [...ids].sort();
  return sorted.reduce((h, id) => {
    let x = h;
    for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0;
    return x;
  }, 0x9e3779b1);
}

/**
 * Run a one-shot d3-force simulation and return clamped positions per id.
 * Strongly-correlated pairs sit closer because link distance shrinks as
 * weight grows.
 */
export function computeConstellationLayout(
  nodeIds: readonly string[],
  edges: readonly GraphEdge[],
  opts: GraphLayoutOptions,
): Record<string, { x: number; y: number }> {
  const { size, pad, collideRadius, ticks = 300 } = opts;
  const cx = size / 2;
  const cy = size / 2;
  const out: Record<string, { x: number; y: number }> = {};
  const n = nodeIds.length;
  if (n === 0) return out;

  const seedR = opts.seedRadius ?? Math.min(size / 2 - pad, 110);
  const nodes: SimNode[] = nodeIds.map((id, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      id,
      x: cx + Math.cos(angle) * seedR,
      y: cy + Math.sin(angle) * seedR,
    };
  });
  const links: SimLink[] = edges.map((e) => ({
    source: e.aId,
    target: e.bId,
    weight: e.weight,
  }));

  const random = mulberry32(hashTrackerIds(nodeIds));

  // forceCenter only translates the centroid, so disconnected or weakly
  // connected nodes get flung outward by charge and end up clamped to the
  // canvas corners. forceX/forceY apply a per-node attraction toward the
  // center, which pulls lonely nodes back without overpowering link forces.
  const sim = forceSimulation<SimNode>(nodes)
    .randomSource(random)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        // Stronger links pull harder and want a shorter rest length.
        .distance((l) => 50 + (1 - l.weight) * 60)
        .strength((l) => 0.2 + l.weight * 0.6),
    )
    .force('charge', forceManyBody<SimNode>().strength(-140))
    .force('x', forceX<SimNode>(cx).strength(0.08))
    .force('y', forceY<SimNode>(cy).strength(0.08))
    .force('collide', forceCollide<SimNode>(collideRadius))
    .stop();

  for (let i = 0; i < ticks; i++) sim.tick();

  // Fit-to-bounds: after the simulation settles, nodes rarely fill the
  // canvas — the centering forces leave them clustered. Compute the bounding
  // box of resolved positions and rescale uniformly so the cluster expands
  // to the inner padded area, then recenter. This zooms the constellation
  // to use the available room without re-tuning the forces.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const x = node.x ?? cx;
    const y = node.y ?? cy;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const bboxW = Math.max(maxX - minX, 1);
  const bboxH = Math.max(maxY - minY, 1);
  const target = size - pad * 2;
  // Cap the zoom so a degenerate single-line layout doesn't blow up to a wall
  // of nodes. 1.6x is enough to eat most of the empty halo without overflow.
  const scale = Math.min(target / bboxW, target / bboxH, 1.6);
  const bboxCx = (minX + maxX) / 2;
  const bboxCy = (minY + maxY) / 2;

  for (const node of nodes) {
    const rx = ((node.x ?? cx) - bboxCx) * scale + cx;
    const ry = ((node.y ?? cy) - bboxCy) * scale + cy;
    const x = Math.min(size - pad, Math.max(pad, rx));
    const y = Math.min(size - pad, Math.max(pad, ry));
    out[node.id] = { x, y };
  }
  return out;
}
