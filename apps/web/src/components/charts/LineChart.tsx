import { useMemo, useState } from "react";
import { cn } from "../../lib/utils";

export interface LineChartSeries {
  id: string;
  label: string;
  points: Array<{ x: string; y: number }>;
}

interface LineChartProps {
  series: LineChartSeries[];
  height?: number;
  yFormat?: (value: number) => string;
  emptyMessage?: string;
  className?: string;
}

// The dataviz skill's own pre-validated categorical palette (references/palette.md) —
// CVD-safe on the adjacent pairlist line/bar charts use, kept distinct from the
// app's --success/--warning/--destructive status tokens so a series never reads
// as a status color.
const SERIES_COLORS = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
  "var(--chart-series-6)",
  "var(--chart-series-7)",
  "var(--chart-series-8)",
];

const VIEW_WIDTH = 640;
const PADDING = { top: 12, right: 12, bottom: 26, left: 40 };
const GRIDLINE_COUNT = 4;

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Zero-dependency inline-SVG line chart (M10) — day-bucketed data plotted on an
 * ordinal (evenly-spaced, not time-proportional) x-axis: simple, legible at
 * prototype scale, and every point still carries its real date as a label so a
 * gap between days is never visually misread as consecutive.
 */
export function LineChart({ series, height = 200, yFormat = (v) => v.toFixed(0), emptyMessage = "No data yet.", className }: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { xDomain, yMin, yMax, plotted } = useMemo(() => {
    const xSet = new Set<string>();
    for (const s of series) for (const p of s.points) xSet.add(p.x);
    const xDomain = [...xSet].sort();

    let yMin = 0;
    let yMax = 1;
    for (const s of series) for (const p of s.points) {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    if (yMin === yMax) yMax = yMin + 1;

    const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
    const innerHeight = height - PADDING.top - PADDING.bottom;
    const xPos = (x: string) => {
      const idx = xDomain.indexOf(x);
      return xDomain.length <= 1 ? PADDING.left : PADDING.left + (idx / (xDomain.length - 1)) * innerWidth;
    };
    const yPos = (y: number) => PADDING.top + innerHeight - ((y - yMin) / (yMax - yMin)) * innerHeight;

    const plotted = series.map((s, i) => ({
      ...s,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      screenPoints: s.points.map((p) => ({ x: xPos(p.x), y: yPos(p.y), value: p.y, date: p.x })),
    }));

    return { xDomain, yMin, yMax, plotted };
  }, [series, height]);

  const hasData = xDomain.length > 0;

  if (!hasData) {
    return (
      <div className={cn("flex items-center justify-center rounded-md border border-border bg-surface-1", className)} style={{ height }}>
        <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const gridlineValues = Array.from({ length: GRIDLINE_COUNT + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / GRIDLINE_COUNT);
  const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const step = xDomain.length > 1 ? innerWidth / (xDomain.length - 1) : innerWidth;
    const idx = Math.round((relativeX - PADDING.left) / step);
    setHoverIndex(Math.max(0, Math.min(xDomain.length - 1, idx)));
  }

  const hoverX = hoverIndex !== null ? PADDING.left + (xDomain.length > 1 ? (hoverIndex / (xDomain.length - 1)) * innerWidth : 0) : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Line chart">
        {gridlineValues.map((v, i) => {
          const y = PADDING.top + (height - PADDING.top - PADDING.bottom) - ((v - yMin) / (yMax - yMin)) * (height - PADDING.top - PADDING.bottom);
          return (
            <g key={i}>
              <line x1={PADDING.left} x2={VIEW_WIDTH - PADDING.right} y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />
              <text x={PADDING.left - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
                {yFormat(v)}
              </text>
            </g>
          );
        })}

        {[0, xDomain.length - 1].map((idx) => {
          const x = PADDING.left + (xDomain.length > 1 ? (idx / (xDomain.length - 1)) * innerWidth : 0);
          return (
            <text key={idx} x={x} y={height - 8} textAnchor={idx === 0 ? "start" : "end"} fontSize={10} fill="hsl(var(--muted-foreground))">
              {formatDateLabel(xDomain[idx]!)}
            </text>
          );
        })}

        {plotted.map((s) =>
          s.screenPoints.length > 1 ? (
            <polyline
              key={s.id}
              points={s.screenPoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            s.screenPoints[0] && <circle key={s.id} cx={s.screenPoints[0].x} cy={s.screenPoints[0].y} r={3} fill={s.color} />
          ),
        )}

        {hoverX !== null && <line x1={hoverX} x2={hoverX} y1={PADDING.top} y2={height - PADDING.bottom} stroke="hsl(var(--border-strong))" strokeWidth={1} />}
        {hoverIndex !== null &&
          plotted.map((s) => {
            const point = s.screenPoints.find((p) => p.date === xDomain[hoverIndex]);
            return point ? <circle key={s.id} cx={point.x} cy={point.y} r={3.5} fill={s.color} stroke="hsl(var(--surface-1))" strokeWidth={1.5} /> : null;
          })}

        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={innerWidth}
          height={height - PADDING.top - PADDING.bottom}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        />
      </svg>

      {hoverIndex !== null && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px]">
          <span className="font-medium text-foreground">{formatDateLabel(xDomain[hoverIndex]!)}</span>
          {plotted.map((s) => {
            const point = s.screenPoints.find((p) => p.date === xDomain[hoverIndex]);
            if (!point) return null;
            return (
              <span key={s.id} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}: <span className="text-foreground">{yFormat(point.value)}</span>
              </span>
            );
          })}
        </div>
      )}

      {series.length >= 2 && hoverIndex === null && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {plotted.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
