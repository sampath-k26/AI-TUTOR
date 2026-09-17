import { useMemo, useState } from "react";
import { cn } from "../../lib/utils";

export interface ConceptMapNode {
  id: string;
  name: string;
  trend?: "improving" | "stable" | "requires_attention";
}

export interface ConceptMapEdge {
  source: string;
  target: string;
  weight: number;
}

interface ConceptMapGraphProps {
  nodes: ConceptMapNode[];
  edges: ConceptMapEdge[];
  height?: number;
  emptyMessage?: string;
  className?: string;
}

const VIEW_SIZE = 480;
const CENTER = VIEW_SIZE / 2;
const RADIUS = VIEW_SIZE / 2 - 56;
const NODE_RADIUS = 7;

const TREND_COLOR: Record<NonNullable<ConceptMapNode["trend"]>, string> = {
  improving: "hsl(var(--success))",
  stable: "hsl(var(--muted-foreground))",
  requires_attention: "hsl(var(--warning))",
};
const DEFAULT_NODE_COLOR = "hsl(var(--chart-series-1))";

/**
 * Fixed circular layout, not a force-directed simulation (decision D19 / M12's
 * no-graph-library scope): angle = index/total * 2pi. Edge stroke width scales
 * with co-occurrence weight so a more-frequently-co-occurring pair reads as
 * visually thicker.
 */
export function ConceptMapGraph({ nodes, edges, height = 420, emptyMessage = "No concepts yet.", className }: ConceptMapGraphProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const positioned = useMemo(() => {
    return nodes.map((node, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
      return { ...node, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
    });
  }, [nodes]);

  const positionById = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);
  const maxWeight = useMemo(() => Math.max(1, ...edges.map((e) => e.weight)), [edges]);

  const connectedIds = useMemo(() => {
    if (!hoveredId) return null;
    const set = new Set<string>([hoveredId]);
    for (const e of edges) {
      if (e.source === hoveredId) set.add(e.target);
      if (e.target === hoveredId) set.add(e.source);
    }
    return set;
  }, [hoveredId, edges]);

  if (nodes.length === 0) {
    return (
      <div className={cn("flex items-center justify-center rounded-md border border-border bg-surface-1", className)} style={{ height }}>
        <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Concept map"
      >
        {edges.map((edge, i) => {
          const source = positionById.get(edge.source);
          const target = positionById.get(edge.target);
          if (!source || !target) return null;
          const dimmed = connectedIds !== null && !(connectedIds.has(edge.source) && connectedIds.has(edge.target));
          return (
            <line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="hsl(var(--border-strong))"
              strokeWidth={1 + (edge.weight / maxWeight) * 4}
              opacity={dimmed ? 0.15 : 0.7}
            />
          );
        })}

        {positioned.map((node) => {
          const dimmed = connectedIds !== null && !connectedIds.has(node.id);
          const color = node.trend ? TREND_COLOR[node.trend] : DEFAULT_NODE_COLOR;
          const labelAnchor = node.x > CENTER + 4 ? "start" : node.x < CENTER - 4 ? "end" : "middle";
          const labelDx = node.x > CENTER + 4 ? 10 : node.x < CENTER - 4 ? -10 : 0;
          const labelDy = Math.abs(node.x - CENTER) < 4 ? (node.y < CENTER ? -12 : 20) : 4;
          return (
            <g key={node.id} opacity={dimmed ? 0.3 : 1} onMouseEnter={() => setHoveredId(node.id)} onMouseLeave={() => setHoveredId(null)}>
              <circle cx={node.x} cy={node.y} r={NODE_RADIUS} fill={color} stroke="hsl(var(--surface-1))" strokeWidth={2} />
              <text
                x={node.x + labelDx}
                y={node.y + labelDy}
                textAnchor={labelAnchor}
                fontSize={11}
                fill="hsl(var(--foreground))"
                className="select-none"
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>

      {nodes.some((n) => n.trend) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TREND_COLOR.improving }} />
            Improving
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TREND_COLOR.stable }} />
            Stable
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TREND_COLOR.requires_attention }} />
            Requires attention
          </span>
        </div>
      )}
    </div>
  );
}
