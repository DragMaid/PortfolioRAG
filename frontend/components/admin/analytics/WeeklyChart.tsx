"use client";

import { useId } from "react";
import type { DailyTrafficDto } from "@/lib/api/generated";
import { formatChartDay, formatCount } from "@/lib/admin/format";

/** Chart geometry, in the SVG's own units. The viewBox scales it to whatever width it gets. */
const HEIGHT = 200;
const TOP = 16;
const BASE = 165;
const LABEL_Y = 184;
const AXIS_X = 40;
const RIGHT = 680;
const BAR = 16;
/** Baseline bar and current bar sit side by side, this far apart. */
const PAIR_GAP = 2;

/**
 * Readings per day against the four-week weekday baseline.
 *
 * Drawn from the API's series rather than from fixed geometry as the prototype was: the
 * scale, the gridlines and the column positions are all derived, so a quiet week and a
 * week with a front-page spike both fill the frame.
 */
export function WeeklyChart({ daily }: { daily: DailyTrafficDto[] }) {
  const titleId = useId();

  const peak = Math.max(
    1,
    ...daily.map((day) => Math.max(day.reads ?? 0, day.baseline ?? 0)),
  );

  // Round the top of the scale up to something a person would label an axis with, so the
  // gridlines read 0 / 1k / 2k rather than 0 / 873 / 1746.
  const ceiling = niceCeiling(peak);
  const gridlines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * ceiling);

  const span = RIGHT - AXIS_X;
  const slot = span / Math.max(daily.length, 1);

  const scale = (value: number) => ((value / ceiling) * (BASE - TOP)) || 0;

  return (
    <div className="w-full overflow-x-auto pt-4 pb-2">
      <div className="min-w-[620px]">
        <svg
          viewBox={`0 0 700 ${HEIGHT}`}
          className="h-56 w-full overflow-visible"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>
            Daily readings over the window, against the four-week weekday baseline. Peak{" "}
            {formatCount(peak)}.
          </title>

          {gridlines.map((value) => {
            const y = BASE - scale(value);
            const isAxis = value === 0;

            return (
              <g key={value}>
                <line
                  x1={AXIS_X}
                  x2={RIGHT}
                  y1={y}
                  y2={y}
                  stroke={isAxis ? "var(--color-warm-border)" : "var(--color-warm-hairline)"}
                  strokeWidth={1}
                  strokeDasharray={isAxis ? undefined : "3 3"}
                />
                <text
                  x={AXIS_X - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-warm-slate font-mono text-[10px]"
                >
                  {abbreviate(value)}
                </text>
              </g>
            );
          })}

          {daily.map((day, index) => {
            const centre = AXIS_X + slot * (index + 0.5);
            const reads = day.reads ?? 0;
            const baseline = day.baseline ?? 0;

            const readsHeight = scale(reads);
            const baselineHeight = scale(baseline);

            const baselineX = centre - BAR - PAIR_GAP / 2;
            const readsX = centre + PAIR_GAP / 2;

            const date = day.date ? new Date(day.date) : null;

            return (
              <g key={index} className="group">
                {/* A full-height hit area, so the tooltip does not require hitting a 16px bar. */}
                <rect
                  x={centre - slot / 2}
                  y={TOP - 12}
                  width={slot}
                  height={BASE - TOP + 12}
                  fill="transparent"
                />

                {baselineHeight > 0 ? (
                  <rect
                    x={baselineX}
                    y={BASE - baselineHeight}
                    width={BAR}
                    height={baselineHeight}
                    rx={2}
                    className="fill-warm-raised"
                  />
                ) : null}

                <rect
                  x={readsX}
                  y={BASE - readsHeight}
                  width={BAR}
                  height={Math.max(readsHeight, reads > 0 ? 2 : 0)}
                  rx={2}
                  className="fill-warm-black transition-colors group-hover:fill-warm-accent"
                />

                <text
                  x={centre}
                  y={LABEL_Y}
                  textAnchor="middle"
                  className="fill-warm-slate font-mono text-[11px]"
                >
                  {date ? formatChartDay(date) : ""}
                </text>

                <g
                  transform={`translate(${centre}, ${Math.max(BASE - readsHeight - 14, TOP - 6)})`}
                  className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <rect x={-52} y={-12} width={104} height={24} rx={3} className="fill-warm-black" />
                  <text
                    x={0}
                    y={3}
                    textAnchor="middle"
                    className="fill-warm-surface font-mono text-[10px]"
                  >
                    {formatCount(reads)} reads · {formatCount(day.visitors ?? 0)} vis.
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Rounds a peak up to 1, 2 or 5 times a power of ten, so the axis labels stay round. */
function niceCeiling(peak: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const normalized = peak / magnitude;

  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function abbreviate(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${Math.round(value)}`;
}
