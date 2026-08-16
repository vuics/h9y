/** A fourteen-point trend beside a KPI tile.
 *
 * Hand-drawn SVG rather than a chart library: at this size axes, margins and a
 * tooltip layer are all noise, and five Recharts instances on the overview would
 * cost more than the page they decorate.
 *
 * A sparkline has no axis, so the shape is all a reader gets. Two rules follow
 * from that and neither is cosmetic:
 *
 *   * a flat series is drawn flat, never stretched to fill the box — normalising
 *     a run of zeros to the full height turns "nothing happened" into a dramatic
 *     line;
 *   * the last point is marked, because "where it ended up" is the one value a
 *     reader takes from a shape with no labels.
 */

import React, { useId } from 'react'

const WIDTH = 88
const HEIGHT = 26
const PADDING = 3

export function Sparkline({ points, label, kind, tone = 'neutral' }) {
  const gradientId = useId()
  const values = (points || []).filter(value => typeof value === 'number')
  if (values.length < 2) return null

  const peak = Math.max(...values)
  const floor = Math.min(...values)
  const span = peak - floor
  const usable = HEIGHT - PADDING * 2
  const step = (WIDTH - PADDING * 2) / (values.length - 1)

  const y = value => (
    // A flat series sits on the baseline instead of being scaled to fill: with
    // no axis, a stretched line of equal values reads as movement.
    span === 0
      ? HEIGHT - PADDING - (peak > 0 ? usable / 2 : 0)
      : HEIGHT - PADDING - ((value - floor) / span) * usable
  )
  const coordinates = values.map((value, index) => [PADDING + index * step, y(value)])
  const line = coordinates.map(([x, top]) => `${x.toFixed(1)} ${top.toFixed(1)}`).join(' L ')
  const area = `M ${line} L ${coordinates[coordinates.length - 1][0].toFixed(1)} ${HEIGHT - PADDING} L ${PADDING} ${HEIGHT - PADDING} Z`
  const [lastX, lastY] = coordinates[coordinates.length - 1]

  return (
    <svg
      className="pr-spark"
      data-tone={tone}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={`${label}: ${values.join(', ')}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={`M ${line}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.4" fill="currentColor" />
      <title>{`${label} · ${kind === 'BACKLOG' ? 'остаток на каждый день' : 'приток по дням'}`}</title>
    </svg>
  )
}
